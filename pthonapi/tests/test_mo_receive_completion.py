import sqlite3
from datetime import datetime

import pytest
from flask import Flask

from routes import mo
from services.mo_quantity_rules import DEFAULT_SETTINGS


class ReceiptDatabase:
    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = lambda cur, row: dict(zip((col[0] for col in cur.description), row))
        self.db.executescript('''
            CREATE TABLE mo_execution_yx (id INTEGER PRIMARY KEY, mo_code, sort_seq, route_id, seq,
                process_name, station_id, station_name, status, qty_done, qty_a, qty_a1, qty_a2, qty_c,
                complete_reason, complete_photo_url, end_time);
            INSERT INTO mo_execution_yx VALUES (1,'TEST',2,1,2,'修色',1,'修色','done',18,16,0,0,2,NULL,NULL,NULL);
            CREATE TABLE mo_handover_yx (id INTEGER PRIMARY KEY, mo_code, sort_seq, route_id, from_seq,
                qty_out, qty_out_a, qty_out_a1, qty_out_a2, qty_in, qty_in_a, qty_in_a1, qty_in_a2,
                status, confirm_time, operator_in, receipt_reason);
            INSERT INTO mo_handover_yx VALUES (1,'TEST',2,1,1,67,67,0,0,18,18,0,0,'confirmed',NULL,NULL,NULL);
            INSERT INTO mo_handover_yx VALUES (2,'TEST',2,1,2,16,16,0,0,16,16,0,0,'confirmed',NULL,NULL,NULL);
            CREATE TABLE mo_receive_work_yx (id INTEGER PRIMARY KEY, execution_id, handover_id, mo_code,
                sort_seq, route_id, seq, qty_input, qty_input_a, qty_input_a1, qty_input_a2,
                qty_a, qty_a1, qty_a2, qty_c, reason, operator_id, operator_name, status, end_time, complete_photo_url);
            INSERT INTO mo_receive_work_yx VALUES (31,1,1,'TEST',2,1,2,49,49,0,0,0,0,0,0,NULL,'u','员工','processing',NULL,NULL);
            CREATE TABLE mo_makeup_record_yx (execution_id, mo_code, sort_seq, seq, qty_before, qty_add, qty_after,
                plan_qty, reason, operator_id, operator_name);
            CREATE TABLE mo_execution_completion_yx (id INTEGER PRIMARY KEY, execution_id, qty_a, qty_a1, qty_a2,
                qty_c, qty_done, reason, photo_url, quality_report_photo_urls, operator_id, operator_name, is_final, complete_time);
            CREATE TABLE mo_rework_yx (id INTEGER PRIMARY KEY, source_execution_id, mo_code, sort_seq,
                route_id, seq, qty_input, qty_a, qty_a1, qty_a2, qty_c, complete_photo_url, complete_remark, status, end_time);
            INSERT INTO mo_rework_yx VALUES (2,1,'TEST',2,1,2,2,0,0,0,0,NULL,NULL,'processing',NULL);
            CREATE TABLE mo_rework_completion_yx (id INTEGER PRIMARY KEY, rework_id, qty_a, qty_a1, qty_a2,
                qty_c, qty_done, remark, photo_url, quality_report_photo_urls, operator_id, operator_name, is_final, complete_time);
        ''')

    def cursor(self, dictionary=False):
        return self

    def execute(self, sql, params=()):
        sql = ' '.join(sql.split()).replace(' FOR UPDATE', '').replace('%s', '?')
        if sql.startswith('UPDATE mo_handover_yx') and sql.endswith('ORDER BY id DESC LIMIT 1'):
            set_clause, where_clause = sql.split(' WHERE ', 1)
            sql = f'{set_clause} WHERE id=(SELECT id FROM mo_handover_yx WHERE {where_clause})'
        self.current = self.db.execute(sql, tuple(
            value.isoformat(sep=' ') if isinstance(value, datetime) else value for value in params
        ))

    def fetchone(self):
        return self.current.fetchone()

    @property
    def rowcount(self):
        return self.current.rowcount

    @property
    def lastrowid(self):
        return self.current.lastrowid

    def commit(self):
        self.db.commit()

    def rollback(self):
        self.db.rollback()

    def close(self):
        pass


@pytest.mark.parametrize('combined', [False, True])
def test_receive_49_can_report_40_then_9(monkeypatch, combined):
    db = ReceiptDatabase()
    app = Flask(__name__)
    monkeypatch.setattr(mo, 'get_db2', lambda: db)
    monkeypatch.setattr(mo, '_quantity_rule_settings', lambda *_: dict.fromkeys(DEFAULT_SETTINGS, True))
    monkeypatch.setattr(mo, 'write_operation_log', lambda *_args, **_kwargs: None)

    def post(handler, body):
        with app.test_request_context(method='POST', json=body):
            return handler().get_json()

    first = {'receive_id': 31, 'qty_a': 40, 'expected_completed_qty': 0}
    if combined:
        result = post(mo.complete_combined, {
            'exec_id': 1, 'normal_type': 'receive', 'normal': first,
            'rework': {'rework_id': 2, 'qty_a': 1},
        })
    else:
        result = post(mo.complete_receive_work, first)
    assert result['code'] == 0, result['msg']
    partial = result['data']
    assert partial['is_partial'] and partial['completed_qty'] == 40 and partial['remaining_qty'] == 9
    assert db.db.execute('SELECT qty_in FROM mo_handover_yx WHERE id=1').fetchone()['qty_in'] == 18
    first_transfer = 16 + 40 + int(combined)
    assert db.db.execute('SELECT qty_out FROM mo_handover_yx WHERE id=2').fetchone()['qty_out'] == first_transfer
    assert not db.db.execute('SELECT * FROM mo_makeup_record_yx').fetchall()

    for qty, expected, error in [(5, 0, '请刷新'), (10, 40, '剩余9件')]:
        rejected = post(mo.complete_receive_work, {'receive_id': 31, 'qty_a': qty, 'expected_completed_qty': expected})
        assert rejected['code'] == 1 and error in rejected['msg']
    final = post(mo.complete_receive_work, {'receive_id': 31, 'qty_a': 9, 'expected_completed_qty': 40})
    assert final['code'] == 0, final['msg']
    assert final['data']['remaining_qty'] == 0 and final['data']['completed_qty'] == 49
    assert db.db.execute('SELECT qty_in FROM mo_handover_yx WHERE id=1').fetchone()['qty_in'] == 67
    assert db.db.execute('SELECT qty_out FROM mo_handover_yx WHERE id=2').fetchone()['qty_out'] == first_transfer + 9
    assert db.db.execute('SELECT qty_done FROM mo_execution_yx').fetchone()['qty_done'] == 67
    assert db.db.execute('SELECT qty_add FROM mo_makeup_record_yx').fetchall() == [{'qty_add': 49}]
    assert db.db.execute('SELECT qty_done,is_final FROM mo_execution_completion_yx ORDER BY id').fetchall() == [
        {'qty_done': 40, 'is_final': 0}, {'qty_done': 9, 'is_final': 1},
    ]
    assert db.db.execute('SELECT status FROM mo_receive_work_yx').fetchone()['status'] == 'done'
    db.db.close()
