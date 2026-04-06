# PharmaCentral — Omni-Channel Pharmacy Operations Platform

<div align="center">
  <img src="https://img.shields.io/badge/Python-3.12-blue?style=flat-square&logo=python" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-teal?style=flat-square&logo=fastapi" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ed?style=flat-square&logo=docker" />
  <img src="https://img.shields.io/badge/AI-Prophet%20%2B%20LightGBM-ff6b35?style=flat-square" />
</div>

---

## Overview

PharmaCentral is a production-grade, microservices-based **Omni-Channel Pharmacy Operations Web Platform** for a 180-outlet healthcare retail group operating across India. It provides real-time operations management, GST-compliant POS billing, AI-driven demand forecasting, anomaly detection, and BI reporting — all in a responsive dark-mode UI optimised for low-bandwidth environments.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                  React 18 + TypeScript                  │  Frontend
│          (Vite · TanStack Query · Zustand · Recharts)   │
└──────────────────────┬─────────────────────────────────┘
                       │  HTTP (gzip compressed)
┌──────────────────────▼─────────────────────────────────┐
│              Nginx API Gateway                           │  Rate limiting
│        /api/v1/auth → auth_service:8000                 │  TLS termination
│        /api/v1/*    → inventory/billing/ai:8000         │  Compression
└──────┬──────────┬──────────┬──────────┬────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼──────────┐
  │  Auth  │ │Inventory│ │Billing │ │  AI/ML      │  FastAPI
  │Service │ │Service  │ │Service │ │  Service    │  Microservices
  └────┬───┘ └───┬────┘ └──┬─────┘ └──┬──────────┘
       │          │          │          │
  ┌────▼──────────▼──────────▼──────────▼──────────┐
  │              PostgreSQL 16  (per-service DBs)    │
  │  auth_db · inventory_db · billing_db · ai_db    │
  └─────────────────────────────────────────────────┘
                    Redis (cache + sessions)
                    Celery (async AI tasks)
                    Prometheus + Grafana (monitoring)
```

---

## Key Features

### Security & Access Control
- JWT (RS256) authentication with automatic token refresh
- TOTP-based Multi-Factor Authentication (Google Authenticator / Authy)
- Role-Based Access Control: **Head Admin · Branch Manager · Counter Staff**
- Row-Level Security (RLS) at database level
- Immutable 7-year audit log (append-only)

### 📦 Inventory Management
- Product & batch-level stock tracking (append-only ledger)
- Expiry risk classification: Safe / Watch / Warning / Critical / Expired
- Low-stock alerts with configurable reorder thresholds
- Schedule H/X drug tracking with mandatory prescription linking

### 🧾 GST-Compliant Billing & POS
- Full POS terminal with product search, cart, and checkout
- GST calculation (CGST + SGST) per product rate
- Prescription-linked sales for controlled drugs
- Multiple payment modes: Cash · UPI · Card
- Bill history with print support

### 🔄 Replenishment Planning
- Inter-branch stock transfer requests
- Approval workflow (pending → approved → in-transit → completed)
- AI-driven replenishment suggestions

### 📊 BI Reports & Analytics
- 30-day / quarterly / annual sales trend charts
- Branch performance rankings with compliance scores
- Stock ageing analysis (0–30d, 31–90d, >180d, expired)
- Expiry risk dashboard with value-at-risk calculation

### 🤖 AI & ML Capabilities
| Capability | Technology |
|---|---|
| Demand Forecasting | Prophet + LightGBM ensemble |
| Billing Anomaly Detection | Isolation Forest (scikit-learn) |
| Stock Movement Anomaly | CUSUM sequential analysis |
| Conversational BI Queries | Text-to-SQL + OpenAI GPT-4o |
| PII Protection | Column blocklist + row limiting |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Recharts, Zustand, TanStack Query |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), Alembic |
| Database | PostgreSQL 16 (per-service), Redis 7 |
| AI/ML | Prophet, LightGBM, scikit-learn, LangChain, OpenAI |
| Infrastructure | Docker Compose, Nginx, Celery, Prometheus, Grafana |
| Security | JWT RS256, TOTP MFA, Bcrypt, RBAC, RLS |

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+
- Node.js 20+ (for frontend dev)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/pharmaops-platform.git
cd pharmaops-platform
cp .env.example .env
# Edit .env with your secrets
```

### 2. Start all services

```bash
docker-compose up -d
```

Services:
| Service | Port |
|---|---|
| Frontend (Nginx) | http://localhost |
| API Gateway | http://localhost/api/v1 |
| Auth Service | http://localhost:8001 |
| Inventory Service | http://localhost:8002 |
| Billing Service | http://localhost:8003 |
| AI Service | http://localhost:8004 |
| Reporting Service | http://localhost:8005 |
| Grafana | http://localhost:3001 |

### 3. Frontend Development Only

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

**Demo login credentials (no backend needed):**
| Role | Username | Password |
|---|---|---|
| Head Admin | `admin` | `Admin@1234` |
| Branch Manager | `manager` | `Manager@1` |
| Counter Staff | `staff` | `Staff@123` |

---

## Project Structure

```
pharmaops-platform/
├── backend/
│   ├── auth_service/          # JWT, RBAC, MFA
│   ├── inventory_service/     # Products, batches, stock ledger
│   ├── billing_service/       # GST billing, prescriptions, POS
│   ├── ai_service/            # Forecasting, anomaly, Text-to-SQL
│   └── reporting_service/     # BI dashboard data APIs
├── frontend/
│   └── src/
│       ├── pages/             # Dashboard, Inventory, Billing, etc.
│       ├── components/        # Sidebar, shared components
│       ├── store/             # Zustand auth + UI state
│       └── lib/               # Axios API client
├── database/init/             # PostgreSQL init SQL
├── nginx/                     # API gateway config
└── docker-compose.yml
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
POSTGRES_PASSWORD=changeme
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=your-256-bit-secret
JWT_ALGORITHM=RS256
OPENAI_API_KEY=sk-...
SENTRY_DSN=                    # optional
```

---

## Performance Targets

| Metric | Target |
|---|---|
| Concurrent users | 1,200+ (via Locust load tests) |
| API p95 latency | < 200ms |
| Dashboard load | < 1.5s (gzip + code splitting) |
| Offline capability | POS works offline (PWA-ready) |
| Bandwidth optimisation | gzip, lazy loading, Nginx compression |

---

## Security Compliance

- ☑ HIPAA-aligned data handling (PII masking in AI queries)
- ☑ Schedule H/X regulatory compliance (mandatory RX linking)
- ☑ GST compliance (CGST + SGST per product rate)
- ☑ 7-year audit trail retention
- ☑ Bandit (Python SAST) + Trivy (container CVE scanning) in CI

---

## License

MIT © 2024 PharmaCentral. Built for healthcare retail operations across India.
