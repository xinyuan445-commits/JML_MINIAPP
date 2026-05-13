from datetime import datetime

from fastapi import FastAPI, HTTPException
import pyodbc

app = FastAPI(title="Internal DB API")

# 配置你的数据库连接信息
# 建议使用 Windows 身份验证或特定的 SQL 账户
DB_CONFIG = {
    "server": "172.16.1.9", # 或者你的数据库 IP
    "database": "master",  # 初始测试可以用 master
    "uid": "sa",           # 你的用户名
    "pwd": "Ks123456"       # 你的密码
}

def get_db_connection():
    conn_str = (
        "DRIVER={SQL Server};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={DB_CONFIG['database']};"
        f"UID={DB_CONFIG['uid']};"
        f"PWD={DB_CONFIG['pwd']};"
        )
    try:
        return pyodbc.connect(conn_str, timeout=5)
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return None

@app.get("/sql-time")
async def query_sql_time():
    """查询并返回 SQL Server 的当前系统时间"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="无法连接到内部数据库")
    
    try:
        cursor = conn.cursor()
        # 执行查询时间的 SQL
        cursor.execute("SELECT GETDATE() AS CurrentTime")
        row = cursor.fetchone()
        sql_time = row[0] if row else None
        
        return {
            "status": "success",
            "server": DB_CONFIG['server'],
            "sql_server_time": sql_time.strftime("%Y-%m-%d %H:%M:%S") if sql_time else "N/A",
            "local_api_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    # 监听 8080 端口
    uvicorn.run(app, host="127.0.0.1", port=8080)