"""Symmetric encryption for sensitive PII (TIN, ACH routing/account).

Uses Fernet (AES-128-CBC + HMAC-SHA256) keyed off W9_ENCRYPTION_KEY.
Ciphertext is stored as URL-safe base64 in TEXT columns; plaintext never leaves the backend.
"""

import base64
import hashlib
import hmac
import secrets

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


# --- OAuth state (stateless, HMAC-signed) ---


def sign_oauth_state(
    user_id: str, *, purpose: str = "oauth", return_to: str | None = None
) -> str:
    """Pack (user_id, optional return_to, nonce) into an HMAC-signed state string.

    Avoids needing cookies (which fail cross-site) by carrying everything in
    the OAuth state param itself. HMAC ensures it can't be forged.
    `return_to` is a relative frontend path the callback should redirect to;
    it's base64-encoded into the state so the round-trip preserves slashes.
    """
    nonce = secrets.token_urlsafe(12)
    if return_to:
        rt_b64 = base64.urlsafe_b64encode(return_to.encode("utf-8")).decode("ascii").rstrip("=")
        payload = f"{purpose}:{user_id}:{rt_b64}:{nonce}"
    else:
        payload = f"{purpose}:{user_id}:{nonce}"
    sig = hmac.new(
        settings.secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{sig}"


def verify_oauth_state(state: str, *, purpose: str = "oauth") -> tuple[str, str | None]:
    """Verify HMAC-signed state and return (user_id, return_to).

    `return_to` is None for states minted without one. Raises on tamper /
    wrong purpose / malformed input.
    """
    parts = state.split(":")
    if len(parts) == 4:
        got_purpose, user_id, nonce, sig = parts
        return_to: str | None = None
        signed = f"{got_purpose}:{user_id}:{nonce}"
    elif len(parts) == 5:
        got_purpose, user_id, rt_b64, nonce, sig = parts
        signed = f"{got_purpose}:{user_id}:{rt_b64}:{nonce}"
        pad = "=" * (-len(rt_b64) % 4)
        try:
            return_to = base64.urlsafe_b64decode(rt_b64 + pad).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValueError("Malformed OAuth state return_to") from exc
    else:
        raise ValueError("Malformed OAuth state")
    if got_purpose != purpose:
        raise ValueError("OAuth state purpose mismatch")
    expected_sig = hmac.new(
        settings.secret_key.encode("utf-8"),
        signed.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        raise ValueError("OAuth state signature invalid")
    return user_id, return_to
