# Codebase Structure

**Analysis Date:** 2026-02-15

## Directory Layout

```
nmb-ba-staffing-portal/
├── backend/                       # Python FastAPI application
│   ├── main.py                   # FastAPI app initialization and router registration
│   ├── app/
│   │   ├── __init__.py
│   │   ├── api/                  # Route handlers organized by domain
│   │   │   ├── __init__.py
│   │   │   ├── health.py         # Health check endpoints
│   │   │   ├── auth.py           # Auth documentation endpoints
│   │   │   ├── jobs.py           # Job CRUD and check-in/check-out
│   │   │   ├── bas.py            # Brand Ambassador profiles and management
│   │   │   └── admin.py          # Admin dashboard, BA approval, reports
│   │   ├── core/                 # Shared utilities and configuration
│   │   │   ├── __init__.py
│   │   │   ├── config.py         # Environment config via Pydantic Settings
│   │   │   ├── supabase.py       # Supabase client initialization
│   │   │   └── auth.py           # JWT validation and RBAC dependencies
│   │   ├── models/               # Pydantic data models
│   │   │   ├── __init__.py       # Exports all models
│   │   │   ├── user.py           # User model with role enum
│   │   │   ├── ba_profile.py     # BA profile with status enum
│   │   │   ├── job.py            # Job model with status enum
│   │   │   └── job_application.py # Application model with status enum
│   │   └── services/             # Business logic layer (currently empty)
│   │       └── __init__.py
│   ├── tests/                    # Test suite
│   │   ├── __init__.py
│   │   └── test_health.py        # Health endpoint tests
│   ├── venv/                     # Python virtual environment
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile               # Backend container image
│
├── frontend/                      # Next.js React application
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   │   ├── layout.tsx        # Root layout, fonts, metadata
│   │   │   ├── page.tsx          # Home/landing page
│   │   │   ├── globals.css       # Global styles and Tailwind
│   │   │   ├── auth/             # Authentication routes
│   │   │   │   ├── login/page.tsx        # BA login form
│   │   │   │   ├── register/page.tsx     # BA registration form
│   │   │   │   └── setup/page.tsx        # BA profile setup after registration
│   │   │   ├── dashboard/        # BA-only protected routes
│   │   │   │   ├── layout.tsx    # BA dashboard wrapper, role redirect
│   │   │   │   ├── page.tsx      # Dashboard home
│   │   │   │   ├── profile/page.tsx      # BA profile view/edit
│   │   │   │   ├── my-jobs/page.tsx      # BA's applied/assigned jobs
│   │   │   │   ├── jobs/                 # Job browsing for BA
│   │   │   │   │   ├── page.tsx          # Job listing
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx      # Job detail
│   │   │   │   │       ├── check-in/page.tsx    # GPS check-in form
│   │   │   │   │       └── check-out/page.tsx   # GPS check-out form
│   │   │   └── admin/           # Admin-only protected routes
│   │   │       ├── login/page.tsx        # Admin login page
│   │   │       ├── dashboard/
│   │   │       │   ├── layout.tsx        # Admin dashboard wrapper
│   │   │       │   └── page.tsx          # Admin stats dashboard
│   │   │       ├── jobs/                 # Job management
│   │   │       │   ├── page.tsx          # Job listing/admin view
│   │   │       │   ├── new/page.tsx      # Create job form
│   │   │       │   └── [id]/edit/page.tsx # Edit job form
│   │   │       └── bas/                  # BA management
│   │   │           ├── page.tsx          # BA listing
│   │   │           ├── pending/page.tsx  # Pending BA approvals
│   │   │           └── [id]/page.tsx     # BA detail view
│   │   ├── lib/                  # Shared utilities and clients
│   │   │   └── supabase/
│   │   │       └── middleware.ts # Server middleware for auth/authorization
│   │   ├── components/           # Reusable React components
│   │   │   ├── layout/           # Layout components (DashboardLayout, etc.)
│   │   │   └── ui/               # UI building blocks (buttons, forms, etc.)
│   │   └── types/                # TypeScript type definitions
│   ├── public/                   # Static assets (images, icons)
│   ├── .next/                    # Next.js build output (generated)
│   ├── node_modules/             # npm dependencies
│   ├── package.json              # npm dependencies and scripts
│   ├── package-lock.json         # Dependency lock file
│   ├── tsconfig.json             # TypeScript configuration
│   ├── next.config.ts            # Next.js configuration
│   ├── eslint.config.mjs          # ESLint rules
│   ├── postcss.config.mjs         # PostCSS + Tailwind config
│   ├── Dockerfile                # Frontend container image
│   └── .env.example              # Environment variable template
│
├── supabase/                      # Supabase database migrations
│   └── migrations/               # SQL migration files
│
├── docs/                          # Project documentation
├── .github/                       # GitHub Actions CI/CD
├── .planning/                     # GSD planning documents
│   └── codebase/                # Architecture/structure analysis
├── docker-compose.yml            # Local development environment
├── render.yaml                   # Render.com deployment config
└── README.md                     # Project overview
```

## Directory Purposes

**backend/app/api/:**
- Purpose: HTTP request handlers organized by resource domain
- Contains: Router definitions with async endpoint handlers
- Key files:
  - `jobs.py`: 505 lines - Job CRUD, apply, check-in, check-out
  - `admin.py`: 416 lines - BA approval, job assignment, attendance, payments, reports
  - `bas.py`: 314 lines - BA profile CRUD, job applications history
  - `auth.py`: 81 lines - Documentation endpoints (actual auth is client-side)
  - `health.py`: 24 lines - Liveness and readiness probes

**backend/app/core/:**
- Purpose: Reusable infrastructure and configuration
- Contains: Configuration management, database client, authentication middleware
- Key files:
  - `config.py`: 43 lines - Settings class with env vars (Supabase, Stripe, Twilio, etc.)
  - `supabase.py`: 26 lines - Singleton Supabase client with lazy initialization
  - `auth.py`: 165 lines - JWT validation, CurrentUser model, RBAC dependency injection

**backend/app/models/:**
- Purpose: Type definitions for data validation and serialization
- Contains: Pydantic BaseModel classes with enums for status fields
- Total: ~165 lines across 5 files
- Pattern: One model per domain entity (User, Job, BAProfile, JobApplication)

**frontend/src/app/:**
- Purpose: Next.js App Router pages and layouts
- Contains: Page components and layout wrappers organized by route path
- Structure mirrors URL structure (e.g., `app/admin/jobs/[id]/edit/page.tsx` → `/admin/jobs/:id/edit`)
- Key subdivisions:
  - `auth/`: Unauthenticated pages (login, register, setup)
  - `dashboard/`: BA-only protected area
  - `admin/`: Admin-only protected area

**frontend/src/lib/supabase/:**
- Purpose: Supabase client configuration and middleware
- Contains: Server-side session management and route authorization
- Key file: `middleware.ts` - enforces authentication and role-based access

**frontend/src/components/:**
- Purpose: Reusable React components
- Subdivisions:
  - `layout/`: Page layout wrappers (DashboardLayout component imported by layouts)
  - `ui/`: Low-level UI components (likely buttons, inputs, modals)

## Key File Locations

**Entry Points:**
- `backend/main.py`: FastAPI application initialization, router registration
- `frontend/src/app/layout.tsx`: Next.js root layout, metadata, fonts
- `frontend/src/app/page.tsx`: Home/landing page
- `frontend/middleware.ts` (not shown but implied): Next.js middleware entry point

**Configuration:**
- `backend/app/core/config.py`: Backend environment settings
- `frontend/.env.local`: Frontend environment variables (Supabase keys)
- `frontend/tsconfig.json`: TypeScript compiler options with path alias `@/*` → `./src/*`
- `docker-compose.yml`: Local dev environment (Supabase, PostgreSQL, etc.)

**Core Logic:**
- `backend/app/api/jobs.py`: Job lifecycle and check-in/check-out logic
- `backend/app/api/admin.py`: Admin operations (approvals, reports, payments)
- `backend/app/core/auth.py`: JWT validation and role-based guards
- `frontend/src/lib/supabase/middleware.ts`: Route protection and session validation

**Testing:**
- `backend/tests/test_health.py`: Single health endpoint test (limited coverage)

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `auth.py`, `ba_profile.py`)
- TypeScript/React: `camelCase.ts` and `PascalCase` for components (e.g., `page.tsx`, `middleware.ts`)
- Directories: `snake_case/` for Python packages, `kebab-case/` for route segments (e.g., `check-in/`)

**Functions:**
- Python: `snake_case()` for all functions (e.g., `get_current_user()`, `apply_to_job()`)
- TypeScript: `camelCase()` for functions, `PascalCase` for React components (e.g., `updateSession()`, `DashboardLayout`)

**Variables:**
- Python: `snake_case` for all variables (e.g., `ba_id`, `job_id`, `current_user`)
- TypeScript: `camelCase` for all variables (e.g., `userId`, `jobId`)

**Types:**
- Python: `PascalCase` for Pydantic models and Enums (e.g., `User`, `JobStatus`)
- TypeScript: `PascalCase` for interfaces and types

**Database Tables:**
- Plural, `snake_case` (inferred from API calls): `users`, `ba_profiles`, `jobs`, `job_applications`, `check_ins`, `payments`, `ba_photos`

**Environment Variables:**
- `SCREAMING_SNAKE_CASE` (e.g., `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Frontend: `NEXT_PUBLIC_*` prefix for client-side variables

## Where to Add New Code

**New Feature (e.g., Job Chat):**
- Primary code:
  - Backend: `backend/app/api/messages.py` (new router) + `backend/app/models/message.py`
  - Frontend: `frontend/src/app/dashboard/jobs/[id]/messages/page.tsx` (new page)
  - Database: `supabase/migrations/20240215_add_messages_table.sql`
- Tests:
  - Backend: `backend/tests/test_messages.py`
  - Frontend: Consider adding component/integration tests (currently minimal)

**New Component/Module:**
- Implementation:
  - Reusable: `frontend/src/components/ui/` or `frontend/src/components/layout/`
  - Route-specific: Co-located with page (e.g., form component in same directory as page)
  - Backend service: `backend/app/services/message_service.py` (if business logic is complex)

**Utilities:**
- Shared helpers:
  - Backend: `backend/app/core/utils.py` (e.g., distance calculation, date formatting)
  - Frontend: `frontend/src/lib/` subdirectory (e.g., `frontend/src/lib/utils.ts`)

## Special Directories

**backend/venv/:**
- Purpose: Python virtual environment
- Generated: Yes (git-ignored)
- Committed: No

**.next/:**
- Purpose: Next.js build output and development server cache
- Generated: Yes (git-ignored)
- Committed: No

**node_modules/:**
- Purpose: npm package dependencies
- Generated: Yes (git-ignored)
- Committed: No

**supabase/migrations/:**
- Purpose: Database schema evolution
- Generated: No (manually written)
- Committed: Yes
- Pattern: `YYYYMMDDHHMMSS_description.sql` (e.g., `20240212000000_fix_rls_and_storage.sql`)

**.env files:**
- Purpose: Environment configuration
- `.env.example`: Template for required variables (committed)
- `.env`, `.env.local`: Actual secrets (git-ignored, not committed)
- Frontend: `.env.local` loaded by Next.js (git-ignored)
- Backend: `.env` loaded by Pydantic Settings (git-ignored)

**docs/:**
- Purpose: Project documentation
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-02-15*
