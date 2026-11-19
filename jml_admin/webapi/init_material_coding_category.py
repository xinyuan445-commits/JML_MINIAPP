"""Create the shared material coding table and seed pages with supplied rules."""
import json
from pathlib import Path

from material_coding_category import ACCESSORY_PRODUCTS, SUPPLIER_ABBREVIATIONS, VENEER_DESIGN, normalize_category


def initialize(conn):
    seeds = (
        ("samples", "material_coding_samples_seed.json"),
        ("finished-accessories", "material_coding_finished_accessories_seed.json"),
        ("finished", "material_coding_finished_seed.json"),
        ("veneer-finished", "material_coding_veneer_finished_seed.json"),
        ("grooved-finished", "material_coding_grooved_finished_seed.json"),
        ("semi-finished", "material_coding_semi_finished_seed.json"),
        ("semi-finished-accessories", "material_coding_semi_finished_accessories_seed.json"),
        ("veneer-semi-finished", "material_coding_veneer_semi_finished_seed.json"),
        ("balancing-veneer", "material_coding_balancing_veneer_seed.json"),
        ("primary-materials", "material_coding_primary_materials_seed.json"),
        ("secondary-materials", "material_coding_secondary_materials_seed.json"),
        ("fixed-assets", "material_coding_fixed_assets_seed.json"),
        (VENEER_DESIGN, "material_coding_veneer_design_seed.json"),
        (ACCESSORY_PRODUCTS, "material_coding_accessory_products_seed.json"),
        (SUPPLIER_ABBREVIATIONS, "material_coding_supplier_abbreviations_seed.json"),
    )
    with conn.cursor() as cur:
        cur.execute("""CREATE TABLE IF NOT EXISTS mo_material_coding_category_yx (
            page_key VARCHAR(64) NOT NULL PRIMARY KEY,
            content JSON NOT NULL,
            revision INT UNSIGNED NOT NULL DEFAULT 1,
            updated_by VARCHAR(120) NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")
        for page_key, filename in seeds:
            source = Path(__file__).with_name(filename)
            content = normalize_category(json.loads(source.read_text(encoding="utf-8")), page_key)
            cur.execute("""INSERT INTO mo_material_coding_category_yx (page_key,content,updated_by)
                VALUES (%s,%s,'初始化') ON DUPLICATE KEY UPDATE page_key=page_key""",
                        (page_key, json.dumps(content, ensure_ascii=False)))
    conn.commit()


if __name__ == "__main__":
    from app import db
    with db() as connection:
        initialize(connection)
    print("物料编码规则分类初始化完成。")
