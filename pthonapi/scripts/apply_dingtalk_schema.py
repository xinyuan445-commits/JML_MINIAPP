import os
import sys


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from models.db2 import get_db2  # noqa: E402


def apply_schema(sql_path):
    with open(sql_path, "r", encoding="utf-8") as sql_file:
        statements = [
            statement.strip()
            for statement in sql_file.read().split(";")
            if statement.strip()
        ]

    conn = get_db2()
    try:
        cur = conn.cursor()
        for statement in statements:
            cur.execute(statement)
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return len(statements)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("用法: python scripts/apply_dingtalk_schema.py <sql文件>", file=sys.stderr)
        raise SystemExit(2)
    count = apply_schema(os.path.abspath(sys.argv[1]))
    print(f"钉钉通讯录表结构执行完成，共 {count} 条语句")

