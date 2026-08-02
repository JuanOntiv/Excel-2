"""Prueba unitaria del RateLimiter, con reloj inyectado para poder verificar el
backoff progresivo y la caducidad sin esperas reales."""
from app.utils.rate_limit import RateLimiter


def _limiter_with_clock(clock, **kwargs):
    return RateLimiter(time_func=lambda: clock["t"], **kwargs)


def _fail(rl, key, times):
    for _ in range(times):
        rl.register_failure(key)


def test_blocks_after_max_and_frees_when_lockout_expires():
    clock = {"t": 1000.0}
    rl = _limiter_with_clock(clock, max_attempts=3, lockout_ladder=(60, 300))

    # Bajo el limite: permitido.
    _fail(rl, "a@test.com", 2)
    assert rl.retry_after("a@test.com") is None

    # Al alcanzar el limite: bloqueado el primer escalon (60s).
    rl.register_failure("a@test.com")
    wait = rl.retry_after("a@test.com")
    assert wait is not None and 0 < wait <= 60

    # Cumplido el bloqueo, se libera.
    clock["t"] += 61
    assert rl.retry_after("a@test.com") is None


def test_lockout_is_progressive_and_caps_at_last_step():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(clock, max_attempts=2, lockout_ladder=(60, 300, 900))

    expected = [60, 300, 900, 900]  # el ultimo escalon se repite indefinidamente
    for i, penalty in enumerate(expected):
        _fail(rl, "a@test.com", 2)
        wait = rl.retry_after("a@test.com")
        assert wait is not None and wait == penalty, f"bloqueo #{i + 1}"

        # Se espera lo justo para salir del bloqueo antes de la siguiente ronda.
        clock["t"] += penalty
        assert rl.retry_after("a@test.com") is None


def test_strikes_decay_after_quiet_period():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(
        clock, max_attempts=2, lockout_ladder=(60, 300), strike_decay_seconds=3600
    )

    _fail(rl, "a@test.com", 2)
    assert rl.retry_after("a@test.com") == 60

    # Tras un periodo largo sin fallos se olvida todo, incluidos los strikes:
    # el siguiente bloqueo vuelve a ser el primer escalon, no el segundo.
    clock["t"] += 3600
    assert rl.retry_after("a@test.com") is None

    _fail(rl, "a@test.com", 2)
    assert rl.retry_after("a@test.com") == 60


def test_failures_below_limit_also_decay():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(
        clock, max_attempts=3, lockout_ladder=(60,), strike_decay_seconds=3600
    )

    # Dos fallos aislados no deben sumarse a otros dos de horas despues.
    _fail(rl, "a@test.com", 2)
    clock["t"] += 3600
    _fail(rl, "a@test.com", 2)
    assert rl.retry_after("a@test.com") is None


def test_reset_clears_key_including_strikes():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(clock, max_attempts=2, lockout_ladder=(60, 300))
    _fail(rl, "a@test.com", 2)
    assert rl.retry_after("a@test.com") is not None

    # Un login correcto borra el historial: el siguiente bloqueo empieza de cero.
    rl.reset("a@test.com")
    assert rl.retry_after("a@test.com") is None

    _fail(rl, "a@test.com", 2)
    assert rl.retry_after("a@test.com") == 60


def test_keys_are_independent():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(clock, max_attempts=1, lockout_ladder=(60,))
    rl.register_failure("a@test.com")
    # Otra cuenta no se ve afectada por los fallos de la primera.
    assert rl.retry_after("a@test.com") is not None
    assert rl.retry_after("b@test.com") is None
