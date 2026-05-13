# routes/test.py
from flask import Blueprint, jsonify, request, current_app
import time
import socket

test_bp = Blueprint("test", __name__)

@test_bp.get("/ping")
def ping():
    """最简单健康检查"""
    return jsonify({
        "ok": True,
        "message": "pong",
        "ts": int(time.time()),
        "host": socket.gethostname()
    })

@test_bp.post("/echo")
def echo():
    """回显你传入的 JSON/表单参数"""
    data = request.get_json(silent=True) or {}
    form = request.form.to_dict() if request.form else {}
    return jsonify({
        "ok": True,
        "json": data,
        "form": form
    })

@test_bp.get("/info")
def info():
    """返回请求信息，方便排查反向代理、Header等"""
    return jsonify({
        "ok": True,
        "method": request.method,
        "path": request.path,
        "remote_addr": request.remote_addr,
        "headers": {k: v for k, v in request.headers.items()}
    })
    
    
