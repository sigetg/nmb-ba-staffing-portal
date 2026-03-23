# Technology Stack

**Analysis Date:** 2026-02-15

## Languages

**Primary:**
- TypeScript 5.x - Frontend (Next.js)
- Python 3.11 - Backend (FastAPI)

**Secondary:**
- JavaScript (Next.js configuration)
- SQL (PostgreSQL migrations in Supabase)

## Runtime

**Environment:**
- Backend: Python 3.11-slim Docker image
- Frontend: Node.js 20-alpine Docker image
- Local Development: docker-compose with multi-container setup

**Package Manager:**
- Backend: pip (Python package manager)
  - Lockfile: `requirements.txt`
- Frontend: npm
  - Lockfile: `package-lock.json`

## Frameworks

**Core:**
- FastAPI 0.109.2 - REST API framework for backend
- Next.js 16.1.6 - Full-stack React framework for frontend
- React 19.2.3 - UI library for frontend
- React DOM 19.2.3 - React rendering library

**Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind

**Validation & Configuration:**
- Pydantic 2.6.1 - Python data validation
- pydantic-settings 2.1.0 - Settings management via environment variables

**Testing:**
- pytest 7.0.0+ - Python testing framework
- pytest-asyncio 0.23.4 - Async test support for FastAPI

## Key Dependencies

**Critical:**
- supabase 2.3.4 - Database and auth client for both backend and frontend
  - Backend: `supabase==2.3.4`
  - Frontend: `@supabase/supabase-js==2.95.3`, `@supabase/ssr==0.8.0`
- stripe 8.4.0 - Payment processing integration
- @stripe/stripe-js 8.7.0 - Stripe client library for frontend

**Infrastructure:**
- uvicorn[standard] 0.27.1 - ASGI web server for FastAPI
- asyncpg 0.29.0 - PostgreSQL async driver
- python-multipart 0.0.9 - Form data parsing

**Security:**
- python-jose[cryptography] 3.3.0 - JWT handling
- passlib[bcrypt] 1.7.4 - Password hashing

**External Services:**
- resend 0.7.2 - Email service integration
- twilio 8.13.0 - SMS service integration
- stripe 8.4.0 - Payment processing (also frontend: @stripe/stripe-js)

**Development:**
- ruff 0.2.1 - Python linter and formatter
- mypy 1.8.0 - Static type checker for Python
- eslint 9 - JavaScript linter
- eslint-config-next 16.1.6 - ESLint config for Next.js

## Configuration

**Environment:**
- Backend: Loaded from `.env` file via pydantic-settings
  - `DATABASE_URL` - PostgreSQL connection string
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` - Database auth
  - `SECRET_KEY` - JWT signing key (must be changed in production)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payment processing
  - `GOOGLE_MAPS_API_KEY` - Maps API access
  - `RESEND_API_KEY` - Email service credentials
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS service
  - `ENVIRONMENT` - development or production

- Frontend: Environment variables with `NEXT_PUBLIC_` prefix for browser access
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  - `NEXT_PUBLIC_API_URL` - Backend API endpoint (injected from Render service connection)

**Build:**
- Backend: `backend/Dockerfile` - Python 3.11-slim base
- Frontend: `frontend/Dockerfile` - Node 20-alpine base
- Docker Compose: `docker-compose.yml` - Local development orchestration

## Platform Requirements

**Development:**
- Docker and Docker Compose for containerized local development
- Python 3.11+ with pip
- Node 20+ with npm
- Supabase CLI for database migrations (optional, local dev uses docker)

**Production:**
- Deployment to Render.com (specified in `render.yaml`)
  - Backend: Python runtime on Render
  - Frontend: Node runtime on Render
- Supabase Cloud instance for production database and auth
- PostgreSQL 15 or higher (Supabase managed)

## Database

**Type:** PostgreSQL (managed by Supabase)
- Major version: 17 (configured in `supabase/config.toml`)
- Local dev: PostgreSQL 15.1.0.117 via Docker

**Client Libraries:**
- Backend: `supabase` Python client (handles async queries via asyncpg)
- Frontend: `@supabase/supabase-js` for browser access

## Architecture Notes

**Deployment Target:**
- Render Blueprint: `render.yaml` - Infrastructure as Code for Render.com
  - Backend service: `nmb-ba-api` (Python runtime, free plan)
  - Frontend service: `nmb-ba-frontend` (Node runtime, free plan)
  - Both services auto-configured with environment variables and inter-service dependencies

**Local Development:**
- Docker Compose orchestrates backend, frontend, and optional local Supabase
- Backend API serves on port 8000 with hot-reload
- Frontend development server serves on port 3000
- Supabase local emulator on ports 54320-54327 (optional)

---

*Stack analysis: 2026-02-15*
