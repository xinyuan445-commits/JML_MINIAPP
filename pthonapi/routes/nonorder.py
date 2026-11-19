"""Miniapp identity adapter; deliberately independent of ERP and repair reporting."""
import sys
from pathlib import Path

# Local checkout fallback. Deploy the same shared distribution to both services.
shared = Path(__file__).resolve().parents[2] / "nonorder_shared"
if shared.is_dir():
    sys.path.insert(0, str(shared))

from flask import request
from nonorder_core.http import blueprint
from nonorder_core.storage import engine_for, RuleError


def database_engine():
    # Lazy import avoids creating a connection pool simply by importing this adapter.
    from models.db2 import get_db2
    return engine_for(get_db2)


def identity(_store):
    staff_id = request.headers.get("staff-id", "")
    if not staff_id or len(staff_id) > 64:
        raise RuleError("请先登录", 401)
    # Same business identity convention as stationAccess; this is not token authentication.
    return {"source": "mini", "staff_id": staff_id}


nonorder_bp = blueprint(database_engine, identity, name="mobile_nonorder")
