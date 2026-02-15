# Testing Patterns

**Analysis Date:** 2026-02-15

## Test Framework

**Runner:**
- pytest - Python testing framework
- Config: `backend/pyproject.toml`
  - Test paths: `tests/`
  - Test file pattern: `test_*.py`
  - asyncio_mode: `auto` (for async test support)

**Assertion Library:**
- Python's built-in `assert` statements
- pytest assertions (e.g., `assert response.status_code == 200`)

**Run Commands:**
```bash
pytest                          # Run all tests
pytest -v                       # Run with verbose output
pytest tests/test_health.py     # Run specific test file
pytest -k "test_health"         # Run tests matching pattern
pytest --cov                    # Run with coverage (if pytest-cov installed)
```

**TypeScript/Frontend:**
- No test framework currently configured (ESLint present but no Vitest/Jest config)

## Test File Organization

**Location:**
- Backend tests co-located in `backend/tests/` directory, separate from source code
- Frontend: No tests currently in repository

**Naming:**
- Python: `test_*.py` pattern (e.g., `test_health.py`)
- Discovery: pytest automatically discovers files matching pattern

**Structure:**
```
backend/
├── app/
│   └── [source code]
├── tests/
│   ├── __init__.py
│   └── test_health.py
└── pyproject.toml
```

## Test Structure

**Suite Organization:**
Pytest uses simple function-based tests. Each test is a standalone function:

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["message"] == "NMB BA Staffing Portal API"


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
```

**Patterns:**
- No explicit setup/teardown functions in current tests
- `TestClient` from `fastapi.testclient` used to test endpoints without running server
- Response assertions: check status_code, JSON structure, and field values
- Each test is isolated and can run independently

## Mocking

**Framework:** Not explicitly used in current tests

**Patterns:**
- Current tests use `TestClient` which runs FastAPI app in-memory
- No external service mocking currently implemented
- Supabase client calls in handlers would need mocking for isolated unit tests (not done currently)

**What to Mock (Best Practices):**
- Supabase database calls when testing endpoints (use pytest fixtures with monkeypatch)
- External API calls (Stripe, Resend, Twilio) when testing admin/payment handlers
- Time-based operations (datetime.utcnow()) for reproducible tests

**What NOT to Mock:**
- FastAPI request/response handling - use TestClient instead
- Pydantic validation - test with real models
- HTTP status codes and response headers

## Fixtures and Factories

**Test Data:**
Current tests use minimal fixture patterns. Example from `backend/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)  # Fixture-like setup
```

**Location:**
- `backend/tests/conftest.py` would be standard location for pytest fixtures (not currently present)
- Fixtures should be shared across test files via conftest.py

**Recommended Pattern for Future Tests:**
```python
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def mock_supabase(monkeypatch):
    """Mock Supabase client."""
    mock = MagicMock()
    monkeypatch.setattr("app.core.supabase.get_supabase_client", lambda: mock)
    return mock


def test_create_job(client, mock_supabase):
    mock_supabase.table().insert().execute.return_value.data = [{"id": "job-1"}]
    response = client.post("/api/jobs/", json={"title": "Test Job"})
    assert response.status_code == 200
```

## Coverage

**Requirements:** No coverage requirements enforced

**View Coverage:**
```bash
pytest --cov=app --cov-report=html  # Generate HTML coverage report
pytest --cov=app --cov-report=term  # Print coverage to terminal
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and endpoint handlers
- Approach: Using TestClient to isolate endpoint behavior
- Current example: `test_root()`, `test_health_check()` in `backend/tests/test_health.py`
- Tests only HTTP contract (request/response), not database interaction

**Integration Tests:**
- Scope: Full endpoint flow with dependencies
- Approach: Would use TestClient with real Supabase calls or fixtures
- Currently not implemented; endpoints depend on Supabase directly
- Recommended: Create fixtures for common data patterns (job creation, user auth, etc.)

**E2E Tests:**
- Framework: Not used
- Frontend: No Cypress/Playwright tests configured
- Would require: Separate test environment with Supabase staging instance

## Async Testing

**Pattern:**
Pytest with `asyncio_mode = "auto"` handles async functions automatically:

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result is not None
```

Currently, `test_health.py` uses synchronous TestClient which handles async endpoints internally. For direct async function testing:

```python
import pytest

@pytest.mark.asyncio
async def test_get_current_user():
    # Direct testing of async dependency functions
    result = await get_current_user(mock_credentials)
    assert result.id == "user-123"
```

## Error Testing

**Pattern:**
Test HTTPException responses by checking status codes and detail messages:

```python
def test_job_not_found(client):
    response = client.get("/api/jobs/nonexistent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found"


def test_unauthorized_access(client):
    response = client.post("/api/jobs/", json={...})  # Without auth token
    assert response.status_code == 403
    assert "Admin access required" in response.json()["detail"]
```

**Example from codebase:**
Endpoints raise `HTTPException` with specific status codes:
```python
if not result.data:
    raise HTTPException(status_code=404, detail="Job not found")

if not current_user.role == "admin":
    raise HTTPException(status_code=403, detail="Admin access required")
```

## Current Test Coverage Analysis

**What IS Tested:**
- `backend/tests/test_health.py` - Health check endpoints
  - GET / endpoint
  - GET /health endpoint with status and timestamp
  - GET /health/ready readiness check

**What is NOT Tested (Gaps):**
- All authentication endpoints (auth.py) - marked as client-side responsibility
- Job CRUD operations (jobs.py) - no tests for create, update, delete, check-in/out
- BA profile operations (bas.py) - no tests for profile creation/updates
- Admin endpoints (admin.py) - no tests for BA approval, job assignment, payment triggering
- Supabase integration - no tests for database queries
- Complex business logic:
  - GPS distance calculation for check-in validation
  - Haversine formula accuracy
  - Role-based access control enforcement
  - Concurrent check-in/out scenarios

**Priority for Testing:**
High priority (core business logic):
1. Check-in/check-out with GPS distance validation (`backend/app/api/jobs.py` lines 346-505)
2. BA approval and job assignment flows (`backend/app/api/admin.py` lines 87-179)
3. Job application and approval logic (`backend/app/api/jobs.py` lines 274-343)

Medium priority (data operations):
1. Profile creation and updates (`backend/app/api/bas.py`)
2. Job CRUD operations (`backend/app/api/jobs.py`)

Low priority (infrastructure):
1. Health check endpoints (already tested)
2. CORS configuration
3. Request/response serialization

## Recommended Testing Strategy

**Test Structure for New Features:**
```
backend/tests/
├── conftest.py                    # Shared fixtures
├── test_health.py                 # ✓ Existing
├── test_auth.py                   # TODO
├── test_jobs.py                   # TODO
├── test_bas.py                    # TODO
├── test_admin.py                  # TODO
└── fixtures/
    ├── user_fixtures.py           # User/auth test data
    ├── job_fixtures.py            # Job test data
    └── ba_fixtures.py             # BA profile test data
```

**Fixture Approach:**
```python
# backend/tests/conftest.py
@pytest.fixture
def auth_user():
    """Create authenticated user for tests."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "role": "ba"
    }

@pytest.fixture
def test_job():
    """Create test job data."""
    return {
        "title": "Brand Ambassador Event",
        "brand": "TestBrand",
        "location": "Downtown",
        "latitude": 40.7128,
        "longitude": -74.0060,
    }
```

---

*Testing analysis: 2026-02-15*
