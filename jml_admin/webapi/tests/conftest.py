from unittest.mock import patch, MagicMock
import os

import pytest
from flask import g, session

os.environ.setdefault("FLASK_SECRET_KEY", "test-only-flask-secret")
with patch("dotenv.load_dotenv", return_value=False), patch(
    "mysql.connector.pooling.MySQLConnectionPool", return_value=MagicMock()
):
    import app as webapp

from admin_permissions import ALL_PERMISSIONS, BUSINESS_VIEWS, READ_RULES, WRITE_RULES


@pytest.fixture
def legacy_admin_access(monkeypatch):
    """Isolate existing business-query tests from the new authorization database.

    Real permission resolution/storage is exercised in test_admin_permissions.py.
    JWT signature/trust/role-ceiling checks still run in the existing auth tests.
    """
    account = {"id": 7, "is_active": 1, "session_version": 0}
    def resolve():
        identity = g.oidc_identity
        writable = webapp._oidc_authenticator.can_write(identity) if identity else session.get("admin_role") == "admin"
        g.admin_permissions = set(ALL_PERMISSIONS if writable else BUSINESS_VIEWS)
        g.admin_account = account
        g.admin_roles = ["system-admin" if writable else "viewer"]
        g.admin_display_name = session.get("admin_display_name") or session.get("admin_username")
        return True
    monkeypatch.setattr(webapp, "_resolve_admin_access", resolve)
    monkeypatch.setattr(webapp, "load_account", lambda *_args, **_kwargs: account)
    monkeypatch.setitem(READ_RULES, "/api/mo/_auth-test", set(BUSINESS_VIEWS))
    monkeypatch.setitem(WRITE_RULES, "/api/mo/_auth-test", {"process.add"})
