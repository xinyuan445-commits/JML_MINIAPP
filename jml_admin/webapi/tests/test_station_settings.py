from copy import deepcopy

import pytest

import app as webapp
from test_admin_permissions import client_for_admin
from test_station_permissions import BASE, client_for_global_admin, connect, isolated

PATH = BASE + '/settings/save'


def test_toggle_is_persisted_reflected_in_reads_and_audited(monkeypatch):
    db = connect(monkeypatch)
    client = client_for_global_admin()
    initial = client.get(BASE).json['data']
    assert initial['enforcement_enabled'] is False and initial['report_access_mode'] == 'exempt'
    assert initial['setting_revision'] == 0
    assert client.post(PATH, json={'enabled': True, 'revision': 0}).status_code == 200
    assert client.get(BASE).json['data']['enforcement_enabled'] is True
    assert client.post(PATH, json={'enabled': False, 'revision': 1}).status_code == 200
    assert client.get(BASE).json['data']['enforcement_enabled'] is False
    audits = [p for q, p in db.calls if 'INSERT INTO mo_admin_audit_log_yx' in q]
    assert [p[1] for p in audits] == ['开启工站权限', '关闭工站权限']
    assert all(p[0] == 'admin' for p in audits)
    assert not db.configs


def test_report_access_mode_is_saved_without_changing_station_switch(monkeypatch):
    db = connect(monkeypatch)
    response = client_for_global_admin().post(PATH, json={
        'enabled': False, 'report_access_mode': 'station', 'revision': 0,
    })
    assert response.status_code == 200
    assert response.json['data'] == {'id': 1, 'enforcement_enabled': False,
        'report_access_mode': 'station', 'setting_revision': 1}
    assert db.setting == {'enabled': 0, 'report_access_mode': 'station', 'revision': 1}
    audits = [p for q, p in db.calls if 'INSERT INTO mo_admin_audit_log_yx' in q]
    assert audits[-1][1] == '设置小程序报表开放范围'


def test_old_switch_request_preserves_saved_report_access_mode(monkeypatch):
    db = connect(monkeypatch)
    db.setting['report_access_mode'] = 'station'
    response = client_for_global_admin().post(PATH, json={'enabled': True, 'revision': 0})
    assert response.status_code == 200
    assert db.setting['report_access_mode'] == 'station'


def test_only_manage_permission_can_toggle(monkeypatch):
    db = connect(monkeypatch, manage=False)
    assert webapp.app.test_client().post(PATH, json={'enabled': True, 'revision': 0}).status_code == 401
    assert client_for_global_admin().post(PATH, json={'enabled': True, 'revision': 0}).status_code == 403
    assert db.setting['enabled'] == 0


def test_non_admin_cannot_change_global_settings_even_with_manage_permission(monkeypatch):
    db = connect(monkeypatch)
    assert client_for_admin().post(PATH, json={'enabled': True, 'revision': 0}).status_code == 403
    assert db.setting['enabled'] == 0


@pytest.mark.parametrize('body', [[], {}, {'enabled': 1, 'revision': 0}, {'enabled': True, 'revision': True},
    {'enabled': True, 'revision': -1}, {'enabled': True, 'revision': 4}, {'enabled': True, 'revision': 0, 'user_id': 'fake'}])
def test_invalid_and_stale_toggle_rejected(monkeypatch, body):
    db = connect(monkeypatch)
    assert client_for_global_admin().post(PATH, json=body).status_code == 400
    assert db.setting == {'enabled': 0, 'report_access_mode': 'exempt', 'revision': 0}


@pytest.mark.parametrize('mode', ['', 'users', None, True])
def test_invalid_report_access_mode_rejected(monkeypatch, mode):
    db = connect(monkeypatch)
    response = client_for_global_admin().post(PATH, json={
        'enabled': False, 'report_access_mode': mode, 'revision': 0,
    })
    assert response.status_code == 400
    assert db.setting['report_access_mode'] == 'exempt'


def test_audit_failure_rolls_back_switch(monkeypatch):
    db = connect(monkeypatch)
    before = deepcopy(db.setting)
    db.fail_audit = True
    assert client_for_global_admin().post(PATH, json={'enabled': True, 'revision': 0}).status_code == 503
    assert db.setting == before


def test_migration_is_idempotent_and_never_enables_existing_installation():
    from pathlib import Path
    sql = Path(__file__).resolve().parents[1].joinpath('station_access_settings.sql').read_text(encoding='utf-8')
    assert 'CREATE TABLE IF NOT EXISTS' in sql
    assert "report_access_mode ENUM('exempt','station','all')" in sql
    assert 'INSERT IGNORE' in sql and "VALUES (1,0,'exempt',0)" in sql
    assert 'UPDATE mo_station_access_setting_yx' not in sql
