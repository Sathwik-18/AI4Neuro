"""Authentication guard.

Verifies Firebase ID tokens (``Authorization: Bearer <token>``) against Google's
public signing keys. The token only proves *who* the caller is; role, hospital
and account status always come from the profile the backend stores (see
``api.deps.get_current_user``), never from the token.

For the foundation, ``AUTH_DEV_BYPASS`` lets the app run before profiles/roles are
fully wired (Phase 5): when enabled and no valid token is present, a dev principal
is injected. It MUST be disabled in production (enforced below).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

DEV_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000000"


@dataclass
class Principal:
    """The authenticated caller.

    ``role``/``hospital_id``/``status`` are the app-level values loaded from
    ``user_profiles`` (see ``api.deps.get_current_user``); the token only carries
    the Firebase identity. ``role`` is pre-set only for the dev principal.
    """

    user_id: str
    email: str | None = None
    role: str | None = None
    hospital_id: str | None = None
    status: str | None = None
    is_dev: bool = False
    claims: dict = field(default_factory=dict)
    profile: dict = field(default_factory=dict)


_GOOGLE_JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)


def _decode_token(token: str, settings: Settings) -> dict:
    """Verify a Firebase ID token: RS256, signed by Google's securetoken keys,
    issued for *this* Firebase project."""
    import jwt  # PyJWT

    project_id = settings.firebase_project_id
    if not project_id:
        return _decode_legacy_supabase_token(token, settings)

    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=project_id,
        issuer=f"https://securetoken.google.com/{project_id}",
        leeway=30,  # tolerate clock drift between this host and Google
    )


@lru_cache(maxsize=1)
def _jwks_client():
    from jwt import PyJWKClient

    return PyJWKClient(_GOOGLE_JWKS_URL)


def _decode_legacy_supabase_token(token: str, settings: Settings) -> dict:
    """LEGACY (delete at cut-over): verify a Supabase access token, used only
    while FIREBASE_PROJECT_ID is unset."""
    import jwt
    from jwt import PyJWKClient

    if jwt.get_unverified_header(token).get("alg") == "HS256" and settings.supabase_jwt_secret:
        return jwt.decode(
            token, settings.supabase_jwt_secret, algorithms=["HS256"],
            audience="authenticated", leeway=30,
        )
    if settings.supabase_url:
        jwks = PyJWKClient(f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json")
        return jwt.decode(
            token, jwks.get_signing_key_from_jwt(token).key, algorithms=["ES256", "RS256"],
            audience="authenticated", leeway=30,
        )
    raise ValueError("Token verification is not configured.")


def get_current_principal(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Principal:
    """FastAPI dependency resolving the current authenticated principal."""
    token = _extract_bearer(authorization)

    if token and (settings.firebase_project_id or settings.supabase_url or settings.supabase_jwt_secret):
        try:
            claims = _decode_token(token, settings)
            return Principal(
                user_id=claims.get("sub", ""),
                email=claims.get("email"),
                claims=claims,
            )
        except Exception as exc:  # invalid/expired token
            logger.info("JWT verification failed: %s", exc)
            if not settings.auth_dev_bypass:
                raise _unauthorized("Invalid or expired token.") from exc

    # No/failed token below this point.
    if settings.auth_dev_bypass and not settings.is_production:
        return Principal(user_id=DEV_PRINCIPAL_ID, role="super_admin", is_dev=True)

    raise _unauthorized("Authentication required.")


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return None


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthorized", "message": message},
        headers={"WWW-Authenticate": "Bearer"},
    )
