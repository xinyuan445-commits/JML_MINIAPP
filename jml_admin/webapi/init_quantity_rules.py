from pathlib import Path

from app import db


def main():
    statements = [item.strip() for item in Path(__file__).with_name("quantity_rules.sql").read_text(encoding="utf-8").split(";") if item.strip()]
    conn = db()
    cur = conn.cursor()
    try:
        for statement in statements:
            cur.execute(statement)
        conn.commit()
        print("报工数量规则初始化完成（所有开关默认关闭）")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
