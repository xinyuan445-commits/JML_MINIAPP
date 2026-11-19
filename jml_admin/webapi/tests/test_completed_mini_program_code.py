import base64
from unittest.mock import MagicMock

import pytest

import app as webapp
from oidc_auth import OidcAuthenticator, OidcSettings


pytestmark = pytest.mark.usefixtures("legacy_admin_access")
PATH = "/api/mo/completed-workorder/qr-code"


@pytest.fixture(autouse=True)
def isolated_app(monkeypatch):
    webapp.app.config.update(TESTING=True, SECRET_KEY="test-only-flask-secret")
    monkeypatch.setattr(
        webapp,
        "_oidc_authenticator",
        OidcAuthenticator(OidcSettings.from_env({"OIDC_ENABLED": "0"})),
    )


@pytest.fixture
def client():
    client = webapp.app.test_client()
    with client.session_transaction() as session:
        session.update(
            admin_user_id=7,
            admin_username="local-admin",
            admin_role="admin",
            admin_auth_version=0,
        )
    return client


def database_with_execution(exists=True):
    cursor = MagicMock()
    cursor.fetchone.return_value = {"id": 123} if exists else None
    connection = MagicMock()
    connection.cursor.return_value = cursor
    return connection, cursor


def test_generates_execution_qr_code(client, monkeypatch):
    connection, cursor = database_with_execution()
    monkeypatch.setattr(webapp, "db", MagicMock(return_value=connection))
    qr_code = MagicMock(return_value=("image/png", b"qr-code"))
    monkeypatch.setattr(webapp, "_execution_qr_code", qr_code)

    response = client.get(PATH, query_string={"execution_id": 123})

    assert response.status_code == 200
    body = response.get_json()
    assert body["code"] == 0
    assert body["data"]["image_data_url"] == (
        "data:image/png;base64," + base64.b64encode(b"qr-code").decode()
    )
    cursor.execute.assert_called_once_with(
        "SELECT id FROM mo_execution_yx WHERE id=%s", (123,)
    )
    qr_code.assert_called_once_with(123)
    connection.close.assert_called_once()


def test_qr_code_contains_exact_execution_link(monkeypatch):
    image = MagicMock()
    image.save.side_effect = lambda output, format: output.write(b"png")
    code = MagicMock()
    code.make_image.return_value = image
    qr_factory = MagicMock(return_value=code)
    monkeypatch.setattr(webapp.qrcode, "QRCode", qr_factory)

    mime_type, content = webapp._execution_qr_code(123)

    assert mime_type == "image/png"
    assert content == b"png"
    code.add_data.assert_called_once_with(
        "https://api.quanshenghuoqin.com/jml/process/?exec_id=123"
    )
    code.make.assert_called_once_with(fit=True)
    image.save.assert_called_once()


def test_rejects_unknown_execution_without_generating_qr(client, monkeypatch):
    connection, _ = database_with_execution(False)
    monkeypatch.setattr(webapp, "db", MagicMock(return_value=connection))
    qr_code = MagicMock()
    monkeypatch.setattr(webapp, "_execution_qr_code", qr_code)

    response = client.get(PATH, query_string={"execution_id": 999})

    assert response.get_json() == {"code": 1, "msg": "未找到完工记录"}
    qr_code.assert_not_called()
    connection.close.assert_called_once()
