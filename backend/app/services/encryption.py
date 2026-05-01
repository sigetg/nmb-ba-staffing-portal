"""Symmetric encryption for sensitive PII (TIN, ACH routing/account).

Uses Fernet (AES-128-CBC + HMAC-SHA256) keyed off W9_ENCRYPTION_KEY.
Ciphertext is stored as URL-safe base64 in TEXT columns; plaintext never leaves the backend.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.w9_encryption_key:
            raise RuntimeError(
                "W9_ENCRYPTION_KEY is not configured. "
                "Set it in Railway env vars (and locally in backend/.env)."
            )
        # Derive a 32-byte key from the configured secret via SHA-256, then
        # base64-url-encode for Fernet's expected format.
        digest = hashlib.sha256(settings.w9_encryption_key.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(digest)
        _fernet = Fernet(key)
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns URL-safe base64 text safe for TEXT columns."""
    if plaintext is None:
        raise ValueError("Cannot encrypt None")
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str:
    """Decrypt ciphertext text back to plaintext string. Raises on tamper / wrong key."""
    if ciphertext is None:
        raise ValueError("Cannot decrypt None")
    try:
        return _get_fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt: invalid token (wrong key or tampered data)") from exc


def last4(value: str) -> str:
    """Return the last 4 chars of a digit-string for display ('123-45-6789' -> '6789')."""
    digits = "".join(c for c in value if c.isdigit())
    return digits[-4:] if len(digits) >= 4 else digits
