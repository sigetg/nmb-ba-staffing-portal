# Codebase Concerns

**Analysis Date:** 2026-02-15

## Tech Debt

### Incomplete Payment Integration
- **Issue:** Payment system only has stub implementations. `POST /api/admin/payments/trigger` raises 501 Not Implemented
- **Files:** `backend/app/api/admin.py:285-295`
- **Impact:** Core business functionality (paying Brand Ambassadors) cannot be executed. Portal is not production-ready without this
- **Fix approach:** Implement Stripe Connect integration endpoint with proper webhook handling, fund recipient creation, and idempotency keys

### Incomplete Photo Upload Endpoint
- **Issue:** Photo upload endpoint delegates entirely to client-side with no server-side handling. Returns 501 Not Implemented
- **Files:** `backend/app/api/bas.py:268-282`
- **Impact:** Cannot properly track which photos were uploaded in database after client-side storage operations
- **Fix approach:** Implement proper endpoint to accept photo URLs from client, validate, and create database records

### Bare Exception Handling in Auth Module
- **Issue:** `get_optional_user()` catches all exceptions with bare `except Exception` and silently returns None
- **Files:** `backend/app/core/auth.py:164-165`
- **Impact:** Legitimate errors (network failures, Supabase outages) masked as authentication failures. Makes debugging production issues very difficult
- **Fix approach:** Catch specific exceptions (JWTError, ApiError, etc.) and log appropriately

### Database Connectivity Check Missing
- **Issue:** Health check endpoint does not verify database connectivity. Returns "ready" without checking Supabase
- **Files:** `backend/app/api/health.py:20`
- **Impact:** Load balancers may route traffic to instances that cannot reach the database
- **Fix approach:** Add database connectivity test to `/health/ready` endpoint

### Hardcoded Development Secret Key
- **Issue:** Default secret key in config is "dev-secret-key-change-in-production"
- **Files:** `backend/app/core/config.py:16`
- **Impact:** If deployed with default config, all JWT tokens can be forged with known key
- **Fix approach:** Require environment variable override with validation at startup

### Global Supabase Client State
- **Issue:** Supabase client stored in module-level global variable `_supabase_client` with manual None check
- **Files:** `backend/app/core/supabase.py:4-16`
- **Impact:** Not thread-safe in async context. Testing becomes difficult. Client lifecycle unclear
- **Fix approach:** Use FastAPI dependency injection or context variables for client management

## Known Bugs

### Timezone Inconsistency in Datetime Handling
- **Symptoms:** Using `datetime.utcnow()` mixed with `datetime.fromisoformat()` with Z suffix replacement. Potential offset issues in reports
- **Files:** `backend/app/api/jobs.py:498-499`, `backend/app/api/admin.py:394-395`
- **Trigger:** Any check-in/check-out that crosses midnight or timezone boundary when calculating hours worked
- **Workaround:** Assume all times are UTC, manual verification of payment calculations needed

### JWT Decoding Uses Service Role Key Incorrectly
- **Symptoms:** Attempting to decode JWT using `supabase_service_role_key` with HS256 algorithm
- **Files:** `backend/app/core/auth.py:44-49`
- **Trigger:** Any authentication attempt will fail JWT decode step, falls back to Supabase API verification
- **Workaround:** Fallback mechanism catches the error, but adds latency to every auth request

### Silent Failures in Batch Operations
- **Symptoms:** When assigning multiple BAs to job, failures are silently accumulated without explicit error messages
- **Files:** `backend/app/api/admin.py:153-168`
- **Trigger:** Database updates fail partway through BA assignments
- **Workaround:** Check response count to infer failures, but no way to know which specific BAs failed

## Security Considerations

### Admin Route Authorization Not Enforced in Database
- **Risk:** Middleware checks role in auth token but doesn't enforce row-level security. Admins could theoretically query BA data they shouldn't see with direct API calls
- **Files:** `frontend/src/lib/supabase/middleware.ts:77-98`, `backend/app/api/admin.py` (no RLS in endpoints)
- **Current mitigation:** Frontend middleware checks role. Supabase RLS policies exist in database
- **Recommendations:** Verify RLS policies are active on all tables. Add audit logging for admin operations. Document security model clearly

### Plain Text Phone Numbers in Database
- **Risk:** Phone numbers stored unencrypted in `ba_profiles.phone` column. Supabase Storage/Database audit logs may expose PII
- **Files:** `backend/app/models/ba_profile.py`, `supabase/migrations/20240101000000_initial_schema.sql:18`
- **Current mitigation:** None detected
- **Recommendations:** Consider encryption at rest. Implement data masking in logs/exports. Add GDPR export/deletion capabilities

### CORS Configuration Too Permissive in Development
- **Risk:** CORS allows all methods `["*"]` and all headers `["*"]`
- **Files:** `backend/main.py:16-22`
- **Current mitigation:** Origins limited to localhost (but needs env var override)
- **Recommendations:** Document production CORS setup. Add validation that origins are set in production. Consider reducing allowed methods

### Unauthenticated Job Listing Endpoint
- **Risk:** `/api/jobs/` endpoint accepts unauthenticated requests and exposes job details including pay rates and location
- **Files:** `backend/app/api/jobs.py:103-146`
- **Current mitigation:** Filters to only published/in_progress jobs
- **Recommendations:** Consider requiring authentication. Document what data is public. Monitor for scraping

## Performance Bottlenecks

### N+1 Query Problem in Admin Reports
- **Problem:** BA performance report fetches all approved BAs, then makes individual queries for each BA's check-ins
- **Files:** `backend/app/api/admin.py:373-388`
- **Cause:** Loop with query inside loop. No batch loading
- **Improvement path:** Use single query with JOINs and aggregation. Cache results if report generation is slow

### Inefficient Job Attendance Report
- **Problem:** Fetches all job applications with full join, then loops through to extract checkin data
- **Files:** `backend/app/api/admin.py:252-282`
- **Cause:** Pulling entire nested objects when only checkin status needed
- **Improvement path:** Use database aggregation functions. Select only required fields

### Missing Database Indexes
- **Problem:** Queries filter by `job_id`, `ba_id`, `user_id`, `status` frequently but no index performance data available
- **Files:** All API endpoints in `backend/app/api/`
- **Cause:** Schema doesn't specify indexes beyond primary keys and unique constraints
- **Improvement path:** Add indexes on foreign keys and frequently filtered columns

### Frontend Dashboard Makes Multiple Queries
- **Problem:** Dashboard page makes separate queries for pending count, approved count, and upcoming jobs (3+ separate requests)
- **Files:** `frontend/src/app/dashboard/page.tsx:28-49`
- **Cause:** Separate `select` calls with different filters
- **Improvement path:** Combine into single query or use aggregation functions

## Fragile Areas

### Authentication Module
- **Files:** `backend/app/core/auth.py`
- **Why fragile:** Multiple fallback paths (JWT decode → Supabase API verify → database lookup). Silent exception handling masks errors. Logic for getting profile only for BAs means role field is unreliable for non-BA users
- **Safe modification:** Must maintain all three authentication paths. Add comprehensive logging for each branch. Write tests for each fallback scenario
- **Test coverage:** Only health endpoint has basic tests. No auth endpoint tests exist. No error case coverage

### Job Check-in/Check-out Workflow
- **Files:** `backend/app/api/jobs.py:346-505`
- **Why fragile:** Depends on exact job location coordinates. GPS distance calculation is critical for pay verification. No retry logic if database write fails after GPS validation passes. Check-out uses current time instead of request time
- **Safe modification:** Add idempotency keys. Validate GPS calculation before database changes. Use request timestamps, not server time
- **Test coverage:** No tests exist for distance calculation. No negative case tests (user too far away)

### Role-Based Access Control
- **Files:** `backend/app/core/auth.py`, `frontend/src/lib/supabase/middleware.ts`
- **Why fragile:** Role stored in users table but BA profile may not exist. Endpoints assume related profile exists without explicit check. Role field used for RBAC but no validation of role values
- **Safe modification:** Validate role value against enum. Add defensive checks for missing profiles. Consider using user roles from auth metadata instead
- **Test coverage:** No tests for permission denied scenarios. No tests for missing profile edge cases

## Scaling Limits

### Single Global Supabase Client
- **Current capacity:** Single client instance shared across all concurrent requests
- **Limit:** May hit connection pooling limits at high concurrency. Global state makes horizontal scaling difficult
- **Scaling path:** Switch to connection pooling per request context using FastAPI dependency injection

### JWT Verification Fallback to API
- **Current capacity:** Every failed JWT decode triggers Supabase API call (approximately N% of requests)
- **Limit:** API verification is 2-3x slower than local decode, adds latency to all auth failures
- **Scaling path:** Fix JWT decode to use correct key. Cache auth results briefly to avoid repeated failures

### Report Generation Without Pagination
- **Current capacity:** Admin reports fetch all records into memory
- **Limit:** Reports with 10,000+ records will consume significant memory and time
- **Scaling path:** Implement pagination or streaming for reports. Add data export to background jobs

## Dependencies at Risk

### python-jose[cryptography]==3.3.0
- **Risk:** Version is 1+ years old. Cryptography library updated frequently with security patches
- **Impact:** Known vulnerabilities possible in JWT handling
- **Migration plan:** Update to latest python-jose and cryptography versions. Run security audit

### passlib[bcrypt]==1.7.4
- **Risk:** Not used in current codebase despite being in requirements (password hashing delegated to Supabase)
- **Impact:** Unnecessary dependency increases attack surface
- **Migration plan:** Remove from requirements.txt. If passwords are managed locally in future, implement proper update strategy

### Supabase SDK Version Lock
- **Risk:** Both Python `supabase==2.3.4` and JavaScript `@supabase/supabase-js@^2.95.3` may fall behind latest versions
- **Impact:** Missing bug fixes, performance improvements, security patches
- **Migration plan:** Set up automated dependency updates. Test regularly against latest SDK versions

## Missing Critical Features

### Audit Logging
- **Problem:** No logging of admin actions (BA approvals, payments, job assignments). Impossible to audit who did what
- **Blocks:** Compliance with legal requirements. Investigation of suspicious activity
- **Recommendation:** Add audit table, log all admin mutations with user_id and timestamp

### Payment Webhooks
- **Problem:** No webhook handling for Stripe events (payment confirmed, failed, disputed)
- **Blocks:** Cannot update payment status without manual intervention
- **Recommendation:** Implement webhook receiver before enabling real payments

### Background Jobs
- **Problem:** All operations are synchronous HTTP endpoints. Long-running tasks (report generation, bulk payments) block requests
- **Blocks:** Scalability. User experience for long operations
- **Recommendation:** Add job queue (Celery, Temporal, etc.) for background tasks

### Data Export/GDPR Compliance
- **Problem:** No way to export user data or handle deletion requests
- **Blocks:** GDPR compliance. User data portability
- **Recommendation:** Implement data export endpoints. Add cascade delete logic

## Test Coverage Gaps

### Authentication Edge Cases
- **What's not tested:** JWT decode failures, missing profiles, expired tokens, invalid roles, concurrent auth requests
- **Files:** `backend/app/core/auth.py`, test files only cover health endpoint
- **Risk:** Auth changes break silently. Role-based access vulnerable to regression
- **Priority:** High - auth failures impact all users

### Admin Operations
- **What's not tested:** BA approval workflow, payment triggers, report generation, job assignment with slot limits
- **Files:** `backend/app/api/admin.py` (416 lines, zero tests)
- **Risk:** Business logic errors go undetected. Payments could be made incorrectly
- **Priority:** High - financial impact

### Geolocation Check-in
- **What's not tested:** Distance calculation, invalid coordinates, boundary conditions (exactly at limit)
- **Files:** `backend/app/api/jobs.py:88-100` and check-in handler
- **Risk:** Pay fraud possible if distance checks fail silently
- **Priority:** High - financial risk

### Frontend Middleware
- **What's not tested:** Route redirects, role-based access enforcement, cookie session handling
- **Files:** `frontend/src/lib/supabase/middleware.ts` (102 lines, zero tests)
- **Risk:** Users can access unauthorized pages if middleware fails
- **Priority:** High - security impact

### Database Relationships
- **What's not tested:** Cascade deletes, unique constraints, foreign key violations
- **Files:** `supabase/migrations/20240101000000_initial_schema.sql`
- **Risk:** Data corruption possible if constraints don't work as expected
- **Priority:** Medium - data integrity risk

---

*Concerns audit: 2026-02-15*
