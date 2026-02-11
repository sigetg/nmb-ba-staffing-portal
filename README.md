# NMB BA Staffing Portal

A two-sided Brand Ambassador staffing and job management platform.

## Overview

- **BA Portal**: Application, profile management, job acceptance, check-in/out, photo uploads, payments
- **Admin Portal**: BA screening, job posting, staff assignment, attendance tracking, payment triggers

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) |
| Backend | Python + FastAPI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| Payments | Stripe Connect |
| Geolocation | Google Maps API |
| Email | Resend |
| SMS | Twilio |
| Hosting | Render |

## Project Structure

```
nmb-ba-staffing-portal/
├── frontend/                 # Next.js application
├── backend/                  # FastAPI application
├── supabase/                 # Supabase migrations & config
├── docs/                     # Documentation
├── .github/workflows/        # CI/CD
└── docker-compose.yml        # Local development
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker (optional, for local Supabase)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on http://localhost:8000

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

## API Documentation

- Backend API docs: http://localhost:8000/docs
- OpenAPI spec: http://localhost:8000/openapi.json

## License

MIT
