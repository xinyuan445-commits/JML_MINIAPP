from flask import Blueprint, jsonify
from models.db import get_db

product_bp = Blueprint('product', __name__)

@product_bp.route('/list', methods=['GET'])
def list_products():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, name, spec, description, image_url, price, unit
            FROM PRODUCT
            WHERE is_active = 1
            ORDER BY sort ASC
        """)
        data = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({
            "code": 0,
            "msg": "success",
            "data": data
        })
    except Exception as e:
        return jsonify({
            "code": 1,
            "msg": "error",
            "error": str(e)
        }), 500
