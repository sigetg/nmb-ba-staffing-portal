"""Backfill latitude/longitude on job_day_locations rows that have NULL coords.

Run from repo root:
    python -m backend.scripts.backfill_job_day_location_coords

or:
    cd backend && python scripts/backfill_job_day_location_coords.py

Only updates rows where latitude IS NULL OR longitude IS NULL. Idempotent —
safe to re-run. Dry-run flag prints what would happen without mutating.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.supabase import get_supabase_client  # noqa: E402
from app.services.geocoding import geocode_address  # noqa: E402


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would change without writing to the database.",
    )
    args = parser.parse_args()

    supabase = get_supabase_client()

    rows = (
        supabase.table("job_day_locations")
        .select("id, location, latitude, longitude")
        .or_("latitude.is.null,longitude.is.null")
        .execute()
        .data
        or []
    )

    print(f"Found {len(rows)} rows with NULL coords.")

    resolved = 0
    skipped: list[tuple[str, str]] = []

    for row in rows:
        row_id = row["id"]
        address = (row.get("location") or "").strip()
        if not address:
            skipped.append((row_id, "<empty address>"))
            continue

        coords = await geocode_address(address)
        if coords is None:
            skipped.append((row_id, address))
            continue
        lat, lng = coords

        if args.dry_run:
            print(f"  [dry-run] {row_id}  {address!r} -> ({lat}, {lng})")
            resolved += 1
            continue

        upd = (
            supabase.table("job_day_locations")
            .update({"latitude": lat, "longitude": lng})
            .eq("id", row_id)
            .execute()
        )
        if upd.data:
            print(f"  resolved {row_id}  {address!r} -> ({lat}, {lng})")
            resolved += 1
        else:
            skipped.append((row_id, address))

    print()
    print(f"Resolved: {resolved}")
    print(f"Skipped:  {len(skipped)}")
    if skipped:
        print("Unresolved (id, address):")
        for row_id, address in skipped:
            print(f"  {row_id}\t{address!r}")

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
