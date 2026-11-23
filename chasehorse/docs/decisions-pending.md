# ChaseHorse Area (State) Based Access — Decisions & Configuration Switches

This document captures architectural design decisions and configuration toggles implemented for the Area (State) Based Access model for Managers.

---

### Decision a: Approval Chain & Reward Credit Flow
* **Context**: Current implementation enforces two-stage human review (Stage 1: Area Manager, Stage 2: Operations / Admin) with immutable append-only wallet credit triggered only after Stage 2 approval.
* **Default Implemented**: **Two-Stage Approval Kept**.
  - **Rationale**: Acts as a critical anti-fraud barrier preventing single-actor collusion. The Area Manager verifies on-site evidence and checklist adherence; Operations/Finance verifies compliance and releases funds.
* **Config Switch**: `chasehorse.approval.single-stage-manager-enabled=false` (Default).
  - When toggled to `true`, an Area Manager's approval will directly credit the reward up to a per-task cap (`chasehorse.approval.manager-credit-cap-inr=2000`). Tasks with rewards above this threshold automatically route to Stage 2 Operations review.
* **Status**: **DEFAULT APPLIED — PENDING OWNER CONFIRMATION**.

---

### Decision b: Reward Amount & Discretionary Bonus Rules
* **Context**: Whether approvers can alter reward amounts freely during review.
* **Default Implemented**: **Fixed Baseline Reward + Justified Bonus up to Cap**.
  - **Baseline**: The task reward is locked upon acceptance (set by customer/dispatch) so the field worker has a guaranteed upfront contract.
  - **Bonus Cap**: An Area Manager or Admin may grant a discretionary bonus up to `chasehorse.rewards.max-bonus-inr=500`.
  - **Mandatory Reason**: A non-blank justification is required and recorded in `audit_events`. Free-form arbitrary reward overwrites are strictly rejected.
* **Status**: **DEFAULT APPLIED — PENDING OWNER CONFIRMATION**.

---

### Decision c: Number of States per Area Manager
* **Context**: Can a manager oversee multiple states (e.g. South Cluster: AP + TG) or strictly one state?
* **Default Implemented**: **Exactly ONE State per Manager**.
  - Enforced via unique constraint on `manager_areas(manager_id)` in PostgreSQL.
* **Config Switch**: The schema supports extending to 1-to-many (`chasehorse.area.multi-state-enabled=false`). To allow multi-state assignment, the unique constraint on `manager_id` can be relaxed to unique on `(manager_id, state_code)`.
* **Status**: **DEFAULT APPLIED — PENDING OWNER CONFIRMATION**.

---

### Decision d: Visibility of Field Worker Personal Data
* **Context**: Who besides Admin and the assigned Area Manager may view field worker personal contact details (phone number, full address, personal documents)?
* **Default Implemented**: **Admin + Assigned Area Manager Only**.
  - Operations staff, Customers, and Managers of other states see only anonymized operational identifiers (e.g. `EMP-XXXXXXXX`, First Name / Badge, assigned tasks, verification evidence) without phone numbers or personal records.
* **Status**: **DEFAULT APPLIED — PENDING OWNER CONFIRMATION**.

---

### Decision e: Cross-State Task Assignments
* **Context**: How tasks near state borders are handled.
* **Default Implemented**: **Strict Single-State Ownership**.
  - A task belongs to exactly one state derived from its geocoded coordinates.
  - Workers from another state cannot see or accept the task unless explicitly assigned by a Platform Admin.
* **Status**: **DEFAULT APPLIED — PENDING OWNER CONFIRMATION**.
