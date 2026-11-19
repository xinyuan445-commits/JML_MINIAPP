from unittest.mock import MagicMock

import pytest

import app as webapp
import config_approvals


@pytest.mark.parametrize("set_default", [False, True])
def test_new_version_only_replaces_default_when_requested(monkeypatch, set_default):
    cursor = MagicMock()
    source = {
        "id": 10, "version_group": "RT-01", "route_code": "RT-01",
        "route_name": "压贴", "dept_code": "041", "is_default": 0,
    }
    cursor.fetchone.side_effect = [source, {"next_version": 3}]
    # The source may be an older optional version, while V2 is the default.
    cursor.fetchall.return_value = [
        {"id": 10, "is_current": 0, "is_default": 0, "is_active": 1},
        {"id": 20, "is_current": 1, "is_default": 1, "is_active": 1},
    ]
    cursor.lastrowid = 30
    replace_steps = MagicMock()
    sync = MagicMock()
    monkeypatch.setattr(config_approvals, "_replace_route_steps", replace_steps)

    result = config_approvals._execute_route(
        cursor, "version", {"id": 10, "set_default": set_default, "steps": []},
        MagicMock(), sync, lambda name, version: f"{name}V{version}",
    )

    assert result == 30
    statements = [(" ".join(call.args[0].split()), call.args[1:])
                  for call in cursor.execute.call_args_list]
    insert_params = next(args[0] for sql, args in statements if sql.startswith("INSERT INTO mo_route_yx"))
    assert insert_params[7:9] == (int(set_default), int(set_default))
    assert any(sql.startswith("UPDATE mo_route_yx SET is_current=0") for sql, _ in statements) == set_default
    if set_default:
        sync.assert_called_once_with(cursor, 30, "RT-01")
    else:
        sync.assert_not_called()
    assert not any(sql.startswith("UPDATE mo_wo_route_yx") or sql.startswith("UPDATE mo_wo_state_yx")
                   or sql.startswith("UPDATE mo_execution_yx") for sql, _ in statements)
    assert any(sql.startswith("INSERT IGNORE INTO mo_wo_route_yx") for sql, _ in statements) == set_default
    replace_steps.assert_called_once_with(cursor, 30, [])


@pytest.mark.parametrize("is_current", [0, 1])
def test_first_enabled_version_becomes_default_if_no_enabled_default(monkeypatch, is_current):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        {"id": 10, "version_group": "RT-01", "route_name": "压贴"},
        {"next_version": 2},
    ]
    cursor.fetchall.return_value = [{"id": 10, "is_current": is_current, "is_default": 0, "is_active": 0}]
    cursor.lastrowid = 20
    sync = MagicMock()
    monkeypatch.setattr(config_approvals, "_replace_route_steps", MagicMock())
    config_approvals._execute_route(
        cursor, "version", {"id": 10, "set_default": False},
        MagicMock(), sync, lambda name, version: f"{name}V{version}",
    )
    sync.assert_called_once_with(cursor, 20, "RT-01")


def test_disabling_only_route_version_preserves_received_workorders():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [{"is_current": 1, "version_group": "RT-01"}, None]
    sync = MagicMock()

    assert config_approvals._execute_route(
        cursor, "status", {"id": 10, "is_active": 0}, MagicMock(), sync, MagicMock(),
    ) == 10

    assert cursor.execute.call_args_list[1].args[1] == ("RT-01", 10)
    assert cursor.execute.call_args_list[2].args[0].startswith("INSERT IGNORE INTO mo_wo_route_yx")
    assert cursor.execute.call_args.args[0].startswith("UPDATE mo_route_yx SET is_active=")
    assert cursor.execute.call_args.args[1] == (0, 10)
    sync.assert_not_called()


def test_disabling_default_still_requires_switch_when_another_version_exists():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [{"is_current": 1, "version_group": "RT-01"}, {"id": 20}]

    with pytest.raises(ValueError, match="请先将其他版本设为默认"):
        config_approvals._execute_route(
            cursor, "status", {"id": 10, "is_active": 0}, MagicMock(), MagicMock(), MagicMock(),
        )

    assert cursor.execute.call_count == 2


def test_version_default_choice_rejects_invalid_values():
    with pytest.raises(ValueError, match="状态无效"):
        config_approvals._validate_payload("route", "version", {
            "id": 10, "set_default": "false",
            "steps": [{"process_id": 1, "station_id": 1}],
        })


def test_editing_optional_version_does_not_change_automatic_mapping():
    cursor = MagicMock()
    cursor.fetchone.return_value = {"is_current": 0}
    sync = MagicMock()
    config_approvals._replace_route_categories(cursor, 10, ["01"], "RT-01", sync)
    sync.assert_not_called()


@pytest.mark.parametrize("existing_record", [0, 1, 2])
def test_started_or_received_workorder_cannot_change_version(existing_record):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [None] * existing_record + [(10,)]
    with pytest.raises(ValueError, match="已接收或开工"):
        webapp._assert_workorder_route_changeable(cursor, "MO-TEST", 1)


def test_unstarted_workorder_can_choose_an_enabled_optional_version():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(10,), None, None, None]
    webapp._assert_selectable_route(cursor, 10)
    webapp._assert_workorder_route_changeable(cursor, "MO-TEST", 1)


def test_disabled_version_cannot_be_selected():
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    with pytest.raises(ValueError, match="已停用"):
        webapp._assert_selectable_route(cursor, 10)
