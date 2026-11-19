"""Initialize the cover and system administrator permissions without replacing saved content."""
import json
from pathlib import Path

from material_coding_cover import normalize_cover


def initialize(conn):
    source = Path(__file__).with_name("material_coding_cover_seed.json")
    cover = normalize_cover(json.loads(source.read_text(encoding="utf-8")))
    with conn.cursor(dictionary=True) as cur:
        cur.execute("""CREATE TABLE IF NOT EXISTS mo_material_coding_cover_yx (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            title VARCHAR(240) NOT NULL,
            created_by VARCHAR(120) NOT NULL,
            modified_by VARCHAR(120) NOT NULL,
            change_history JSON NOT NULL,
            revision INT UNSIGNED NOT NULL DEFAULT 1,
            updated_by VARCHAR(120) NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""")
        cur.execute("""INSERT INTO mo_material_coding_cover_yx
            (id,title,created_by,modified_by,change_history,updated_by)
            VALUES (1,%s,%s,%s,%s,'初始化') ON DUPLICATE KEY UPDATE id=id""",
                    (cover["title"], cover["created_by"], cover["modified_by"],
                     json.dumps(cover["changes"], ensure_ascii=False)))
        cur.execute("SELECT permissions FROM mo_admin_role_yx WHERE code='system-admin' FOR UPDATE")
        role = cur.fetchone()
        if role:
            permissions = role["permissions"]
            current = set(json.loads(permissions) if isinstance(permissions, str) else permissions)
            granted = current | {"material-coding.view", "material-coding.edit"}
            if granted != current:
                cur.execute("UPDATE mo_admin_role_yx SET permissions=%s WHERE code='system-admin'",
                            (json.dumps(sorted(granted)),))
    conn.commit()


if __name__ == "__main__":
    from app import db
    with db() as connection:
        initialize(connection)
    print("物料编码规则封面初始化完成。")
