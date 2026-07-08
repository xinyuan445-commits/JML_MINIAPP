# routes/login.py
from flask import Blueprint, request, jsonify
from models.db import get_db
from datetime import datetime, timedelta
import requests
import os

login_bp = Blueprint('login', __name__)

@login_bp.route('', methods=['POST'])  # 注意：url_prefix 已在 app.py 设置为 /api/login
def wx_login():
    code = request.json.get('code')
    nickname = request.json.get('nickname') or ''
    avatar_url = request.json.get('avatar_url') or ''

    if not code:
        return jsonify({'code': 1, 'msg': '缺少 code 参数'}), 400

    appid = os.getenv("WX_APPID")
    secret = os.getenv("WX_SECRET")
    wx_url = f"https://api.weixin.qq.com/sns/jscode2session?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code"

    try:
        response = requests.get(wx_url)
        data = response.json()
        openid = data.get("openid")
        unionid = data.get("unionid")
        if not openid:
            return jsonify({'code': 2, 'msg': '微信登录失败', 'detail': data}), 400
    except Exception as e:
        return jsonify({'code': 3, 'msg': '请求微信失败', 'error': str(e)}), 500

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # 查询用户是否存在
        cursor.execute("SELECT * FROM users WHERE openid = %s", (openid,))
        user = cursor.fetchone()

        if user:
            # 更新登录时间
            cursor.execute("UPDATE users SET last_login_time = %s WHERE id = %s", (datetime.utcnow(), user['id']))
        else:
            # 创建用户（默认激活）
            cursor.execute("""
                INSERT INTO users (openid, unionid, user_role, is_active, created_at, last_login_time, nickname, avatar_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                openid,
                unionid,
                'user',
                1,  # 默认激活
                datetime.utcnow(),
                datetime.utcnow()  + timedelta(hours=8),
                nickname,
                avatar_url
            ))
            conn.commit()
            cursor.execute("SELECT * FROM users WHERE openid = %s", (openid,))
            user = cursor.fetchone()

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            'code': 0,
            'msg': '登录成功',
            'user': {
                'id': user['id'],
                'openid': user['openid'],
                'user_role': user['user_role'],
                'nickname': user.get('nickname'),
                'avatar_url': user.get('avatar_url'),
                'create_time': user['created_at'].isoformat() if user['created_at'] else None
            }
        })

    except Exception as e:
        return jsonify({'code': 4, 'msg': '数据库处理失败', 'error': str(e)}), 500
