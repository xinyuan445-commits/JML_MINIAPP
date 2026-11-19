"""Explicit migration only. Never invoked by application startup.

Only --apply loads the explicitly named existing config file. No app import.
"""
import argparse
import os

from sqlalchemy import create_engine, inspect, text, URL
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects.mysql import dialect
from .schema import metadata

ACCOUNT_COLUMNS = {
    "staff_id": "VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL",
    "staff_binding_revision": "INT NOT NULL DEFAULT 0",
    "staff_bound_by": "BIGINT NULL",
    "staff_bound_at": "DATETIME(6) NULL",
}

GRANT_COLUMNS = {
    "qualification_source": "VARCHAR(16) NOT NULL DEFAULT 'station'",
    "review_staff_ids": "JSON NULL",
    "reviewer_task": "BIGINT GENERATED ALWAYS AS (CASE WHEN grant_type='self_review' AND revoked_at IS NULL THEN task_id ELSE NULL END) VIRTUAL",
}


def migrate(engine):
    if engine.dialect.name != "mysql":
        raise ValueError("Production migration requires MySQL; SQLite is used only by isolated tests")
    required = {"jml_staff", "mo_workstation_yx", "mo_station_staff_config_yx", "mo_station_staff_exemption_yx", "mo_admin_account_yx", "mo_daily_task_sheet_yx"}
    missing = required - set(inspect(engine).get_table_names())
    if missing:
        raise ValueError("Missing prerequisites: " + ",".join(sorted(missing)))
    # MySQL DDL commits implicitly; each operation is repeatable after interruption.
    metadata.create_all(engine)
    with engine.begin() as connection:
        existing_grants = {c["name"] for c in inspect(connection).get_columns("mo_nonorder_manager_grant_yx")}
        for name, definition in GRANT_COLUMNS.items():
            if name not in existing_grants:
                connection.execute(text(f"ALTER TABLE mo_nonorder_manager_grant_yx ADD COLUMN {name} {definition}"))
        grant_indexes = {i["name"] for i in inspect(connection).get_indexes("mo_nonorder_manager_grant_yx")}
        if "uq_nonorder_reviewer" not in grant_indexes:
            connection.execute(text("CREATE UNIQUE INDEX uq_nonorder_reviewer ON mo_nonorder_manager_grant_yx(reviewer_task)"))
        existing = {c["name"] for c in inspect(connection).get_columns("mo_admin_account_yx")}
        for name, definition in ACCOUNT_COLUMNS.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE mo_admin_account_yx ADD COLUMN {name} {definition}"))
        indexes = {i["name"] for i in inspect(connection).get_indexes("mo_admin_account_yx")}
        if "uq_admin_nonorder_staff" not in indexes:
            connection.execute(text("CREATE UNIQUE INDEX uq_admin_nonorder_staff ON mo_admin_account_yx(staff_id)"))
        foreign_keys = {f["name"] for f in inspect(connection).get_foreign_keys("mo_nonorder_daily_item_yx")}
        if "fk_nonorder_daily_sheet" not in foreign_keys:
            connection.execute(text("""ALTER TABLE mo_nonorder_daily_item_yx ADD CONSTRAINT fk_nonorder_daily_sheet
                FOREIGN KEY (sheet_id) REFERENCES mo_daily_task_sheet_yx(id) ON DELETE RESTRICT"""))


def main():
    parser = argparse.ArgumentParser(description="Nonorder schema; prints SQL unless explicitly applied")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--config-env", help="Existing PythonAPI or WebAPI .env path; never copied or printed")
    parser.add_argument("--database-name", help="Must exactly match DB2_NAME from the existing configuration")
    args = parser.parse_args()
    if not args.apply:
        for table in metadata.sorted_tables:
            print(str(CreateTable(table).compile(dialect=dialect())) + ";")
            for index in table.indexes:
                print(str(CreateIndex(index).compile(dialect=dialect())) + ";")
        return
    if not args.config_env:
        raise SystemExit("Explicit --config-env pointing to an existing config is required")
    from pathlib import Path
    from dotenv import dotenv_values
    config_path = Path(args.config_env)
    if not config_path.is_file():
        raise SystemExit("Configuration file does not exist")
    values = {**dotenv_values(config_path), **os.environ}
    required = ("DB2_HOST", "DB2_USER", "DB2_PASSWORD", "DB2_NAME")
    if any(not values.get(key) for key in required):
        raise SystemExit("Existing configuration is missing DB2 settings")
    engine = create_engine(URL.create("mysql+mysqlconnector", username=values["DB2_USER"], password=values["DB2_PASSWORD"],
                                     host=values["DB2_HOST"], database=values["DB2_NAME"]))
    if not args.database_name or args.database_name != engine.url.database:
        raise SystemExit("Explicit matching --database-name required")
    migrate(engine)


if __name__ == "__main__":
    main()
