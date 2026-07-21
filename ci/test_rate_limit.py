"""Prueba unitaria del RateLimiter, con reloj inyectado para poder verificar la
expiración de la ventana sin esperas reales."""
from app.utils.rate_limit import RateLimiter


def _limiter_with_clock(clock, **kwargs):
    return RateLimiter(time_func=lambda: clock["t"], **kwargs)


def test_blocks_after_max_and_frees_after_window():
    clock = {"t": 1000.0}
    rl = _limiter_with_clock(clock, max_attempts=3, window_seconds=60)

    # Bajo el limite: permitido.
    rl.register_failure("ip")
    rl.register_failure("ip")
    assert rl.retry_after("ip") is None

    # Al alcanzar el limite: bloqueado, con tiempo restante > 0.
    rl.register_failure("ip")
    wait = rl.retry_after("ip")
    assert wait is not None and wait > 0

    # Pasada la ventana, los intentos viejos caducan y se libera.
    clock["t"] += 61
    assert rl.retry_after("ip") is None


def test_reset_clears_key():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(clock, max_attempts=2, window_seconds=60)
    rl.register_failure("ip")
    rl.register_failure("ip")
    assert rl.retry_after("ip") is not None

    rl.reset("ip")
    assert rl.retry_after("ip") is None


def test_keys_are_independent():
    clock = {"t": 0.0}
    rl = _limiter_with_clock(clock, max_attempts=1, window_seconds=60)
    rl.register_failure("ip-a")
    # Otra IP no se ve afectada por los fallos de la primera.
    assert rl.retry_after("ip-a") is not None
    assert rl.retry_after("ip-b") is None
