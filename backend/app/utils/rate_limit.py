"""Rate limiter en memoria para proteger el login contra fuerza bruta.

Implementacion deliberadamente simple (sin Redis ni dependencias externas). Es
suficiente para un despliegue de un solo proceso como este (docker-compose). Si
en el futuro se corre con varias replicas del backend, habria que mover el
estado a un almacen compartido.

El estado es efimero: se reinicia si el proceso se reinicia (aceptable para un
bloqueo temporal por fuerza bruta).

Modelo de bloqueo: **backoff progresivo**, no ventana deslizante. Cada
`max_attempts` fallos consecutivos se aplica un bloqueo, y cada bloqueo nuevo
dura mas que el anterior segun `lockout_ladder` (ej. 1 min, 5 min, 15 min...,
quedandose en el ultimo escalon). Asi un usuario que se equivoca de verdad
espera poco la primera vez, mientras que un atacante insistente se topa con
esperas cada vez mas largas.

La clave que se pasa (`key`) define el alcance del bloqueo. En el login es la
cuenta (el correo introducido), no la IP: detras de un proxy todas las
peticiones comparten IP y el bloqueo acabaria siendo global para todos los
usuarios.
"""
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Callable, Optional, Sequence

# A partir de este numero de claves vivas se hace una limpieza de las vencidas.
# Evita que el diccionario crezca sin tope si alguien prueba muchos correos
# distintos (con clave por cuenta, el espacio de claves lo elige el atacante).
_PRUNE_THRESHOLD = 1024


@dataclass
class _KeyState:
    """Estado de una clave: fallos desde el ultimo bloqueo, cuantos bloqueos
    lleva acumulados (el escalon del backoff) y hasta cuando esta bloqueada."""
    failures: int = 0
    strikes: int = 0
    blocked_until: Optional[float] = None
    last_seen: float = field(default=0.0)


class RateLimiter:
    def __init__(
        self,
        max_attempts: int = 5,
        lockout_ladder: Sequence[int] = (60, 300, 900),
        strike_decay_seconds: int = 3600,
        time_func: Callable[[], float] = time.monotonic,
    ):
        if max_attempts < 1:
            raise ValueError("max_attempts debe ser >= 1")
        if not lockout_ladder:
            raise ValueError("lockout_ladder no puede estar vacia")

        self.max_attempts = max_attempts
        self.lockout_ladder = tuple(lockout_ladder)
        self.strike_decay_seconds = strike_decay_seconds
        self._time = time_func
        self._state: dict[str, _KeyState] = {}
        self._lock = Lock()

    def _penalty_for(self, strikes: int) -> int:
        """Duracion del bloqueo numero `strikes` (1-based). Del ultimo escalon
        en adelante se repite el mismo castigo."""
        return self.lockout_ladder[min(strikes, len(self.lockout_ladder)) - 1]

    def _is_expired(self, state: _KeyState, now: float) -> bool:
        """True si la clave ya no aporta informacion: sin bloqueo activo y sin
        fallos recientes, asi que puede olvidarse por completo."""
        if state.blocked_until is not None and now < state.blocked_until:
            return False
        return now - state.last_seen >= self.strike_decay_seconds

    def _get_live_state(self, key: str, now: float) -> Optional[_KeyState]:
        """Devuelve el estado vigente de la clave, aplicando primero las
        caducidades: bloqueo cumplido y decaimiento de sanciones. Debe llamarse
        con el lock tomado."""
        state = self._state.get(key)
        if state is None:
            return None

        if self._is_expired(state, now):
            # Olvido total: los strikes acumulados tambien se pierden, si no un
            # usuario despistado arrastraria castigos crecientes para siempre.
            del self._state[key]
            return None

        if state.blocked_until is not None and now >= state.blocked_until:
            # Bloqueo cumplido: se libera y se le dan intentos nuevos, pero se
            # conserva el strike para que el siguiente bloqueo sea mas largo.
            state.blocked_until = None
            state.failures = 0

        return state

    def _prune(self, now: float) -> None:
        """Descarta las claves ya caducadas. Con el lock tomado."""
        for key in [k for k, s in self._state.items() if self._is_expired(s, now)]:
            del self._state[key]

    def retry_after(self, key: str) -> Optional[float]:
        """Devuelve None si la clave puede intentar; si esta bloqueada,
        devuelve cuantos segundos faltan para que se libere."""
        now = self._time()
        with self._lock:
            state = self._get_live_state(key, now)
            if state is not None and state.blocked_until is not None:
                return max(0.0, state.blocked_until - now)
        return None

    def register_failure(self, key: str) -> None:
        now = self._time()
        with self._lock:
            if len(self._state) >= _PRUNE_THRESHOLD:
                self._prune(now)

            state = self._get_live_state(key, now)
            if state is None:
                state = _KeyState()
                self._state[key] = state

            state.failures += 1
            state.last_seen = now

            if state.failures >= self.max_attempts:
                state.strikes += 1
                state.blocked_until = now + self._penalty_for(state.strikes)
                state.failures = 0

    def reset(self, key: str) -> None:
        """Limpia el historial de una clave (ej. tras un login exitoso)."""
        with self._lock:
            self._state.pop(key, None)

    def clear(self) -> None:
        """Borra TODO el estado (usado principalmente en tests)."""
        with self._lock:
            self._state.clear()
