"""创建独立的现场报工路线V2，并切换产品默认映射。

报价/成本表 bj_* 不做任何修改。默认预览，传入 --apply 才提交。
已有执行记录和工单手工路线绑定不会修改。
"""

import argparse
import hashlib
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from models.db2 import get_db2  # noqa: E402


REPORTING_ROUTES = {
    "04": ["修补", "肤感烤漆（含覆膜）"],
    "05": ["修补", "肤感烤漆（含覆膜）"],
    "06": ["修补", "肤感烤漆（含覆膜）"],
    "07": ["HPL三胺基材粘贴垫板", "肤感烤漆（含覆膜）", "裁切修边"],
    "10": ["HPL三胺基材粘贴垫板", "木皮压贴（水胶）", "裁切修边"],
    "11": ["拼皮", "木皮压贴（水胶）", "拉丝", "修补"],
    "12": ["水性", "修色", "木皮打印（含覆膜）"],
    "13": ["水性", "修色", "木皮打印（含覆膜）"],
    "14": ["水性", "修色", "木皮打印（含覆膜）"],
    "15": [
        "HPL素板粘贴垫板", "水性", "修色", "木皮打印（含覆膜）", "防火板脱胶",
        "防火板砂光", "裁切修边", "手工覆膜",
    ],
    "16": ["水性", "修色", "木皮打印（含覆膜）", "倒角"],
    "17": ["修补", "木皮打印（含覆膜）"],
    "18": ["修补", "木皮打印（含覆膜）"],
    "19": ["HPL三胺基材粘贴垫板", "木皮打印（含覆膜）", "裁切修边"],
}


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
        """INSERT INTO mo_process_yx
           (process_code,process_name,description,sort,is_active)
           VALUES (%s,%s,%s,%s,1)""",
        (stable_code("AUTO", name), name, "报工路线V2自动创建", sort),
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
        """INSERT INTO mo_workstation_yx
           (station_code,station_name,description,is_active)
           VALUES (%s,%s,%s,1)""",
        (stable_code("WS-AUTO", name), name, "报工路线V2默认同名工站"),
    )
    return cur.lastrowid


def apply_routes(apply=False):
    conn = get_db2()
    cur = conn.cursor(dictionary=True, buffered=True)
    try:
        for product_code, process_names in REPORTING_ROUTES.items():
            cur.execute(
                "SELECT name FROM bj_product_cost_yx WHERE code=%s AND is_enabled=1",
                (product_code,),
            )
            product = cur.fetchone()
            if not product:
                raise RuntimeError(f"产品类别不存在或已停用: {product_code}")

            route_code = f"RT-PROD-{product_code}-MO-V2"
            route_name = f"{product['name']}报工路线V2"
            cur.execute("SELECT id FROM mo_route_yx WHERE route_code=%s", (route_code,))
            route = cur.fetchone()
            if route:
                route_id = route["id"]
                cur.execute("SELECT 1 FROM mo_execution_yx WHERE route_id=%s LIMIT 1", (route_id,))
                if cur.fetchone():
                    raise RuntimeError(f"V2路线已有执行记录，禁止覆盖: {product_code}")
                cur.execute("SELECT id FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
                step_ids = [row["id"] for row in cur.fetchall()]
                if step_ids:
                    marks = ",".join(["%s"] * len(step_ids))
                    cur.execute(f"DELETE FROM mo_step_station_yx WHERE step_id IN ({marks})", step_ids)
                cur.execute("DELETE FROM mo_route_step_yx WHERE route_id=%s", (route_id,))
                cur.execute(
                    "UPDATE mo_route_yx SET route_name=%s,description=%s,is_active=1 WHERE id=%s",
                    (route_name, "独立现场报工路线，不参与报价成本计算", route_id),
                )
            else:
                cur.execute(
                    """INSERT INTO mo_route_yx
                       (route_code,route_name,dept_code,description,is_active,is_default)
                       VALUES (%s,%s,'',%s,1,0)""",
                    (route_code, route_name, "独立现场报工路线，不参与报价成本计算"),
                )
                route_id = cur.lastrowid

            for seq, process_name in enumerate(process_names, 1):
                process_id = get_or_create_process(cur, process_name, seq)
                station_id = get_or_create_station(cur, process_name)
                cur.execute(
                    "INSERT INTO mo_route_step_yx (route_id,seq,process_id) VALUES (%s,%s,%s)",
                    (route_id, seq, process_id),
                )
                step_id = cur.lastrowid
                cur.execute(
                    "INSERT INTO mo_step_station_yx (step_id,station_id) VALUES (%s,%s)",
                    (step_id, station_id),
                )

            cur.execute(
                """INSERT INTO mo_product_route_yx (product_code,route_id)
                   VALUES (%s,%s)
                   ON DUPLICATE KEY UPDATE route_id=VALUES(route_id)""",
                (product_code, route_id),
            )
            print(f"{product_code} {product['name']}: {' → '.join(process_names)}")

        if apply:
            conn.commit()
        else:
            conn.rollback()
        print("模式：" + ("提交" if apply else "预览回滚"))
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    apply_routes(args.apply)
