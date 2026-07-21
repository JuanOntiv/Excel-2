"""Rate limiter en memoria para proteger el login contra fuerza bruta.

Implementacion deliberadamente simple (sin Redis ni dependencias externas):
guarda, por clave (IP del cliente), las marcas de tiempo de los intentos
fallidos dentro de una ventana deslizante. Es suficiente para un despliegue de
un solo proceso como este (docker-compose). Si en el futuro se corre con varias
replicas del backend, habria que mover el estado a un almacen compartido.

El estado es efimero: se reinicia si el proceso se reinicia (aceptable para un
bloqueo temporal por fuerza bruta).
"""
import time
from collections import defaultdict
from threading import Lock
from typing import Callable, Optional


class RateLimiter:
    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 900,
        time_func: Callable[[], float] = time.monotonic,
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._time = time_func
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> list[float]:
        """Descarta los intentos fuera de la ventana y devuelve los vigentes."""
        recent = [t for t in self._attempts[key] if now - t < self.window_seconds]
        self._attempts[key] = recent
        return recent

    def retry_after(self, key: str) -> Optional[float]:
        """Devuelve None si la clave puede intentar; si esta bloqueada,
        devuelve cuantos segundos faltan para que se libere."""
        now = self._time()
        with self._lock:
            recent = self._prune(key, now)
            if len(recent) >= self.max_attempts:
                # Se libera cuando el intento mas antiguo salga de la ventana.
                return max(0.0, self.window_seconds - (now - recent[0]))
        return None

    def register_failure(self, key: str) -> None:
        now = self._time()
        with self._lock:
            self._prune(key, now)
            self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        """Limpia los fallos de una clave (ej. tras un login exitoso)."""
        with self._lock:
            self._attempts.pop(key, None)

    def clear(self) -> None:
        """Borra TODO el estado (usado principalmente en tests)."""
        with self._lock:
            self._attempts.clear()
