from unittest.mock import MagicMock

import pytest
from mysql.connector.errors import InterfaceError, PoolError

import app as webapp


def test_pool_exhaustion_waits_for_a_released_connection(monkeypatch):
    connection = object()
    pool = MagicMock()
    pool.get_connection.side_effect = [PoolError("pool exhausted"), connection]
    wait = MagicMock()
    monkeypatch.setattr(webapp, "_pool", pool)
    monkeypatch.setattr(webapp, "sleep", wait)

    assert webapp.db() is connection
    wait.assert_called_once_with(0.05)


def test_pool_exhaustion_stops_waiting_at_deadline(monkeypatch):
    pool = MagicMock()
    pool.get_connection.side_effect = PoolError("pool exhausted")
    ticks = iter([10, 10, 15])
    wait = MagicMock()
    monkeypatch.setattr(webapp, "_pool", pool)
    monkeypatch.setattr(webapp, "monotonic", lambda: next(ticks))
    monkeypatch.setattr(webapp, "sleep", wait)

    with pytest.raises(PoolError):
        webapp.db()
    assert pool.get_connection.call_count == 2
    wait.assert_called_once_with(0.05)


def test_connection_failures_are_not_hidden_by_pool_retries(monkeypatch):
    pool = MagicMock()
    pool.get_connection.side_effect = InterfaceError("connection lost")
    wait = MagicMock()
    monkeypatch.setattr(webapp, "_pool", pool)
    monkeypatch.setattr(webapp, "sleep", wait)

    with pytest.raises(InterfaceError):
        webapp.db()
    wait.assert_not_called()
