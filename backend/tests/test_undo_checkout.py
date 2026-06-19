"""Tests for the undo-checkout endpoint.

Covers the auth/window/state branches of `undo_location_checkout` in
`app.api.jobs`. Supabase access is stubbed by replacing
`get_supabase_client` with a fake whose `.table(...).select/.eq/...
.execute()` chain returns canned responses. Anything more elaborate
would require a real Supabase test project, which the repo does not
currently provide.
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api import jobs as jobs_module
from app.core.auth import CurrentUser, get_current_user
from main import app

BA_USER = CurrentUser(id="user-ba", email="ba@example.com", role="ba")
ADMIN_USER = CurrentUser(id="user-admin", email="admin@example.com", role="admin")

BA_PROFILE_ID = "profile-1"
JOB_ID = "job-1"
LOCATION_ID = "location-1"
CHECKIN_ID = "checkin-1"


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """Mimics the postgrest-py chained query just enough for this endpoint."""

    def __init__(self, response):
        self._response = response

    def select(self, *_args, **_kwargs):
        return self

    def update(self, _payload):
        return self

    def delete(self):
        return self

    def insert(self, _payload):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def single(self):
        return self

    def execute(self):
        return self._response


class FakeSupabase:
    """Drives test scenarios by returning a different FakeResponse per table."""

    def __init__(self, table_responses):
        # table_responses[table_name] -> list of responses (popped per call)
        self._responses = {k: list(v) for k, v in table_responses.items()}

    def table(self, name):
        bucket = self._responses.get(name, [])
        if not bucket:
            return FakeQuery(FakeResponse([]))
        return FakeQuery(bucket.pop(0))


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _override_user(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _stub_supabase(monkeypatch, responses):
    fake = FakeSupabase(responses)
    monkeypatch.setattr(jobs_module, "get_supabase_client", lambda: fake)
    return fake


def _now_iso(offset_minutes: float = 0) -> str:
    return (datetime.now(UTC) + timedelta(minutes=offset_minutes)).isoformat()


def test_ba_undo_within_window_succeeds(client, monkeypatch):
    _override_user(BA_USER)
    _stub_supabase(
        monkeypatch,
        {
            "ba_profiles": [FakeResponse({"id": BA_PROFILE_ID})],
            "location_check_ins": [
                FakeResponse(
                    [
                        {
                            "id": CHECKIN_ID,
                            "check_out_time": _now_iso(-5),
                            "is_end_of_day": False,
                            "check_in_time": _now_iso(-60),
                        }
                    ]
                ),
                FakeResponse([{"id": CHECKIN_ID}]),  # update result
            ],
            "job_day_locations": [FakeResponse({"id": LOCATION_ID})],
            "travel_logs": [FakeResponse([])],  # delete result
        },
    )
    res = client.post(f"/api/jobs/{JOB_ID}/locations/{LOCATION_ID}/undo-checkout")
    assert res.status_code == 200, res.text
    assert res.json()["check_in_id"] == CHECKIN_ID


def test_ba_undo_outside_window_rejected(client, monkeypatch):
    _override_user(BA_USER)
    _stub_supabase(
        monkeypatch,
        {
            "ba_profiles": [FakeResponse({"id": BA_PROFILE_ID})],
            "location_check_ins": [
                FakeResponse(
                    [
                        {
                            "id": CHECKIN_ID,
                            "check_out_time": _now_iso(-45),  # 45 minutes ago
                            "is_end_of_day": False,
                            "check_in_time": _now_iso(-180),
                        }
                    ]
                )
            ],
        },
    )
    res = client.post(f"/api/jobs/{JOB_ID}/locations/{LOCATION_ID}/undo-checkout")
    assert res.status_code == 400
    assert "30 minutes" in res.json()["detail"]


def test_ba_undo_end_of_day_rejected(client, monkeypatch):
    _override_user(BA_USER)
    _stub_supabase(
        monkeypatch,
        {
            "ba_profiles": [FakeResponse({"id": BA_PROFILE_ID})],
            "location_check_ins": [
                FakeResponse(
                    [
                        {
                            "id": CHECKIN_ID,
                            "check_out_time": _now_iso(-5),
                            "is_end_of_day": True,
                            "check_in_time": _now_iso(-60),
                        }
                    ]
                )
            ],
        },
    )
    res = client.post(f"/api/jobs/{JOB_ID}/locations/{LOCATION_ID}/undo-checkout")
    assert res.status_code == 400
    assert "admin" in res.json()["detail"].lower()


def test_ba_undo_when_not_checked_out_rejected(client, monkeypatch):
    _override_user(BA_USER)
    _stub_supabase(
        monkeypatch,
        {
            "ba_profiles": [FakeResponse({"id": BA_PROFILE_ID})],
            "location_check_ins": [
                FakeResponse(
                    [
                        {
                            "id": CHECKIN_ID,
                            "check_out_time": None,
                            "is_end_of_day": False,
                            "check_in_time": _now_iso(-30),
                        }
                    ]
                )
            ],
        },
    )
    res = client.post(f"/api/jobs/{JOB_ID}/locations/{LOCATION_ID}/undo-checkout")
    assert res.status_code == 400
    assert "not checked out" in res.json()["detail"].lower()


def test_admin_can_undo_end_of_day(client, monkeypatch):
    _override_user(ADMIN_USER)
    _stub_supabase(
        monkeypatch,
        {
            "location_check_ins": [
                FakeResponse(
                    [
                        {
                            "id": CHECKIN_ID,
                            "check_out_time": _now_iso(-180),  # 3 hours ago — past BA window
                            "is_end_of_day": True,
                            "check_in_time": _now_iso(-600),
                        }
                    ]
                ),
                FakeResponse([{"id": CHECKIN_ID}]),  # update result
            ],
            "job_day_locations": [FakeResponse({"id": LOCATION_ID})],
            "travel_logs": [FakeResponse([])],
        },
    )
    res = client.post(f"/api/jobs/{JOB_ID}/locations/{LOCATION_ID}/undo-checkout")
    assert res.status_code == 200, res.text


def test_missing_location_returns_404(client, monkeypatch):
    _override_user(BA_USER)
    _stub_supabase(
        monkeypatch,
        {
            "ba_profiles": [FakeResponse({"id": BA_PROFILE_ID})],
            "location_check_ins": [FakeResponse([])],
        },
    )
    res = client.post(f"/api/jobs/{JOB_ID}/locations/{LOCATION_ID}/undo-checkout")
    assert res.status_code == 404
