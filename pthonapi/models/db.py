import os
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import pooling

load_dotenv()

# 数据库配置基类
def get_config(prefix="DB_"):
    return {
        "host": os.getenv(f"{prefix}HOST"),
        "user": os.getenv(f"{prefix}USER"),
        "password": os.getenv(f"{prefix}PASSWORD"),
        "database": os.getenv(f"{prefix}NAME"),
        "charset": "utf8mb4",
        "raise_on_warnings": True
    }

# 优化后的连接池初始化
# 建议 pool_size 设为 10-15，确保大于 Gunicorn 的总线程数
connection_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name=os.getenv("DB_POOL_NAME", "mypool"),
    pool_size=15, 
    pool_reset_session=True, # 关键：取连接时重置 session，防止“MySQL Server has gone away”
    **get_config("DB_")
)

def get_db():
    """
    从连接池获取连接
    注意：在 Flask 路由中必须配合 try...finally 使用 conn.close() 归还连接
    """
    return connection_pool.get_connection()

# import os 
# from dotenv import load_dotenv
# import mysql.connector
# from mysql.connector import pooling


# load_dotenv()

# dbconfig = {
#     "host": os.getenv("DB_HOST"),
#     "user": os.getenv("DB_USER"),
#     "password": os.getenv("DB_PASSWORD"),
#     "database": os.getenv("DB_NAME"),
#     "charset": "utf8mb4"
# }

# connection_pool = mysql.connector.pooling.MySQLConnectionPool(
#     pool_name= os.getenv("DB_POOL_NAME","mypool"),
#     pool_size= int(os.getenv("DB_POOL_SIZE",5)),
#     **dbconfig
# )

# def get_db():
#     return connection_pool.get_connection()