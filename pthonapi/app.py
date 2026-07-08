import os
from datetime import timedelta

from flask import Flask, jsonify
from routes.product import product_bp
from routes.login import login_bp
from routes.test import test_bp
from routes.query import query_bp
from routes.factory_task import factory_task_bp
from routes.mo import mo_bp
from routes.natural_gas import natural_gas_bp
from routes.quote import quote_bp
from routes.dingtalk import dingtalk_bp

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(minutes=30),
)
app.register_blueprint(product_bp, url_prefix='/api/product')
app.register_blueprint(login_bp, url_prefix='/api/login')
app.register_blueprint(test_bp, url_prefix='/api/test')  # ← 新增
app.register_blueprint(factory_task_bp)
app.register_blueprint(mo_bp, url_prefix='/api/mo')
app.register_blueprint(natural_gas_bp)
app.register_blueprint(quote_bp, url_prefix='/api/quote')
app.register_blueprint(dingtalk_bp, url_prefix='/api/mo/dingtalk')


app.register_blueprint(query_bp, url_prefix="/api/query")


# 新增 /test/success 路由
@app.route("/test/success", methods=["GET"])
def test_success():
    return jsonify({
        "ok": True,
        "message": "API 测试成功",
        "domain": "api.quanshenghuoqin.com"
    })

if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=8668, debug=True)
    app.run(host='0.0.0.0', port=8668, debug=True)
