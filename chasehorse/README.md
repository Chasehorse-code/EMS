# ChaseHorse EMS — Enterprise Field Operations & Logistics Platform

ChaseHorse EMS is an enterprise-grade workforce orchestration, field audit, and transport management platform designed for high-scale operations in India.

The platform coordinates business customers, distributed on-field workers, operations managers, and commercial logistics transport through an authoritative Java Spring Boot REST API, real Supabase PostgreSQL persistence, cryptographic JWT authentication, and native mobile applications.

---

## Architecture Overview

```
                                 ┌─────────────────────────┐
                                 │   Supabase Auth / DB    │
                                 │  PostgreSQL 15+ & RLS   │
                                 └────────────┬────────────┘
                                              │ (JDBC / Flyway)
                                 ┌────────────▼────────────┐
                                 │    Java 21 Spring Boot  │
                                 │   REST API (/api/v1/*)  │
                                 └──────▲────────────▲─────┘
                                        │ (JWT)      │ (JWT)
                    ┌───────────────────┴──┐      ┌──┴────────────────────┐
                    │  React 18 + TS Web   │      │  React Native Mobile  │
                    │   Vite Admin & Ops   │      │   Expo 52 Field App   │
                    └──────────────────────┘      └───────────────────────┘
```

- **Web Frontend**: React 18, TypeScript, Vite, Vanilla CSS.
- **Mobile Frontend**: React Native 0.76, Expo 52, TypeScript.
- **Backend API**: Java 21, Spring Boot 3.4.5, Spring Security OAuth2 Resource Server, Spring Data JPA, Flyway.
- **Database**: PostgreSQL with Row-Level Security (RLS) policies and versioned Flyway migrations.
- **Authentication**: Supabase Auth (JWT Bearer tokens verified via Supabase JWKS).
- **Storage**: Private Supabase Storage bucket for GPS-watermarked evidence.

---

## Core Enterprise Modules

1. **Role-Based Access Control (RBAC)**: Single role taxonomy (`ADMIN`, `MANAGER`, `OPERATIONS`, `EMPLOYEE`, `CUSTOMER`, `FIELD_WORKER`, `PARTNER`) enforced strictly server-side. Prevention of role escalation.
2. **Customer Tenant Isolation**: Complete tenant scoping on tasks, TMS shipments, and dashboard analytics.
3. **Task Lifecycle State Machine**: Explicit transitions (`OPEN -> ASSIGNED -> IN_PROGRESS -> SUBMITTED -> IN_REVIEW -> APPROVED/REJECTED/CANCELLED`). Workers cannot self-approve.
4. **Atomic Task Claiming**: Atomic SQL updates prevent concurrent race conditions or double-claims. Returns `409 Conflict` on contention.
5. **Geo-Tagged Photographic Evidence**: Field camera viewfinder HUD with real-time GPS coordinate watermarking and device telemetry.
6. **AI Verification & Human Manager Review**: AI verification results stored in `ai_verifications` table; separated from required human operations approvals.
7. **Immutable Wallet Ledger**: Transactional, append-only financial ledger with unique idempotency keys (`idempotency_key`) preventing duplicate reward disbursements.
8. **Transport Management System (TMS)**: Authoritative server-side freight pricing based on payload weight and transport plan rates. Sanitized public tracking view omitting sensitive PII.
9. **Partners Network & Approval Gate**:
   - Top-level `/partners` hub with 3 category cards leading to 7 distinct partner registration flows (`onfield_professional`, `transporter`, `fleet_owner`, `driver`, `freight_trader`, `freight_financial`, `terminal_space`).
   - Server-enforced approval gate: New partners default to `PENDING` status with masked GST numbers (last 4 digits only). Pending and rejected accounts are restricted to the `/pending-approval` status screen.
   - Operations Review Workflow: Operational Managers and Admins inspect submitted data, view unmasked GST, approve or reject with mandatory justification, request information, or perform bulk approvals.
10. **Traqo Tracking & Telemetry Integration**:
   - Secure server-side proxy (`/api/v1/tracking/*`) utilizing HTTP Basic Auth without exposing third-party credentials to browser clients.
   - Token-bucket rate limiter (at most 10 req/s) returning 503 with automated retry notifications.
   - 60-second in-memory location cache conserving quota.
   - Low-balance (403 `{"status":"low_balance"}`) handling with admin-only alerts and graceful manager messaging.
   - Leaflet OpenStreetMap interactive map module with live truck pins, route history polyline, halt markers, consent management, and trip creation.

---

## Getting Started

### 1. Backend REST API (Spring Boot 3.4 / Java 21)
```bash
cd backend/erp-api

# Execute automated security and integration tests
mvn test

# Run API server locally on http://localhost:8080
mvn spring-boot:run
```

### 2. Web Frontend (React 18 + Vite)
```bash
# In project root
npm install

# Run TypeScript type check
npm run typecheck

# Start local development server on http://localhost:5173
npm run dev

# Create production build (dist/)
npm run build
```

### 3. Mobile Application (React Native + Expo)
```bash
cd apps/mobile

# Run TypeScript type check
npm run typecheck

# Start Expo development server (on port 8082 or default)
npx expo start
```

---

## Verification & Test Results

- **Backend Automated Tests**: 69 tests executed, **0 failures, 0 errors, 0 skipped**.
  - `PartnerServiceTest`: Application submission, reference ID generation (`CH-PTR-XXXXX`), status transitions (`PENDING -> APPROVED/REJECTED`), mandatory rejection reason enforcement, bulk approval, audit events.
  - `TraqoClientServiceTest`: 10 req/s rate limiter enforcement, 60-second TTL cache hit and invalidation, 503 throttling handling, safe fallback telemetry simulation when credentials are omitted.
  - `TaskSecurityAndLifecycleTest`: Customer scoping (403), atomic claiming conflict (409), invalid state transitions (400), worker unauthorized approval attempt (403), valid acceptance (200).
  - `WalletSecurityTest`: Employee cross-access denial (403), employee own ledger access (200), admin transaction oversight (200).
  - `EmployeeRoleEscalationTest`: Non-admin privilege escalation denial (403), admin role grant (200).
  - `TmsSecurityAndPricingTest`: Sanitized public tracking view (200, totalPrice omitted), unauthenticated shipment access rejection (401), scoped customer shipment list (200).
  - `SecurityConfigTest`: Anonymous access rejection on protected endpoints (401).
  - `HealthControllerTest`: Health endpoint liveness check (200).
- **Web Frontend Build**: `tsc -b` and `vite build` completed with 0 errors.
- **Mobile TypeScript**: `tsc --noEmit` completed with 0 errors.

---

## Documentation Index

- [API Contract Specification](docs/API_CONTRACT.md)
- [OpenAPI Spec](docs/openapi.yaml)
- [Architecture Decisions](docs/DECISIONS.md)
- [Mobile Setup](docs/mobile-setup.md)
