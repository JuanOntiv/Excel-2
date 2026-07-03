from functools import wraps
from typing import Optional

from app.models.logs import Log, LogAction, LogLevel

def log_action(action: LogAction, table: Optional[str] = None, level: LogLevel = LogLevel.INFO):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)

            session = kwargs.get("session")
            current_user = kwargs.get("current_user")

            if session is not None:
                log_entry = Log(
                    user_id=current_user.id if current_user else None,
                    action=action,
                    level=level,
                    table=table,
                    detail=None,
                )
                session.add(log_entry)
                session.commit()

            return result
        return wrapper
    return decorator
