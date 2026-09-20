import secrets
import time

import jwt

from agent.settings import AgentSettings

ALGORITHM = "HS256"
KEY_BYTES = 24


class SessionError(Exception):
    pass


class SessionIssuer:
    def __init__(self, settings: AgentSettings) -> None:
        self.settings = settings

    @staticmethod
    def new_key() -> str:
        return secrets.token_urlsafe(KEY_BYTES)

    def issue(self) -> tuple[str, str, int]:
        key = self.new_key()
        now = int(time.time())
        exp = now + self.settings.session_ttl_seconds
        return key, jwt.encode({"sid": key, "iat": now, "exp": exp}, self.settings.session_secret, algorithm=ALGORITHM), exp

    def verify(self, token: str) -> str:
        try:
            claims = jwt.decode(token, self.settings.session_secret, algorithms=[ALGORITHM])
        except jwt.PyJWTError as error:
            raise SessionError(str(error)) from error
        key = claims.get("sid")
        if not isinstance(key, str) or not key:
            raise SessionError("token has no session")
        return key
