from unittest.mock import MagicMock

from init_station_report_access_mode import initialize


def test_migration_adds_default_exempt_column_once():
    database = MagicMock()
    cur = database.cursor.return_value
    cur.fetchone.side_effect = [
        {'total': 0},
        {'report_access_mode': 'exempt'},
    ]
    assert initialize(database) == {'created': True, 'report_access_mode': 'exempt'}
    statements = [call.args[0] for call in cur.execute.call_args_list]
    assert sum('ALTER TABLE mo_station_access_setting_yx' in sql for sql in statements) == 1
    database.commit.assert_called_once()


def test_migration_keeps_existing_mode_without_alter():
    database = MagicMock()
    cur = database.cursor.return_value
    cur.fetchone.side_effect = [
        {'total': 1},
        {'report_access_mode': 'station'},
    ]
    assert initialize(database) == {'created': False, 'report_access_mode': 'station'}
    assert not any('ALTER TABLE' in call.args[0] for call in cur.execute.call_args_list)
