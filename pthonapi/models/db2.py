import os
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling

# 载入环境变量
load_dotenv()

# 第二个数据库配置（MySQL: wecom-db）
db2config = {
    "host": os.getenv("DB2_HOST"),
    "user": os.getenv("DB2_USER"),
    "password": os.getenv("DB2_PASSWORD"),
    "database": os.getenv("DB2_NAME"),
    "charset": "utf8mb4"
}

# 创建连接池
connection_pool_db2 = mysql.connector.pooling.MySQLConnectionPool(
    pool_name=os.getenv("DB2_POOL_NAME", "mypool2"),
    pool_size=int(os.getenv("DB2_POOL_SIZE", 15)),
    pool_reset_session=True, # 关键：获取连接时重置会话，确保连接可用
    **db2config
)

def get_db2():
    """
    从第二个连接池中获取连接
    使用完毕后需要手动关闭：conn.close()
    """
    return connection_pool_db2.get_connection()

# 可选：测试连接（仅调试时用）
if __name__ == "__main__":
    try:
        conn = get_db2()
        cursor = conn.cursor()
        cursor.execute("SELECT DATABASE();")
        result = cursor.fetchone()
        print(f"✅ 成功连接到数据库: {result[0]}")
    except Exception as e:
        print("❌ 连接失败:", e)
    finally:
        if conn:
            conn.close()
