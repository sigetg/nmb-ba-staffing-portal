# Architecture

**Analysis Date:** 2026-02-15

## Pattern Overview

**Overall:** Layered architecture with clear separation between frontend (Next.js) and backend (FastAPI). Frontend uses Next.js App Router with server-side authentication middleware. Backend follows REST API pattern with role-based access control.

**Key Characteristics:**
- Monolithic but modular (separate frontend/backend packages)
- Supabase as centralized data and authentication backend
- Server-side session management on frontend via middleware
- Async-first Python backend with FastAPI
- Role-based authorization (BA vs Admin) at route and endpoint levels
- GPS-based location verification for job check-ins

## Layers

**API Layer (Backend):**
- Purpose: RESTful HTTP endpoints for all business operations
- Location: `backend/app/api/`
- Contains: Route handlers organized by domain (`auth.py`, `jobs.py`, `bas.py`, `admin.py`, `health.py`)
- Depends on: Core auth utilities, Supabase client, Pydantic models
- Used by: Frontend client via HTTP calls

**Authentication & Authorization Layer (Backend):**
- Purpose: JWT validation, role-based access control, user session management
- Location: `backend/app/core/auth.py`
- Contains: `get_current_user()`, `get_current_admin()`, `get_current_ba()`, dependency injection helpers
- Depends on: Supabase client, FastAPI security utilities
- Used by: All API routes via FastAPI `Depends()`

**Middleware Layer (Frontend):**
- Purpose: Server-side request interception for authentication and route protection
- Location: `frontend/src/lib/supabase/middleware.ts`
- Contains: `updateSession()` - validates user session and enforces route access policies
- Depends on: Supabase SSR client, Next.js Request/Response
- Used by: Next.js middleware at request entry point

**Data Access Layer (Backend):**
- Purpose: Direct interaction with Supabase tables via SDK
- Location: Embedded in route handlers via `get_supabase_client()` calls
- Contains: Supabase table queries with filters, pagination, joins
- Depends on: Supabase client library, configuration
- Used by: All API endpoints

**Models & Schemas (Backend):**
- Purpose: Pydantic data validation and response serialization
- Location: `backend/app/models/` (Pydantic models), API route files (request/response schemas)
- Contains: User, BAProfile, Job, JobApplication, BAStatus enums
- Depends on: Pydantic, Python stdlib
- Used by: API layer for request validation and type hints

**UI Layer (Frontend):**
- Purpose: React components for user-facing pages
- Location: `frontend/src/app/` (Next.js App Router pages), `frontend/src/components/`
- Contains: Page components, layout wrappers, form components
- Depends on: React, Next.js, Supabase client
- Used by: Browser for rendering

**Configuration Layer:**
- Purpose: Environment-based settings for both systems
- Location: `backend/app/core/config.py`, `frontend/.env.local`
- Contains: Database URLs, API keys, CORS settings, feature flags
- Depends on: Pydantic BaseSettings (backend), environment variables (frontend)
- Used by: Core modules and initialization

## Data Flow

**Job Application Flow:**

1. BA navigates to `/dashboard/jobs` (frontend page)
2. Next.js middleware (`updateSession`) validates BA session, allows access
3. BA clicks "Apply" on job listing
4. Frontend calls `POST /api/jobs/{job_id}/apply` with BA user token
5. Backend `apply_to_job()` validates:
   - User is authenticated BA
   - BA profile exists and is approved
   - Job exists and is accepting applications
   - BA hasn't already applied
6. Backend creates `job_applications` record in Supabase
7. Response returned to frontend; UI updates

**Check-In/Check-Out Flow:**

1. BA at job location opens `/dashboard/jobs/{id}/check-in`
2. Frontend requests GPS coordinates from browser
3. Frontend calls `POST /api/jobs/{job_id}/check-in` with coordinates
4. Backend `check_in()` validates:
   - BA is approved for this job (application status = "approved")
   - No prior check-in exists
   - GPS distance <= 200m from job location (calculated via Haversine formula)
5. Backend creates `check_ins` record with timestamps and coordinates
6. Frontend navigates to `/dashboard/jobs/{id}/check-out`
7. BA calls `POST /api/jobs/{job_id}/check-out` with exit coordinates
8. Backend updates existing check-in record with checkout data and notes
9. Hours worked calculated client-side in response

**Admin Dashboard Flow:**

1. Admin navigates to `/admin/dashboard`
2. Middleware validates admin role, redirects non-admins to `/dashboard`
3. Dashboard layout (`frontend/src/app/admin/dashboard/layout.tsx`) fetches user role
4. Page calls `GET /api/admin/dashboard` to load stats
5. Backend aggregates counts from multiple tables (ba_profiles, jobs, job_applications)
6. Stats displayed in admin overview

**State Management:**

- **Backend State:** Supabase PostgreSQL database (single source of truth)
- **Frontend Session:** Stored in HTTP-only cookies via Supabase SSR client
- **Frontend Component State:** React local state (minimal usage observed)
- **Authentication State:** Delegated to Supabase Auth service, validated via JWT

## Key Abstractions

**Supabase Client Singleton:**
- Purpose: Centralized database connection management
- Examples: `backend/app/core/supabase.py`
- Pattern: Global `_supabase_client` initialized on first use, retrieved via `get_supabase_client()`
- Reasons: Connection pooling, single configuration point

**Dependency Injection (FastAPI):**
- Purpose: Provide authenticated user context to route handlers
- Examples: `get_current_user`, `get_current_admin`, `get_current_ba`
- Pattern: FastAPI `Depends()` mechanism passes security dependency through call stack
- Reasons: Testability, clean separation of auth concerns, reusable guards

**Role-Based Access Control (RBAC):**
- Purpose: Enforce authorization at handler level
- Examples: `@get_current_admin` dependency, middleware route checks
- Pattern: Extract user role from token/database, compare against required role
- Reasons: Prevents privilege escalation, centralized policy

**Enum-Based Status:**
- Purpose: Type-safe state representation
- Examples: `JobStatus`, `BAStatus`, `ApplicationStatus`
- Pattern: Python/TypeScript Enum classes with string values
- Reasons: Prevents invalid state transitions, IDE autocomplete

**Response Models (Pydantic):**
- Purpose: Serialize database rows to JSON safely
- Examples: `JobResponse`, `BAProfileResponse`, `UserResponse`
- Pattern: Separate request/response models from database schemas
- Reasons: API contract clarity, optional field hiding, type validation

## Entry Points

**Backend Entry Point:**
- Location: `backend/main.py`
- Triggers: Application startup (ASGI server)
- Responsibilities:
  - Create FastAPI app instance
  - Register CORS middleware with allowed origins
  - Include routers for each domain (health, auth, jobs, bas, admin)
  - Expose OpenAPI docs at `/docs`

**Frontend Entry Point:**
- Location: `frontend/src/app/layout.tsx` (root layout)
- Triggers: Page load in browser
- Responsibilities:
  - Initialize Next.js metadata
  - Load system fonts (Geist)
  - Wrap all pages with global styles
  - Set up HTML structure

**Authentication Entry Points (Frontend):**
- Location: `frontend/src/app/auth/` routes
- Triggers: User not authenticated or session expired
- Routes:
  - `/auth/login` - Email/password login via Supabase
  - `/auth/register` - New account creation
  - `/auth/setup` - Profile creation after registration
  - `/admin/login` - Admin-specific login page

**Protected Routes:**
- `/dashboard/*` - Requires BA role (redirects to `/auth/login` if unauthenticated)
- `/admin/*` - Requires admin role (redirects to `/admin/login` and then `/dashboard` if BA)

## Error Handling

**Strategy:** Layered error handling with client-friendly messages

**Patterns:**

- **Backend:** FastAPI `HTTPException` with status codes and detail messages
  - 401 Unauthorized: Invalid/expired JWT token
  - 403 Forbidden: Insufficient permissions (non-admin accessing admin route)
  - 404 Not Found: Resource doesn't exist
  - 400 Bad Request: Validation errors (distance too far, slots filled, etc.)
  - 500 Internal Server Error: Database or system failures

- **Frontend Middleware:** Redirect to login on auth failure, role-based redirects

- **Frontend Pages:** No explicit error boundaries observed; relies on middleware and API error responses

## Cross-Cutting Concerns

**Logging:**
- Backend: Standard Python logging (implicit via FastAPI)
- Frontend: Browser console (no structured logging detected)
- Recommendation: Implement centralized logging for production

**Validation:**
- Backend: Pydantic model validation on request bodies
- Frontend: Form validation before submission (client-side only)
- Database: Supabase table constraints (NOT NULL, unique indexes)

**Authentication:**
- Primary: Supabase Auth (handles signup/login)
- Token Format: JWT (HS256 algorithm with Supabase secret key)
- Session: Server-side cookies via Supabase SSR middleware
- Re-authentication: Automatic session refresh on each request via middleware

**Authorization:**
- Mechanism: Role field in `users` table ("ba" or "admin")
- Enforcement: Dependency injection on routes + middleware route guards
- Scope: Entire application (no fine-grained field-level authorization)

---

*Architecture analysis: 2026-02-15*
