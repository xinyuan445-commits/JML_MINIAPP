"""把产品完整工艺路线同步为现场生产路线。

数据源：bj_product_cost_yx.route_desc
目标：mo_process_yx / mo_workstation_yx / mo_route_yx / mo_route_step_yx
      / mo_step_station_yx / mo_product_route_yx

默认只预览；传入 --apply 才提交数据库。
"""

import argparse
import hashlib
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models.db2 import get_db2  # noqa: E402


NON_PROCESS_NODES = {"打托入库", "打包入库", "外购", "成品"}


def split_route(route_desc):
    return [
        name.strip()
        for name in (route_desc or "").split("→")
        if name.strip() and name.strip() not in NON_PROCESS_NODES
    ]


def stable_code(prefix, name):
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:12].upper()
    return f"{prefix}-{digest}"


def get_or_create_process(cur, name, sort):
    cur.execute(
        "SELECT id FROM mo_process_yx WHERE TRIM(process_name)=TRIM(%s) ORDER BY id LIMIT 1",
        (name,),
    )
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute(
        """
        INSERT INTO mo_process_yx
          (process_code,process_name,description,sort,is_active)
        VALUES (%s,%s,%s,%s,1)
        """,
        (stable_code("AUTO", name), name, "由产品完整工艺路线自动创建", sort),
    )
    return cur.lastrowid


def get_or_create_station(cur, name):
    cur.execute(
        "SELECT id FROM mo_workstation_yx WHERE TRIM(station_name)=TRIM(%s) ORDER BY id LIMIT 1",
        (name,),
    )
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute(
        """
        INSERT INTO mo_workstation_yx
          (station_code,station_name,description,is_active)
        VALUES (%s,%s,%s,1)
        """,
        (stable_code("WS-AUTO", name), name, "默认同名工站"),
    )
    return cur.lastrowid


def get_or_create_route(cur, product):
    route_code = f"RT-PROD-{product['code']}"
    route_name = f"{product['name']}生产路线"
    cur.execute("SELECT id FROM mo_route_yx WHERE route_code=%s", (route_code,))
    row = cur.fetchone()
    if row:
        cur.execute(
            """
            UPDATE mo_route_yx
            SET route_name=%s,description=%s,is_active=1,update_time=NOW()
            WHERE id=%s
            """,
            (route_name, "由产品完整工艺路线生成，已排除入库和来源节点", row["id"]),
        )
        return row["id"]
    cur.execute(
        """
        INSERT INTO mo_route_yx
          (route_code,route_name,dept_code,description,is_active,is_default)
        VALUES (%s,%s,'',%s,1,0)
        """,
        (route_code, route_name, "由产品完整工艺路线生成，已排除入库和来源节点"),
    )
    return cur.lastrowid


def has_execution(cur, route_id):
    cur.execute("SELECT 1 FROM mo_execution_yx WHERE route_id=%s LIMIT 1", (route_id,))
    return cur.fetchone() is not None


def replace_steps(cur, route_id, process_names):
    cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
    step_ids = [row["id"] for row in cur.fetchall()]
    if step_ids:
        marks = ",".join(["%s"] * len(step_ids))
        cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({marks})", step_ids)
    cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))

    for seq, name in enumerate(process_names, 1):
        process_id = get_or_create_process(cur, name, seq)
        station_id = get_or_create_station(cur, name)
        cur.execute(
            "INSERT INTO mo_route_step_yx (route_id,seq,process_id) VALUES (%s,%s,%s)",
            (route_id, seq, process_id),
        )
        cur.execute(
            "INSERT INTO mo_step_station_yx (step_id,station_id) VALUES (%s,%s)",
            (cur.lastrowid, station_id),
        )


def sync(apply=False):
    conn = get_db2()
    cur = conn.cursor(dictionary=True, buffered=True)
    try:
        cur.execute(
            """
            SELECT code,name,route_desc
            FROM bj_product_cost_yx
            WHERE is_enabled=1 AND route_desc IS NOT NULL AND TRIM(route_desc)<>''
            ORDER BY code
            """
        )
        products = cur.fetchall()
        synced = 0
        skipped = []
        for product in products:
            process_names = split_route(product["route_desc"])
            if not process_names:
                skipped.append((product["code"], "没有可执行工序"))
                continue

            route_id = get_or_create_route(cur, product)
            if has_execution(cur, route_id):
                skipped.append((product["code"], "路线已有执行记录，未覆盖步骤"))
            else:
                replace_steps(cur, route_id, process_names)

            cur.execute(
                """
                INSERT INTO mo_product_route_yx (product_code,route_id)
                VALUES (%s,%s)
                ON DUPLICATE KEY UPDATE route_id=route_id
                """,
                (product["code"], route_id),
            )
            synced += 1
            print(f"{product['code']} {product['name']}: {' → '.join(process_names)}")

        if apply:
            conn.commit()
        else:
            conn.rollback()
        print(f"同步路线：{synced}；跳过：{len(skipped)}；模式：{'提交' if apply else '预览回滚'}")
        for code, reason in skipped:
            print(f"跳过 {code}: {reason}")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="提交同步；不传时仅预览并回滚")
    args = parser.parse_args()
    sync(apply=args.apply)
