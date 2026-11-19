import hmac
import ipaddress
import os
from dataclasses import dataclass
from typing import Mapping

import jwt
from jwt import PyJWKClient


class OidcConfigurationError(RuntimeError):
    pass


class OidcAuthenticationError(RuntimeError):
    pass


def _enabled(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _csv(value):
    return tuple(item.strip() for item in str(value or "").split(",") if item.strip())


@dataclass(frozen=True)
class OidcSettings:
    enabled: bool
    issuer_url: str
    jwks_url: str
    audience: str
    token_header: str
    view_roles: frozenset[str]
    write_roles: frozenset[str]
    trusted_proxy_ips: tuple[str, ...]
    proxy_secret: str
    platform_url: str

    @classmethod
    def from_env(cls, environ=None):
        env = environ or os.environ
        return cls(
            enabled=_enabled(env.get("OIDC_ENABLED", "0")),
            issuer_url=str(env.get("OIDC_ISSUER_URL") or "").rstrip("/"),
            jwks_url=str(env.get("OIDC_JWKS_URL") or "").strip(),
            audience=str(env.get("OIDC_AUDIENCE") or "").strip(),
            token_header=str(
                env.get("OIDC_TOKEN_HEADER") or "X-Auth-Request-Access-Token"
            ).strip(),
            view_roles=frozenset(_csv(env.get("OIDC_VIEW_ROLES"))),
            write_roles=frozenset(_csv(env.get("OIDC_WRITE_ROLES"))),
            trusted_proxy_ips=_csv(env.get("TRUSTED_PROXY_IPS")),
            proxy_secret=str(env.get("JML_PROXY_SECRET") or ""),
            platform_url=str(
                env.get("JML_PLATFORM_URL")
                or "https://production.jml.goldenchameleon.cn"
            ).strip(),
        )

    def validation_errors(self):
        if not self.enabled:
            return []
        required = {
            "OIDC_ISSUER_URL": self.issuer_url,
            "OIDC_JWKS_URL": self.jwks_url,
            "OIDC_AUDIENCE": self.audience,
            "OIDC_TOKEN_HEADER": self.token_header,
            "OIDC_VIEW_ROLES": self.view_roles,
            "OIDC_WRITE_ROLES": self.write_roles,
            "TRUSTED_PROXY_IPS": self.trusted_proxy_ips,
            "JML_PROXY_SECRET": self.proxy_secret,
            "JML_PLATFORM_URL": self.platform_url,
        }
        errors = [name for name, value in required.items() if not value]
        for value in self.trusted_proxy_ips:
            try:
                ipaddress.ip_address(value)
            except ValueError:
                errors.append(f"TRUSTED_PROXY_IPS:{value}")
        return errors


@dataclass(frozen=True)
class OidcIdentity:
    subject: str
    username: str
    display_name: str
    roles: frozenset[str]


class OidcAuthenticator:
    def __init__(self, settings, jwks_client=None):
        self.settings = settings
        self._jwks_client = jwks_client

    def is_trusted_proxy(self, remote_addr):
        if not self.settings.enabled or not remote_addr:
            return False
        try:
            remote_ip = ipaddress.ip_address(str(remote_addr).split("%", 1)[0])
        except ValueError:
            return False
        for value in self.settings.trusted_proxy_ips:
            try:
                if remote_ip == ipaddress.ip_address(value):
                    return True
            except ValueError:
                continue
        return False

    def is_platform_request(self, remote_addr):
        return self.settings.enabled and self.is_trusted_proxy(remote_addr)

    def _client(self):
        if self._jwks_client is None:
            self._jwks_client = PyJWKClient(
                self.settings.jwks_url,
                cache_jwk_set=True,
                lifespan=300,
                timeout=5,
            )
        return self._jwks_client

    def authenticate(self, remote_addr, headers: Mapping[str, str]):
        if not self.is_platform_request(remote_addr):
            return None
        errors = self.settings.validation_errors()
        if errors:
            raise OidcConfigurationError(",".join(errors))

        supplied_secret = str(headers.get("X-JML-Proxy-Secret") or "")
        if not hmac.compare_digest(supplied_secret, self.settings.proxy_secret):
            raise OidcAuthenticationError("proxy secret mismatch")

        if str(headers.get("X-JML-Platform-Authenticated") or "") == "1":
            subject = str(headers.get("X-JML-Platform-Subject") or "").strip()
            username = str(headers.get("X-JML-Platform-Username") or "").strip()
            roles = frozenset(_csv(headers.get("X-JML-Platform-Roles")))
            if not subject or not username or not roles:
                raise OidcAuthenticationError("platform identity incomplete")
            return OidcIdentity(
                subject=subject,
                username=username,
                display_name=username,
                roles=roles,
            )

        token = str(headers.get(self.settings.token_header) or "").strip()
        if token.lower().startswith("bearer "):
            token = token[7:].strip()
        if not token:
            raise OidcAuthenticationError("access token missing")

        try:
            signing_key = self._client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.settings.audience,
                issuer=self.settings.issuer_url,
                leeway=30,
                options={
                    "require": ["exp", "iat", "sub"],
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_aud": True,
                    "verify_iss": True,
                },
            )
        except Exception as exc:
            raise OidcAuthenticationError("access token invalid") from exc

        subject = str(claims.get("sub") or "").strip()
        if not subject:
            raise OidcAuthenticationError("subject missing")
        username = str(claims.get("preferred_username") or subject).strip()
        display_name = str(claims.get("name") or username).strip()
        roles = self._extract_roles(claims)
        return OidcIdentity(
            subject=subject,
            username=username,
            display_name=display_name,
            roles=frozenset(roles),
        )

    def _extract_roles(self, claims):
        roles = set()
        realm_access = claims.get("realm_access")
        if isinstance(realm_access, dict):
            roles.update(
                str(role)
                for role in realm_access.get("roles", [])
                if isinstance(role, str) and role
            )
        resource_access = claims.get("resource_access")
        if isinstance(resource_access, dict):
            client_access = resource_access.get(self.settings.audience)
            if isinstance(client_access, dict):
                roles.update(
                    str(role)
                    for role in client_access.get("roles", [])
                    if isinstance(role, str) and role
                )
        return roles

    def can_view(self, identity):
        return bool(identity.roles & (self.settings.view_roles | self.settings.write_roles))

    def can_write(self, identity):
        return bool(identity.roles & self.settings.write_roles)
