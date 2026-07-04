from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.db.db import get_session
from app.models.users import User
from app.auth.jwt import decode_access_token

# tokenUrl es solo informativo para la documentacion /docs (Swagger),
# no afecta el funcionamiento real del endpoint de login.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_exception

    return user
