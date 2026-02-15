# Coding Conventions

**Analysis Date:** 2026-02-15

## Naming Patterns

**Files:**
- Python modules: `snake_case` (e.g., `auth.py`, `ba_profiles.py`)
- TypeScript/React components: PascalCase for components (e.g., `Button.tsx`, `Header.tsx`), camelCase for utilities (e.g., `client.ts`, `middleware.ts`)
- Pages and routes: kebab-case directories with `page.tsx` files (e.g., `/dashboard/my-jobs/page.tsx`)
- Index/barrel files: `index.ts` or `index.tsx` to export collections (e.g., `components/ui/index.ts`, `components/layout/index.ts`)

**Functions:**
- Python: `snake_case` for all function and method names (e.g., `calculate_distance()`, `get_current_user()`)
- TypeScript: `camelCase` for functions and methods (e.g., `createClient()`, `renderJobCard()`)
- Async functions prefix with verb: `async function getMyJobs()`, `async def get_current_user()`

**Variables:**
- Python: `snake_case` (e.g., `current_user`, `max_checkin_distance_meters`)
- TypeScript: `camelCase` (e.g., `userId`, `canCheckIn`)
- Constants: `UPPER_SNAKE_CASE` for module-level constants in Python (e.g., `MAX_CHECKIN_DISTANCE_METERS = 200`)
- React hooks state variables: `camelCase` (e.g., `const [isLoading, setIsLoading] = useState()`)

**Types:**
- Python: Pydantic `BaseModel` classes in PascalCase (e.g., `JobCreate`, `BAProfileResponse`)
- TypeScript: Interface names in PascalCase with suffix pattern: `Props`, `Response`, `Status` (e.g., `ButtonProps`, `UserResponse`, `BAStatus`)
- Enums: PascalCase class name with UPPER_CASE values (e.g., `class JobStatus(str, Enum): DRAFT = "draft"`)

## Code Style

**Formatting:**
- Python: No explicit formatter configured, but follows PEP 8 conventions
- TypeScript: No explicit formatter (Prettier/ESLint not configured), but code uses consistent spacing and indentation
- Indentation: 4 spaces (Python), 2 spaces (TypeScript/JSX)

**Linting:**
- Python: Ruff is configured in `pyproject.toml`
  - Target version: py311
  - Line length: 100 characters
  - Enabled rules: E (pycodestyle errors), W (warnings), F (pyflakes), I (isort), B (flake8-bugbear), C4 (flake8-comprehensions), UP (pyupgrade)
  - Ignored rules: E501 (line too long), B008 (function calls in defaults)
- TypeScript: ESLint enabled (`eslint` in package.json) but config file not present; uses eslint-config-next
- MyPy: Configured for Python type checking
  - Python version: 3.11
  - Strict mode enabled: disallow_untyped_defs = true
  - Warnings: warn_return_any, warn_unused_configs

## Import Organization

**Order (Python):**
1. FastAPI/standard library imports
2. Third-party imports (pydantic, jose, etc.)
3. Application imports (app.core, app.api, etc.)

Example from `backend/app/api/jobs.py`:
```python
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
import math

from app.core.auth import get_current_user, get_current_admin, get_current_ba, CurrentUser, get_optional_user
from app.core.supabase import get_supabase_client
```

**Order (TypeScript):**
1. Next.js imports
2. React imports
3. Third-party library imports (supabase)
4. Relative imports (with @/ path aliases)

Example from `frontend/src/app/dashboard/my-jobs/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, Badge } from '@/components/ui'
```

**Path Aliases:**
- TypeScript: `@/*` resolves to `./src/*` (configured in `tsconfig.json`)

## Error Handling

**Python Patterns:**
- Use `HTTPException` from FastAPI with appropriate status codes (401, 403, 404, 500, etc.)
- Include meaningful error messages in `detail` parameter
- Raise exceptions early for validation checks
- Return structured error responses with status_code and detail fields

Example from `backend/app/api/jobs.py`:
```python
if not result.data:
    raise HTTPException(status_code=404, detail="Job not found")

if distance > MAX_CHECKIN_DISTANCE_METERS:
    raise HTTPException(
        status_code=400,
        detail=f"You are too far from the job location. Distance: {int(distance)}m (max: {MAX_CHECKIN_DISTANCE_METERS}m)",
    )
```

**TypeScript Patterns:**
- Use `redirect()` for navigation-based redirects in Server Components
- Try-catch blocks for async operations (implicit in async/await)
- Return null or empty states for missing data in components
- Pass error states as props for error boundaries

Example from `frontend/src/app/dashboard/layout.tsx`:
```typescript
if (!user) {
  redirect('/auth/login')
}

if (!profile) {
  redirect('/auth/setup')
}
```

## Logging

**Framework:** Console-based logging (no dedicated logging library)

**Patterns:**
- Not extensively used in current codebase
- Error details are communicated via HTTPException/redirect
- Database query failures are caught and returned as structured errors

## Comments

**When to Comment:**
- Module-level docstrings for endpoints (FastAPI)
- Function docstrings for public API endpoints explaining parameters and return types
- Inline comments for non-obvious calculations (e.g., Haversine formula in `backend/app/api/jobs.py`)
- TODOs for incomplete features (e.g., `# TODO: Implement with Stripe Connect`)

**JSDoc/TSDoc:**
- Function docstrings in Python using triple-quote format:
```python
async def check_in(
    job_id: str,
    check_in_data: CheckInRequest,
    current_user: CurrentUser = Depends(get_current_ba),
):
    """Check in to a job with GPS coordinates."""
```

- TypeScript: Minimal JSDoc usage; type information in interface declarations preferred

## Function Design

**Size:** Functions are typically 5-50 lines; longer functions (100+ lines) are used for complex endpoint handlers

**Parameters:**
- Python: Use dependency injection with FastAPI's `Depends()` for auth and database access
- TypeScript: Use destructuring for component props, prefer optional chaining for nested objects

Example from `backend/app/api/auth.py`:
```python
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
):
```

**Return Values:**
- Python: Return Pydantic models for structured responses, dicts for flexible responses, or raw values
- TypeScript: Return JSX elements from components, Promise<data> from async functions

## Module Design

**Exports:**
- Python: Use `router` objects as module exports (e.g., `router = APIRouter()` then `include_router(...)`)
- TypeScript: Named exports for components and utilities, prefer `export const` over default exports

Example from `frontend/src/components/ui/button.tsx`:
```typescript
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...)
Button.displayName = 'Button'
```

**Barrel Files:**
- Used in `frontend/src/components/ui/index.ts` to export all UI components
- Used in `frontend/src/components/layout/index.ts` to export layout components
- Pattern: `export { Component1, Component2 } from './component1'`

## TypeScript Specific Conventions

**React Component Patterns:**
- Use `'use client'` directive at top of client components in Next.js 13+
- Use `forwardRef` for components that need ref forwarding: `export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...)`
- Set `displayName` on forwarded components: `Button.displayName = 'Button'`
- Use TypeScript `interface` for component props extending HTML attributes

Example from `frontend/src/components/ui/card.tsx`:
```typescript
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
```

**Styling:**
- Tailwind CSS classes passed as string in `className` prop
- Variant styles stored as `Record<VariantType, string>` objects
- Conditional classes concatenated with template literals

Example from `frontend/src/components/ui/button.tsx`:
```typescript
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-400',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-400',
}
```

---

*Convention analysis: 2026-02-15*
