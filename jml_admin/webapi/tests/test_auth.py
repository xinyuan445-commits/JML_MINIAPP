import json
import inspect
import os
import time
from unittest.mock import MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from flask import g, jsonify
from werkzeug.security import generate_password_hash


os.environ["FLASK_SECRET_KEY"] = "test-only-flask-secret"
with patch("dotenv.load_dotenv", return_value=False), patch(
    "mysql.connector.pooling.MySQLConnectionPool",
    return_value=MagicMock(),
):
    import app as webapp

from oidc_auth import OidcAuthenticator, OidcSettings
from admin_permissions import BUSINESS_VIEWS

pytestmark = pytest.mark.usefixtures("legacy_admin_access")


def test_production_label_queries_allow_closed_orders():
    assert "CloseDate IS NULL" not in webapp.PRODUCTION_LABEL_SQL
    assert "CloseDate IS NULL" not in webapp.PRODUCTION_MATERIAL_SQL
    assert "CloseDate IS NULL" not in inspect.getsource(webapp.production_label_options)
    assert "RelsTime IS NOT NULL" in webapp.PRODUCTION_LABEL_SQL
    assert "RelsTime IS NOT NULL" in webapp.PRODUCTION_MATERIAL_SQL


ISSUER = "https://auth.example.test/realms/jml"
AUDIENCE = "jml-platform"
TRUSTED_PROXY = "172.16.10.105"
PROXY_SECRET = "test-only-proxy-secret"
TOKEN_HEADER = "X-Auth-Request-Access-Token"

PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_JWK = json.loads(
    jwt.algorithms.RSAAlgorithm.to_jwk(PRIVATE_KEY.public_key())
)
PUBLIC_JWK.update({"kid": "test-key", "alg": "RS256", "use": "sig"})


class StaticJwksClient:
    def get_signing_key_from_jwt(self, token):
        header = jwt.get_unverified_header(token)
        if header.get("kid") != "test-key":
            raise jwt.InvalidKeyError("unknown test key")
        return jwt.PyJWK.from_dict(PUBLIC_JWK)


def settings():
    return OidcSettings(
        enabled=True,
        issuer_url=ISSUER,
        jwks_url=f"{ISSUER}/protocol/openid-connect/certs",
        audience=AUDIENCE,
        token_header=TOKEN_HEADER,
        view_roles=frozenset(
            {"production-view", "production-admin", "suite-admin"}
        ),
        write_roles=frozenset({"production-admin", "suite-admin"}),
        trusted_proxy_ips=(TRUSTED_PROXY,),
        proxy_secret=PROXY_SECRET,
        platform_url="https://production.example.test",
    )


def token_for(roles, **overrides):
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "domain-user-id",
        "iat": now,
        "exp": now + 300,
        "preferred_username": "DOMAIN\\zhangsan",
        "name": "张三",
        "realm_access": {"roles": list(roles)},
    }
    claims.update(overrides)
    if overrides.get("sub", object()) is None:
        claims.pop("sub", None)
    key = claims.pop("_signing_key", PRIVATE_KEY)
    return jwt.encode(
        claims,
        key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )


def oidc_headers(token, secret=PROXY_SECRET):
    return {
        TOKEN_HEADER: token,
        "X-JML-Proxy-Secret": secret,
    }


def platform_headers(roles, secret=PROXY_SECRET):
    return {
        "X-JML-Proxy-Secret": secret,
        "X-JML-Platform-Authenticated": "1",
        "X-JML-Platform-Subject": "domain-user-id",
        "X-JML-Platform-Username": "DOMAIN\\zhangsan",
        "X-JML-Platform-Roles": ",".join(roles),
    }


@webapp.app.route(
    "/api/mo/_auth-test",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
)
def auth_test_endpoint():
    return jsonify({
        "code": 0,
        "authSource": g.auth_source,
        "username": g.audit_username,
    })


@pytest.fixture(autouse=True)
def configure_authenticator(monkeypatch):
    authenticator = OidcAuthenticator(settings(), StaticJwksClient())
    monkeypatch.setattr(webapp, "_oidc_authenticator", authenticator)
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")


@pytest.fixture
def client():
    return webapp.app.test_client()


def trusted_get(client, path, token, **kwargs):
    return client.get(
        path,
        headers=oidc_headers(token, **kwargs),
        environ_base={"REMOTE_ADDR": TRUSTED_PROXY},
    )


def trusted_post(client, path, token, **kwargs):
    return client.post(
        path,
        headers=oidc_headers(token, **kwargs),
        environ_base={"REMOTE_ADDR": TRUSTED_PROXY},
    )


def test_valid_oidc_user_skips_local_login(client):
    response = trusted_get(
        client,
        "/api/currentUser",
        token_for(["production-view"]),
    )
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data == {
        "access": "viewer",
        "authSource": "oidc",
        "name": "张三",
        "roles": ["production-view"],
        "userid": "domain-user-id",
        "username": "DOMAIN\\zhangsan",
        "permissions": sorted(BUSINESS_VIEWS),
            "adminRoles": ["viewer"],
            "adminAccountId": 7,
            "disabledPages": [],
        }


def test_trusted_platform_assertion_skips_jwt_validation(client):
    response = client.get(
        "/api/currentUser",
        headers=platform_headers(["production-view"]),
        environ_base={"REMOTE_ADDR": TRUSTED_PROXY},
    )
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["authSource"] == "oidc"
    assert data["username"] == "DOMAIN\\zhangsan"
    assert data["access"] == "viewer"


def test_platform_assertion_requires_trusted_proxy_and_secret(client):
    forged = client.get(
        "/api/currentUser",
        headers=platform_headers(["suite-admin"]),
        environ_base={"REMOTE_ADDR": "172.16.10.45"},
    )
    assert forged.status_code == 401
    wrong_secret = client.get(
        "/api/currentUser",
        headers=platform_headers(["suite-admin"], secret="wrong-secret"),
        environ_base={"REMOTE_ADDR": TRUSTED_PROXY},
    )
    assert wrong_secret.status_code == 401


def test_production_view_can_read_but_cannot_write(client):
    token = token_for(["production-view"])
    assert trusted_get(client, "/api/mo/_auth-test", token).status_code == 200
    response = trusted_post(client, "/api/mo/_auth-test", token)
    assert response.status_code == 403
    assert response.get_json()["msg"] == "当前域账号只有查看权限"


@pytest.mark.parametrize("role", ["production-admin", "suite-admin"])
def test_write_roles_can_write(client, role):
    response = trusted_post(client, "/api/mo/_auth-test", token_for([role]))
    assert response.status_code == 200
    assert response.get_json()["username"] == "DOMAIN\\zhangsan"


def test_domain_user_without_production_role_is_forbidden(client):
    response = trusted_get(client, "/api/currentUser", token_for(["other-role"]))
    assert response.status_code == 403


def test_non_trusted_proxy_headers_are_ignored(client):
    with client.session_transaction() as session:
        session["admin_username"] = "legacy-viewer"
        session["admin_display_name"] = "旧账号"
        session["admin_role"] = "viewer"
    response = client.post(
        "/api/mo/_auth-test",
        headers={
            **oidc_headers(token_for(["suite-admin"])),
            "X-Forwarded-For": TRUSTED_PROXY,
            "X-Auth-Request-User": "forged-admin",
        },
        environ_base={"REMOTE_ADDR": "172.16.10.45"},
    )
    assert response.status_code == 403


def test_trusted_proxy_auth_failure_does_not_fall_back_to_session(client):
    with client.session_transaction() as session:
        session["admin_username"] = "legacy-admin"
        session["admin_role"] = "admin"
    response = trusted_get(
        client,
        "/api/currentUser",
        token_for(["suite-admin"]),
        secret="wrong-secret",
    )
    assert response.status_code == 401
    assert response.get_json()["msg"] == "统一认证校验失败"


@pytest.mark.parametrize(
    "token",
    [
        token_for(["production-view"], _signing_key=OTHER_PRIVATE_KEY),
        token_for(["production-view"], iss="https://wrong-issuer.example.test"),
        token_for(["production-view"], aud="wrong-audience"),
        token_for(["production-view"], exp=int(time.time()) - 120),
        token_for(["production-view"], iat=int(time.time()) + 120),
        token_for(["production-view"], sub=None),
    ],
    ids=[
        "wrong-signature",
        "wrong-issuer",
        "wrong-audience",
        "expired",
        "future-iat",
        "missing-sub",
    ],
)
def test_invalid_tokens_are_rejected(client, token):
    response = trusted_get(client, "/api/currentUser", token)
    assert response.status_code == 401


def test_health_check_is_anonymous_even_for_trusted_proxy(client):
    response = client.get(
        "/healthz",
        environ_base={"REMOTE_ADDR": TRUSTED_PROXY},
    )
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_oidc_logout_returns_to_platform_without_clearing_local_session(client):
    with client.session_transaction() as session:
        session["admin_user_id"] = 7
        session["admin_username"] = "legacy-admin"
        session["admin_display_name"] = "旧管理员"
        session["admin_role"] = "admin"
    response = trusted_post(
        client,
        "/api/login/outLogin",
        token_for(["production-view"]),
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["redirectUrl"] == (
        "https://production.example.test"
    )
    direct_response = client.get(
        "/api/currentUser",
        environ_base={"REMOTE_ADDR": "172.16.10.45"},
    )
    assert direct_response.get_json()["data"]["username"] == "legacy-admin"


def test_oidc_print_audit_uses_domain_username(client, monkeypatch):
    captured = {}

    class AuditCursor:
        def execute(self, query, params=None):
            if "INSERT INTO mo_admin_audit_log_yx" in query:
                captured["params"] = params

        def close(self):
            pass

    class AuditConnection:
        def cursor(self, dictionary=False):
            return AuditCursor()

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(webapp, "db", AuditConnection)
    response = client.post(
        "/api/mo/production-label/print-log",
        json={"mo_code": "SCDD-TEST", "line_count": 2},
        headers=oidc_headers(token_for(["production-admin"])),
        environ_base={"REMOTE_ADDR": TRUSTED_PROXY},
    )
    assert response.status_code == 200
    assert captured["params"][0] == "DOMAIN\\zhangsan"
    assert captured["params"][1] == "打印生产标签"


class LoginCursor:
    def __init__(self, user):
        self.user = user
        self.last_query = ""

    def execute(self, query, _params=None):
        self.last_query = query

    def fetchone(self):
        if "FROM mo_admin_user_yx" in self.last_query:
            return self.user
        return {"value": 1}

    def close(self):
        pass


class LoginConnection:
    def __init__(self, user):
        self.user = user

    def cursor(self, dictionary=False):
        return LoginCursor(self.user)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


def test_legacy_account_login_and_logout_still_work(client, monkeypatch):
    user = {
        "id": 7,
        "username": "legacy-admin",
        "password_hash": generate_password_hash("correct-password"),
        "display_name": "旧管理员",
        "role": "admin",
        "is_active": 1,
    }
    monkeypatch.setattr(webapp, "db", lambda: LoginConnection(user))
    login_response = client.post(
        "/api/login/account",
        json={"username": "legacy-admin", "password": "correct-password"},
        environ_base={"REMOTE_ADDR": "172.16.10.45"},
    )
    assert login_response.status_code == 200
    assert login_response.get_json()["status"] == "ok"
    current_response = client.get(
        "/api/currentUser",
        environ_base={"REMOTE_ADDR": "172.16.10.45"},
    )
    assert current_response.get_json()["data"]["authSource"] == "session"
    logout_response = client.post(
        "/api/login/outLogin",
        environ_base={"REMOTE_ADDR": "172.16.10.45"},
    )
    assert logout_response.status_code == 200
    assert client.get("/api/currentUser").status_code == 401
