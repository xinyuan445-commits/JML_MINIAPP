from decimal import Decimal

import pytest

from services.mo_quantity_rules import load_settings, validate_complete, validate_receive


SETTINGS = {
    "completion_not_exceed_received": True,
    "receive_not_exceed_previous_completed": True,
    "completion_not_exceed_previous_completed": True,
}


def test_decimal_receive_limit_preserves_fraction():
    validate_receive(SETTINGS, "8", "0", "0.5", "9")
    with pytest.raises(ValueError, match="0.5"):
        validate_receive(SETTINGS, "8.5", "0", "1", "9")


def test_complete_uses_strictest_enabled_cap():
    with pytest.raises(ValueError, match="本次最多可完工1"):
        validate_complete(SETTINGS, "7", "2", "8", "10", True)


def test_first_step_does_not_require_received_qty():
    validate_complete(SETTINGS, Decimal("0"), Decimal("1"), Decimal("0"), 0, False)


class SettingsCursor:
    def __init__(self):
        self.query = ""

    def execute(self, query, params=None):
        self.query = query

    def fetchone(self):
        if "mo_quantity_rule_setting_yx" in self.query:
            return {key: 1 for key in SETTINGS}
        return None


def test_settings_apply_to_production_department():
    assert load_settings(SettingsCursor(), "04101") == SETTINGS


def test_settings_do_not_apply_to_non_production_department():
    assert load_settings(SettingsCursor(), "04701") == {
        key: False for key in SETTINGS
    }


def test_settings_do_not_apply_without_department():
    assert load_settings(SettingsCursor(), None) == {
        key: False for key in SETTINGS
    }
