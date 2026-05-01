"""QuickBooks Online REST API wrapper.

OAuth2 with refresh token rotation. Refresh tokens are stored encrypted in
`qbo_connection.refresh_token_encrypted` (Fernet) and rotated on every refresh.

Single-tenant for now: one row in qbo_connection. Operations look up that row.
"""

import logging
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.encryption import decrypt, encrypt

logger = logging.getLogger(__name__)


def _api_base() -> str:
    return (
        "https://sandbox-quickbooks.api.intuit.com"
        if settings.qbo_environment != "production"
        else "https://quickbooks.api.intuit.com"
    )


def _oauth_token_url() -> str:
    return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"


# --- OAuth flow ---


def get_consent_url(*, state: str, redirect_uri: str) -> str:
    """Intuit OAuth2 consent URL for the accounting scope."""
    if not settings.qbo_client_id:
        raise RuntimeError("QBO_CLIENT_ID not configured")
    params = {
        "client_id": settings.qbo_client_id,
        "response_type": "code",
        "scope": "com.intuit.quickbooks.accounting",
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return f"https://appcenter.intuit.com/connect/oauth2?{urlencode(params)}"


def exchange_code_for_tokens(code: str, redirect_uri: str) -> dict[str, Any]:
    if not (settings.qbo_client_id and settings.qbo_client_secret):
        raise RuntimeError("QBO client credentials not configured")
    resp = httpx.post(
        _oauth_token_url(),
        auth=(settings.qbo_client_id, settings.qbo_client_secret),
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        },
        headers={"Accept": "application/json"},
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()


def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    """Refresh an expired access token. Returns new tokens incl. rotated refresh_token."""
    resp = httpx.post(
        _oauth_token_url(),
        auth=(settings.qbo_client_id, settings.qbo_client_secret),
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        headers={"Accept": "application/json"},
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()


def revoke_refresh_token(refresh_token: str) -> None:
    """Revoke an OAuth refresh token at Intuit (called on Disconnect)."""
    try:
        httpx.post(
            "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
            auth=(settings.qbo_client_id, settings.qbo_client_secret),
            json={"token": refresh_token},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15.0,
        )
    except Exception as exc:
        logger.warning("QBO token revoke failed (continuing): %s", exc)


# --- Connection state (single-row qbo_connection) ---


def _now_epoch() -> float:
    return time.time()


def get_connection(supabase) -> dict | None:
    res = (
        supabase.table("qbo_connection")
        .select("*")
        .is_("disconnected_at", "null")
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def save_connection(
    supabase,
    *,
    realm_id: str,
    refresh_token: str,
    access_token: str,
    expires_in: int,
    connected_by: str | None = None,
) -> dict:
    existing = get_connection(supabase)
    payload = {
        "realm_id": realm_id,
        "refresh_token_encrypted": encrypt(refresh_token),
        "access_token_cache": access_token,
        "access_token_expires_at": _iso_in(expires_in),
    }
    if connected_by:
        payload["connected_by"] = connected_by
    if existing:
        res = (
            supabase.table("qbo_connection")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )
        return (res.data or [None])[0]
    payload["connected_at"] = "now()"
    res = supabase.table("qbo_connection").insert(payload).execute()
    return (res.data or [None])[0]


def disconnect(supabase) -> None:
    existing = get_connection(supabase)
    if not existing:
        return
    try:
        revoke_refresh_token(decrypt(existing["refresh_token_encrypted"]))
    except Exception:
        pass
    supabase.table("qbo_connection").update(
        {"disconnected_at": "now()", "access_token_cache": None}
    ).eq("id", existing["id"]).execute()


def _iso_in(seconds: int) -> str:
    from datetime import datetime, timedelta, timezone

    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


# --- Authenticated request helper ---


def _ensure_access_token(supabase, conn: dict) -> tuple[str, dict]:
    """Return (access_token, refreshed_conn). Refreshes + persists if expired."""
    expires_at = conn.get("access_token_expires_at")
    cached = conn.get("access_token_cache")
    if cached and expires_at:
        from datetime import datetime, timezone

        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp > datetime.now(timezone.utc).replace(microsecond=0).astimezone(exp.tzinfo or timezone.utc):
                # Add a 60-second safety margin
                from datetime import timedelta

                if exp - timedelta(seconds=60) > datetime.now(timezone.utc):
                    return cached, conn
        except (ValueError, TypeError):
            pass

    refresh_token = decrypt(conn["refresh_token_encrypted"])
    new_tokens = refresh_access_token(refresh_token)
    new_access = new_tokens["access_token"]
    new_refresh = new_tokens.get("refresh_token", refresh_token)
    expires_in = int(new_tokens.get("expires_in", 3600))

    update = {
        "access_token_cache": new_access,
        "access_token_expires_at": _iso_in(expires_in),
        "refresh_token_encrypted": encrypt(new_refresh),
    }
    supabase.table("qbo_connection").update(update).eq("id", conn["id"]).execute()
    refreshed = {**conn, **update}
    return new_access, refreshed


def request(
    supabase,
    method: str,
    path: str,
    *,
    json: dict | None = None,
    params: dict | None = None,
) -> dict:
    """Make an authenticated request against the QBO Accounting API.

    `path` is a relative path like '/v3/company/{realm}/vendor' — caller substitutes the realm.
    """
    conn = get_connection(supabase)
    if not conn:
        raise RuntimeError("QBO not connected")
    access_token, conn = _ensure_access_token(supabase, conn)
    full_url = f"{_api_base()}{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }
    if json is not None:
        headers["Content-Type"] = "application/json"

    resp = httpx.request(
        method,
        full_url,
        params=params,
        json=json,
        headers=headers,
        timeout=30.0,
    )
    if resp.status_code == 401:
        # token might have just expired; one retry after force-refresh
        access_token, conn = _ensure_access_token(supabase, {**conn, "access_token_expires_at": None})
        headers["Authorization"] = f"Bearer {access_token}"
        resp = httpx.request(method, full_url, params=params, json=json, headers=headers, timeout=30.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"QBO {method} {path} → {resp.status_code}: {resp.text[:500]}")
    return resp.json() if resp.content else {}


# --- Entity helpers ---


def vendor_query_by_name(supabase, *, realm_id: str, display_name: str) -> dict | None:
    """Return the first matching vendor by DisplayName, or None."""
    safe = display_name.replace("'", "''")
    q = f"SELECT * FROM Vendor WHERE DisplayName = '{safe}' MAXRESULTS 1"
    body = request(
        supabase, "GET", f"/v3/company/{realm_id}/query", params={"query": q, "minorversion": "70"}
    )
    items = (body.get("QueryResponse") or {}).get("Vendor") or []
    return items[0] if items else None


def vendor_create(supabase, *, realm_id: str, vendor: dict) -> dict:
    body = request(
        supabase,
        "POST",
        f"/v3/company/{realm_id}/vendor",
        json=vendor,
        params={"minorversion": "70"},
    )
    return body.get("Vendor") or {}


def expense_accounts(supabase, *, realm_id: str) -> list[dict]:
    """List all active expense accounts (used to populate the admin's settings dropdown)."""
    q = "SELECT Id, Name, AccountType, AccountSubType FROM Account WHERE Active = true AND AccountType = 'Expense' ORDER BY Name"
    body = request(
        supabase, "GET", f"/v3/company/{realm_id}/query", params={"query": q, "minorversion": "70"}
    )
    return (body.get("QueryResponse") or {}).get("Account") or []


def purchase_create(supabase, *, realm_id: str, purchase: dict) -> dict:
    body = request(
        supabase,
        "POST",
        f"/v3/company/{realm_id}/purchase",
        json=purchase,
        params={"minorversion": "70"},
    )
    return body.get("Purchase") or {}
