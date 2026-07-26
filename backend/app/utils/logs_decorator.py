from functools import wraps
from typing import Callable, Optional

from app.models.logs import Log, LogAction, LogLevel


# Centinela: si detail_fn lo devuelve, no se escribe log. Sirve para rutas
# que no siempre representan una accion real del usuario (ej. execute-pending
# corre en cada login y casi siempre no ejecuta nada).
SKIP_LOG = object()


def _default_detail(result) -> Optional[str]:
    """Best-effort: la mayoria de rutas devuelven el modelo creado/actualizado
    (tiene .name), o un dict de mensaje para DELETE (las rutas de borrado
    incluyen "name" explicitamente en ese dict, ver cada route)."""
    if isinstance(result, dict):
        name = result.get("name")
        return str(name) if name else None
    name = getattr(result, "name", None)
    return str(name) if name else None


def log_action(
    action: LogAction,
    table: Optional[str] = None,
    level: LogLevel = LogLevel.INFO,
    detail_fn: Optional[Callable] = None,
):
    """detail_fn(result, kwargs) -> Optional[str] permite describir el
    registro para tablas sin campo "name" (ej. wallet_rules, polimorfica).
    Si no se provee, o devuelve None, cae a _default_detail.
    Si devuelve SKIP_LOG, no se registra nada."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)

            session = kwargs.get("session")
            current_user = kwargs.get("current_user")

            if session is not None:
                detail = None
                if detail_fn is not None:
                    detail = detail_fn(result, kwargs)
                    if detail is SKIP_LOG:
                        return result
                if detail is None:
                    detail = _default_detail(result)

                log_entry = Log(
                    user_id=current_user.id if current_user else None,
                    action=action,
                    level=level,
                    table=table,
                    detail=detail,
                )
                session.add(log_entry)
                session.commit()

            return result
        return wrapper
    return decorator
