"""PayPal Payouts API wrapper.

Uses the REST v1 Payouts endpoints. One Payouts API call sends to either a
PayPal email or a Venmo email — PayPal auto-routes based on which service owns
the address.

Docs: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
"""

import logging
import time
from typing import Any
from uuid import uuid4

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _base_url() -> str:
    return (
        "https://api-m.sandbox.paypal.com"
        if settings.paypal_mode != "live"
        else "https://api-m.paypal.com"
    )


_token_cache: dict[str, Any] = {"access_token": None, "expires_at": 0.0}


def get_access_token() -> str:
    """Fetch and cache a PayPal OAuth2 access token."""
    if (
        _token_cache["access_token"]
        and time.time() < _token_cache["expires_at"] - 60
    ):
        return _token_cache["access_token"]

    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RuntimeError(
            "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not configured"
        )

    resp = httpx.post(
        f"{_base_url()}/v1/oauth2/token",
        auth=(settings.paypal_client_id, settings.paypal_client_secret),
        data={"grant_type": "client_credentials"},
        headers={"Accept": "application/json"},
        timeout=20.0,
    )
    resp.raise_for_status()
    body = resp.json()
    token = body["access_token"]
    expires_in = int(body.get("expires_in", 3600))
    _token_cache["access_token"] = token
    _token_cache["expires_at"] = time.time() + expires_in
    return token


def create_payout_batch(
    items: list[dict[str, Any]],
    *,
    sender_batch_id: str | None = None,
    email_subject: str = "You have a payment from NMB Media",
    email_message: str = "Thanks for your work — your job payment is on the way.",
) -> dict[str, Any]:
    """Send a Payouts batch.

    Each item dict should have:
        recipient_email: str
        amount: str  (e.g. "120.50")
        currency: str  (default "USD")
        sender_item_id: str  (our stable id; matches payments.id or batch+payment.id)
        note: str | None  (optional, shown in recipient's email)

    Returns the parsed response body, including `batch_header.payout_batch_id`
    and (after polling / webhook) per-item statuses.
    """
    token = get_access_token()
    payload_items = []
    for it in items:
        payload_items.append(
            {
                "recipient_type": "EMAIL",
                "amount": {"value": it["amount"], "currency": it.get("currency", "USD")},
                "receiver": it["recipient_email"],
                "sender_item_id": it["sender_item_id"],
                "note": it.get("note", ""),
            }
        )

    body = {
        "sender_batch_header": {
            "sender_batch_id": sender_batch_id or f"nmb-{uuid4().hex}",
            "email_subject": email_subject,
            "email_message": email_message,
        },
        "items": payload_items,
    }

    resp = httpx.post(
        f"{_base_url()}/v1/payments/payouts",
        json=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()


def get_payout_batch(batch_id: str) -> dict[str, Any]:
    """Fetch the current state of a Payouts batch + its items."""
    token = get_access_token()
    resp = httpx.get(
        f"{_base_url()}/v1/payments/payouts/{batch_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()


def get_login_oauth_url(*, state: str, redirect_uri: str, scope: str = "openid email") -> str:
    """Build the "Log In with PayPal" OAuth consent URL.

    User redirected here logs into PayPal (or signs up), grants scope, and is
    redirected back to redirect_uri with `code` + `state` query params.
    """
    if not settings.paypal_client_id:
        raise RuntimeError("PAYPAL_CLIENT_ID not configured")
    from urllib.parse import quote, urlencode

    base = (
        "https://www.sandbox.paypal.com/connect"
        if settings.paypal_mode != "live"
        else "https://www.paypal.com/connect"
    )
    params = {
        "flowEntry": "static",
        "client_id": settings.paypal_client_id,
        "response_type": "code",
        "scope": scope,
        "redirect_uri": redirect_uri,
        "state": state,
    }
    # Use %20 (not +) for spaces — PayPal's /connect endpoint expects
    # percent-encoded spaces in the scope value.
    return f"{base}?{urlencode(params, quote_via=quote)}"


def exchange_login_code(code: str, *, redirect_uri: str) -> dict[str, Any]:
    """Exchange a Log In with PayPal auth code for a verified user profile.

    Returns dict with at least: email, payer_id (sub), and any name fields PayPal provides.
    """
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RuntimeError("PAYPAL_CLIENT_ID/SECRET not configured")
    token_resp = httpx.post(
        f"{_base_url()}/v1/oauth2/token",
        auth=(settings.paypal_client_id, settings.paypal_client_secret),
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        },
        headers={"Accept": "application/json"},
        timeout=20.0,
    )
    token_resp.raise_for_status()
    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise RuntimeError("PayPal did not return an access_token in code exchange")

    userinfo = httpx.get(
        f"{_base_url()}/v1/identity/openidconnect/userinfo?schema=openid",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20.0,
    )
    userinfo.raise_for_status()
    body = userinfo.json()
    return {
        "email": body.get("email"),
        "payer_id": body.get("user_id") or body.get("sub"),
        "name": body.get("name"),
    }


def verify_webhook_signature(
    *,
    headers: dict[str, str],
    raw_body: bytes,
    webhook_id: str | None = None,
) -> bool:
    """Verify the signature on an incoming PayPal webhook event.

    Uses PayPal's `notifications/verify-webhook-signature` endpoint. Returns True if
    PayPal confirms the signature is valid. Logs and returns False on any error.
    """
    wid = webhook_id or settings.paypal_webhook_id
    if not wid:
        logger.warning("PAYPAL_WEBHOOK_ID not configured; rejecting webhook")
        return False

    needed = [
        "paypal-transmission-id",
        "paypal-transmission-time",
        "paypal-cert-url",
        "paypal-auth-algo",
        "paypal-transmission-sig",
    ]
    lower = {k.lower(): v for k, v in headers.items()}
    if not all(h in lower for h in needed):
        logger.warning("Missing PayPal webhook signature headers")
        return False

    try:
        token = get_access_token()
        import json as _json

        verify_body = {
            "auth_algo": lower["paypal-auth-algo"],
            "cert_url": lower["paypal-cert-url"],
            "transmission_id": lower["paypal-transmission-id"],
            "transmission_sig": lower["paypal-transmission-sig"],
            "transmission_time": lower["paypal-transmission-time"],
            "webhook_id": wid,
            "webhook_event": _json.loads(raw_body.decode("utf-8")),
        }
        resp = httpx.post(
            f"{_base_url()}/v1/notifications/verify-webhook-signature",
            json=verify_body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        return resp.json().get("verification_status") == "SUCCESS"
    except Exception as exc:
        logger.error("PayPal webhook verification failed: %s", exc)
        return False
