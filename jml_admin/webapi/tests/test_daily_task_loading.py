from datetime import datetime
from unittest.mock import MagicMock

import app as webapp


def test_daily_open_orders_are_fresh_keys_only_and_use_same_erp_filter(monkeypatch):
    connection = MagicMock()
    cursor = connection.cursor.return_value
    cursor.description = [('MoCode_a',), ('SortSeq_b',)]
    cursor.fetchall.return_value = [('MO1', 2)]
    monkeypatch.setattr(webapp, 'u8_db', lambda: connection)
    fallback = MagicMock()
    monkeypatch.setattr(webapp, '_workorder_info_map', fallback)
    result, available = webapp._daily_task_open_order_map()
    assert available and result == {('MO1', 2): {'MoCode_a':'MO1','SortSeq_b':2}}
    sql = cursor.execute.call_args.args[0]
    assert 'RelsDate_b IS NOT NULL' in sql and 'CloseDate_b IS NULL' in sql
    assert 'JOIN' not in sql
    fallback.assert_not_called()
    cursor.close.assert_called_once()
    connection.close.assert_called_once()
    cursor.fetchall.return_value = []
    assert webapp._daily_task_open_order_map() == ({}, True)
    assert cursor.execute.call_count == 2


def test_daily_open_orders_fall_back_to_existing_source_without_claiming_success(monkeypatch):
    monkeypatch.setattr(webapp, 'u8_db', MagicMock(side_effect=RuntimeError('offline')))
    fallback = MagicMock(return_value=({}, False))
    monkeypatch.setattr(webapp, '_workorder_info_map', fallback)
    assert webapp._daily_task_open_order_map() == ({}, False)
    fallback.assert_called_once()


def test_daily_key_loader_still_runs_full_live_product_and_reporting_lookup(monkeypatch):
    connection = MagicMock()
    monkeypatch.setattr(webapp, 'db', lambda: connection)
    reporting = MagicMock(return_value={'states':[]})
    monkeypatch.setattr(webapp, 'load_operation_rows', reporting)
    monkeypatch.setattr(webapp, 'tracked_order_rows', lambda data: [])
    loader = MagicMock(return_value=({('MO1',2):{'MoCode_a':'MO1','SortSeq_b':2}}, True))
    default = MagicMock()
    monkeypatch.setattr(webapp, '_workorder_info_map', default)
    products = {('MO1',2):{'first_issued_qty':0.5,'plan_qty':10}}
    lookup = MagicMock(return_value=(products,[]))
    monkeypatch.setattr(webapp, '_dashboard_product_context', lookup)
    include = MagicMock()
    monkeypatch.setattr(webapp, 'include_unreported_orders', include)
    build = MagicMock(return_value={'orders':[]})
    monkeypatch.setattr(webapp, 'build_operations_snapshot', build)
    now = datetime(2026,11,11,12)
    webapp._current_operations_snapshot(now, open_orders_loader=loader)
    loader.assert_called_once()
    default.assert_not_called()
    reporting.assert_called_once_with(connection, now)
    lookup.assert_called_once_with([{'mo_code':'MO1','sort_seq':2}])
    assert products[('MO1',2)]['first_issued_qty'] == 0.5
    assert products[('MO1',2)]['erp_open'] is True
    include.assert_called_once()
    build.assert_called_once()
