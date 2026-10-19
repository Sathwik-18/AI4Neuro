"""Firebase Auth user management — the backend's half of user creation.

Creates a login-capable account (Firebase Auth user), which
``user_provisioning`` then pairs with a ``user_profiles`` row and role-detail
row. Also the single place custom claims are written: the claims mirror the
stored role/hospital so Firestore rules and the frontend middleware can read
them, but the backend itself never trusts them over the stored profile.
"""

from __future__ import annotations

import secrets
import string
from typing import Any

from app.core.logging import get_logger
from app.services.firebase_client import require_client

logger = get_logger(__name__)

_PASSWORD_CHARSET = string.ascii_letters + string.digits + "!@#$%^&*"


class AuthProvisioningError(RuntimeError):
    """Raised when Firebase Auth user creation fails."""


def generate_temporary_password(length: int = 12) -> str:
    return "".join(secrets.choice(_PASSWORD_CHARSET) for _ in range(length))


class AuthAdminService:
    """Thin wrapper over ``firebase_admin.auth``."""

    def __init__(self, client: Any | None = None) -> None:
        # Only used to confirm Firebase is configured (initialises the app).
        self._client = client

    @property
    def _auth(self) -> Any:
        require_client(self._client)
        import firebase_admin
        from firebase_admin import auth

        if not firebase_admin._apps:
            raise AuthProvisioningError(
                "User management needs Firebase. Set FIREBASE_PROJECT_ID and "
                "FIREBASE_CREDENTIALS_PATH."
            )

        return auth

    def create_auth_user(
        self, *, email: str, full_name: str, role: str, password: str | None = None
    ) -> dict:
        """Create a Firebase Auth user with a temporary password; returns a
        dict with at least ``id`` (the Firebase uid)."""
        password = password or generate_temporary_password()
        try:
            user = self._auth.create_user(
                email=email, password=password, display_name=full_name, email_verified=True
            )
        except Exception as exc:
            raise AuthProvisioningError(f"Failed to create Auth user: {exc}") from exc
        return {"id": user.uid, "email": email, "temporary_password": password}

    def set_claims(self, user_id: str, *, role: str | None, hospital_id: str | None) -> None:
        """Mirror the stored role/hospital onto the user's token. Best-effort:
        the backend authorises from the stored profile, so a failure here only
        delays what rules/middleware see until the next successful write."""
        try:
            self._auth.set_custom_user_claims(
                user_id, {"app_role": role, "hospital": hospital_id}
            )
        except Exception as exc:
            logger.error("Failed to set claims for %s: %s", user_id, exc)

    def delete_auth_user(self, user_id: str) -> None:
        """Delete an Auth user (rollback after a failed provisioning, or account
        removal). Best-effort — logs rather than raising."""
        try:
            self._auth.delete_user(user_id)
        except Exception as exc:
            logger.error("Failed to delete Auth user %s: %s", user_id, exc)
