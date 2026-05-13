from flask import Flask
from routes.product import product_bp
from routes.login import login_bp
from routes.test import test_bp
from routes.query import query_bp
from routes.factory_task import factory_task_bp
from routes.mo import mo_bp

app = Flask(__name__)
app.register_blueprint(product_bp, url_prefix='/api/product')
app.register_blueprint(login_bp, url_prefix='/api/login')
app.register_blueprint(test_bp, url_prefix='/api/test')  # ← 新增
app.register_blueprint(factory_task_bp)
app.register_blueprint(mo_bp, url_prefix='/api/mo')


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
     app.run(house='0.0.0.0', port=8668, debug=True)