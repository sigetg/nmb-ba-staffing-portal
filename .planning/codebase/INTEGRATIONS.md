# External Integrations

**Analysis Date:** 2026-02-15

## APIs & External Services

**Payment Processing:**
- Stripe - Payment processing and financial transactions
  - SDK/Client: `stripe` (Python backend), `@stripe/stripe-js` (frontend)
  - Auth: `STRIPE_SECRET_KEY` (backend), `STRIPE_WEBHOOK_SECRET` (webhooks), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (frontend)
  - Reference: `backend/app/core/config.py` stores credentials

**Communication:**
- Resend - Email delivery service
  - SDK/Client: `resend` (Python backend)
  - Auth: `RESEND_API_KEY` (backend)
  - Reference: `backend/app/core/config.py`

- Twilio - SMS/messaging service
  - SDK/Client: `twilio` (Python backend)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (backend), `TWILIO_PHONE_NUMBER` (sender)
  - Reference: `backend/app/core/config.py`

**Location Services:**
- Google Maps API - Geolocation and mapping
  - Auth: `GOOGLE_MAPS_API_KEY` (backend), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (frontend)
  - Reference: `backend/app/core/config.py`
  - Usage: Maps integration for job locations and BA assignments

## Data Storage

**Databases:**
- Supabase (PostgreSQL-backed)
  - Type: PostgreSQL 15.1.0.117 (local), 17 (production)
  - Connection: `DATABASE_URL` for direct connection, Supabase client APIs for SDK access
  - Client:
    - Backend: `supabase` (Python SDK) via `backend/app/core/supabase.py`
    - Frontend: `@supabase/supabase-js` (JavaScript SDK) via `frontend/src/lib/supabase/client.ts`, `frontend/src/lib/supabase/server.ts`
  - Auth endpoints: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (backend admin)
  - Migrations: `supabase/migrations/` directory with versioned SQL files
  - Local emulator: Supabase Docker containers with local database on port 54322

**File Storage:**
- Supabase Storage (cloud-based file storage)
  - Accessed via Supabase SDK
  - Configuration in `supabase/config.toml`: file size limit 50MiB
  - Buckets: Pre-configured buckets (images, etc.) can be configured

**Caching:**
- Not detected in current configuration

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (custom implementation)
  - Implementation: JWT-based authentication with Supabase backend
  - Backend: Custom JWT token handling via `python-jose[cryptography]`
    - `backend/app/core/auth.py` - Auth middleware and token validation
    - Secret: `SECRET_KEY` for JWT signing (HS256 algorithm, 30-minute expiry)
  - Frontend: Supabase session management
    - `frontend/src/lib/supabase/client.ts` - Browser client with cookie handling
    - `frontend/src/lib/supabase/server.ts` - Server-side session management with cookie middleware
  - Local testing: Email/password signup enabled in `supabase/config.toml`
  - JWT expiry: 3600 seconds (1 hour) in local config

**Multi-Factor Authentication:**
- MFA via Supabase: TOTP and phone-based options available but not enabled
  - Configuration: `supabase/config.toml` [auth.mfa] section

## Monitoring & Observability

**Error Tracking:**
- Not detected - No error tracking service configured (Sentry, Rollbar, etc.)

**Logs:**
- Console logging approach (standard Python logging and browser console)
- Local Supabase provides query logs via Studio UI on port 54323

## CI/CD & Deployment

**Hosting:**
- Render.com (Infrastructure-as-Code via `render.yaml`)
  - Backend service: `nmb-ba-api` on Python runtime
  - Frontend service: `nmb-ba-frontend` on Node runtime
  - Region: Oregon
  - Plan: Free tier

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or other pipeline configured
- Manual deployment via Render Blueprint or git push

**Database Hosting:**
- Supabase Cloud (managed PostgreSQL with built-in auth and storage)

## Environment Configuration

**Required env vars (Backend):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (admin access)
- `SECRET_KEY` - JWT signing secret (must be unique per environment)
- `STRIPE_SECRET_KEY` - Stripe API secret
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `GOOGLE_MAPS_API_KEY` - Google Maps API key
- `RESEND_API_KEY` - Resend email API key
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Twilio SMS config

**Required env vars (Frontend):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key
- `NEXT_PUBLIC_API_URL` - Backend API base URL (auto-injected from Render service connection)

**Secrets location:**
- Development: `.env` file in project root (never committed)
- Production: Render environment variables dashboard
- Template: `.env.example` provides all required variables

## Webhooks & Callbacks

**Incoming:**
- Stripe webhooks - Payment/subscription events
  - Endpoint: Not yet implemented, but `STRIPE_WEBHOOK_SECRET` configured
  - Events: Subscription creation, payment completion, charge failures (setup ready)

**Outgoing:**
- Not detected in current implementation
- Resend/Twilio use one-way API calls (not webhooks)

## API Communication

**Backend-to-Frontend:**
- RESTful API via FastAPI
- Endpoint: `NEXT_PUBLIC_API_URL` (auto-resolved from Render service in production)
- CORS configured in `backend/main.py`:
  - Allow origins: localhost:3000 (dev), configured in settings
  - Allow credentials, methods, headers enabled

**Service Integrations:**
- All external services use SDK clients rather than direct HTTP calls
- Stripe: `stripe` Python client
- Resend: `resend` Python client
- Twilio: `twilio` Python client
- Supabase: Native SDKs for both backend and frontend

## Render Blueprint Configuration

**Service Connections:**
- Frontend service can reference backend service via `NEXT_PUBLIC_API_URL` environment variable
- Auto-populated from backend service host property
- Example: `fromService: { type: web, name: nmb-ba-api, property: host }`

**Environment Sync:**
- Development secrets: local `.env` file
- Production secrets: Render dashboard with `sync: false` for sensitive keys
  - Keys managed separately and not synced from git

---

*Integration audit: 2026-02-15*
