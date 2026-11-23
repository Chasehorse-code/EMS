# ChaseHorse Architecture & System Decisions

This document formally records all architectural, identity, security, and operational decisions agreed upon for the ChaseHorse platform across web and mobile.

---

## 1. Concurrency-Safe Display Identifiers

### 1.1 Task Display IDs
All task IDs generated across the system use the format `<Creator Letter>OFW<Sequence>`:
- **`AOFW###`**: Tasks created by a Platform Administrator (e.g. `AOFW001`).
- **`COFW###`**: Tasks created by an Enterprise Customer (e.g. `COFW001`).
- **`OOFW###`**: Tasks created by an Operations Manager (e.g. `OOFW001`).
- **`MOFW###`**: Tasks created by a Manager (e.g. `MOFW001`).

**Terminology**:
- **`OFW`**: Acronym for **On-Field Work**, designating physical dispatch field audits, surveys, and site compliance verifications.
- **Prefix Sequence**: Global per-prefix counter table `id_counters (prefix, current_value, updated_at)` operating under PostgreSQL atomic row locks (`INSERT ... ON CONFLICT DO UPDATE RETURNING`).
- **Safety**: Primary key remains immutable UUID (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`). The display ID is a separate unique column with a strict regex check constraint (`chk_tasks_display_id`). Legacy IDs (e.g. `CH-000001`, `CH-8821`) remain supported as backward-compatible aliases in search and detail lookups.
- **Concurrency Guarantee**: Tested and verified under 50 parallel concurrent creates per prefix (300 parallel creates total) resulting in zero duplicate IDs and zero transaction rollbacks.

### 1.2 Support Ticket Display IDs
- **Format**: **`ST###`** (e.g. `ST001`, `ST002`, growing sequentially past `ST1000`).
- **Sequence**: Powered by the atomic `id_counters` prefix `ST`.
- **Validation**: Enforced by check constraint `chk_support_tickets_display_id` (`display_id ~ '^ST[0-9]{3,}$'`).

### 1.3 Employee Display IDs
- **Format**: **`EMP###`** (e.g. `EMP001`, `EMP002`, `EMP017`).
- **Automatic Allocation**: Generated atomically upon registration or user creation via the PostgreSQL trigger `handle_new_auth_user()` and the backend `IdGeneratorService.java`.
- **Validation**: Enforced by check constraint `chk_app_profiles_display_id` (`display_id ~ '^EMP[0-9]{3,}$'`).

---

## 2. Area Isolation & Role Scope

- **Isolation Invariant**: An Operations Manager or regional Manager is strictly bounded to their assigned Indian state (e.g., `AP` - Andhra Pradesh, `TG` - Telangana).
- **Leakage Prevention**: Any resource outside the manager's assigned state (task, worker profile, wallet ledger, or support ticket) returns an HTTP `404 Not Found` (rather than a `403 Forbidden`) so that the existence of foreign state resources is never leaked.
- **Platform Admin Scope**: Only Platform Admins have national (`ALL`) jurisdiction across all states.
- **Worker Filtering**: Operations managers cannot see Platform Admin, Partner, or internal management accounts in field worker rosters. Worker listings strictly query active users with the `FIELD_WORKER` or `EMPLOYEE` role in that operational state.

---

## 3. Two-Stage Approval & Wallet Crediting Chain

- **Workflow Stages**:
  1. **Submission**: Worker submits photo evidence and completed checklist. Task moves to `SUBMITTED`, creating a `task_approvals` entry with `stage = 'MANAGER_REVIEW'` and `decision = 'PENDING'`.
  2. **Stage 1 Review (`MANAGER_REVIEW`)**: Regional Manager or Operations Manager reviews evidence photos, metadata stamps, and checklist. If approved, advances to `stage = 'OPS_REVIEW'`, task moves to `IN_REVIEW`.
  3. **Stage 2 Review (`OPS_REVIEW`)**: Must be approved by a **different** reviewer from Stage 1 (no self-approval, no single-person dual-approval).
  4. **Final Approval (`FINAL`)**: Once Stage 2 is approved, task status updates to `APPROVED` and the field worker's reward bounty is credited to `wallet_ledger` atomically in the same database transaction.
- **Rework & Rejection**:
  - Rejection requires a mandatory human-entered rationale. Task moves to `REJECTED`, no wallet credit is issued.
  - Rework dispatches actionable feedback back to the field worker, returning task to `IN_PROGRESS`.
- **Reward Authorization Cap**:
  - Regional managers are authorized to approve tasks with bounties up to **₹10,000 INR**.
  - Any task bounty exceeding ₹10,000 INR requires explicit sign-off by a Platform Administrator.
- **Paucity Notice**: The wallet ledger displays an explicit, transparent line noting that field worker withdrawals are not yet enabled pending banking gateway integration.

---

## 4. Session & Inactivity Policy

- **Website Policy**:
  - Session persists across page reloads (restores token prior to route guard execution).
  - Idle timeout: **30 minutes** of continuous user inactivity.
  - Inactivity prompt: A warning modal is displayed at **29 minutes** (1 minute prior to auto-logout) allowing the user to extend their active session with one click.
- **Mobile Policy**:
  - Mobile authentication session lasts **24 hours**.
  - Tokens are stored securely in device hardware secure storage (iOS Keychain / Android Keystore) via `expo-secure-store`, never in unencrypted plaintext `AsyncStorage`.
  - Hard sign-out instantly purges all tokens from secure device storage.

---

## 5. Evidence Photo Stamping & Server-Side Geofencing

- **Burned-In Watermark**:
  - Hardcoded monospace metadata rendered along the bottom edge on a semi-opaque `#111315` bar before upload:
    `<Task Display ID> | <Employee Display ID> | <Local Timestamp IST> | <Lat, Lng ±Accuracy m>`
  - Both web camera canvas and mobile Camera HUD share identical stamping typography, layout, and visual formatting.
- **Server Enforcement**:
  - The backend calculates Haversine distance between submitted coordinates and task coordinates.
  - Default radius is 200m (configurable per task via `geofence_radius_meters`).
  - Validation failures return grouped human-readable messages (e.g. `"You are 7,807 m from the site; move within 200 m. Photo required for item 3"`).

---

## 6. Visual Theme & Brand System

- **Palette**:
  - Canvas: Cream `#F3F1EB` (light mode) / Near-black `#111110` (dark mode)
  - Primary Accent: Muted Burnt Orange `#D9531E`
  - Secondary Accent / Surface: `#1B2430` / `#FFFFFF`
  - Typography: Inter with monospace metadata labels
- **Default Theme**: Defaults to system preferences and persists user toggle across sessions.
