"""One-time backfill of city/state on ba_profiles using uszipcode.

Run from repo root:
    python -m backend.scripts.backfill_ba_city_state

or:
    cd backend && python scripts/backfill_ba_city_state.py

Only updates rows where `state IS NULL`. Idempotent — safe to re-run.
"""
from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

# Allow running as a standalone script (cd backend && python scripts/...)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.supabase import get_supabase_client  # noqa: E402

try:
    from uszipcode import SearchEngine
except ImportError:
    print("uszipcode is not installed. Run: pip install uszipcode", file=sys.stderr)
    sys.exit(1)


PAGE_SIZE = 500


def main() -> int:
    supabase = get_supabase_client()
    search = SearchEngine()

    offset = 0
    total_seen = 0
    resolved = 0
    skipped: list[tuple[str, str]] = []  # (ba_id, zip_code)

    while True:
        result = (
            supabase.table("ba_profiles")
            .select("id, zip_code, state")
            .is_("state", "null")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            total_seen += 1
            ba_id = row["id"]
            zip_code = (row.get("zip_code") or "").strip()
            if not zip_code:
                skipped.append((ba_id, zip_code))
                continue

            zip5 = zip_code[:5]
            zc = search.by_zipcode(zip5)
            if not zc or not zc.major_city or not zc.state:
                skipped.append((ba_id, zip_code))
                continue

            update = {
                "city": zc.major_city,
                "state": zc.state,
                "updated_at": datetime.now(UTC).isoformat(),
            }
            upd = supabase.table("ba_profiles").update(update).eq("id", ba_id).execute()
            if upd.data:
                resolved += 1
            else:
                skipped.append((ba_id, zip_code))

        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    print(f"Seen: {total_seen}")
    print(f"Resolved: {resolved}")
    print(f"Skipped: {len(skipped)}")
    if skipped:
        print("Unresolved (ba_id, zip):")
        for ba_id, zip_code in skipped:
            print(f"  {ba_id}\t{zip_code!r}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
