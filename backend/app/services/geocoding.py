"""Address-to-coordinate geocoding helpers backed by Google Maps Geocoding API."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


async def geocode_address(address: str) -> tuple[float, float] | None:
    """Geocode a free-form address string. Returns (lat, lng) or None on failure."""
    address = (address or "").strip()
    if not address:
        return None
    if not settings.google_maps_api_key:
        logger.warning("Google Maps API key not configured, skipping geocoding")
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                _GEOCODE_URL,
                params={
                    "address": address,
                    "key": settings.google_maps_api_key,
                },
            )
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return (loc["lat"], loc["lng"])
            logger.info("Geocoding returned status=%s for address=%r", data.get("status"), address)
    except Exception as e:
        logger.error("Geocoding failed for address %r: %s", address, e)
    return None
