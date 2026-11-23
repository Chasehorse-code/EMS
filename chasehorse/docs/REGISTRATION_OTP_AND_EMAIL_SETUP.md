# Registration, e-mail OTP and notification e-mail — setup

What the code does:

- **Customers** register with company name, name, work e-mail, phone and password, then enter a
  6-digit code e-mailed from `noreply@chasehorse.com`. Verified customers are active immediately.
- **Field workers** register with full name, mobile, e-mail, primary operational zone (any Indian
  town / mandal, searched or picked from GPS) and password, verify the same way, then wait for
  approval by their zone's operations manager or an admin.
- Managers and admins can **approve, reject, suspend, block and reinstate** workers in their zone.
  Any account that isn't `ACTIVE` loses API access.
- Workers see and accept **open tasks within 100 km** of their live location (if shared in the last
  12 hours) or their registered zone. Tasks a manager assigns to them can be accepted anywhere.
- From `tech.support@chasehorse.com`, via Zoho:
  - task accepted → worker (CC zone manager(s) + `ems.admin@chasehorse.com`)
  - task accepted → customer, "professional assigned" (CC admin + zone manager(s))
  - support ticket raised → requester (CC related worker, zone manager(s), admin)

The OTP e-mail is sent by **Supabase Auth**; the notification e-mails by the **Spring API**
(queued in `email_outbox`, sent with retries).

## Roll-out order (do these in order)

### 1. Zoho

Create app-specific passwords (Zoho Mail → Settings → Security → App passwords) for:

- `noreply@chasehorse.com` — used by Supabase for the OTP
- `tech.support@chasehorse.com` — used by the API for notifications

### 2. Supabase Auth (dashboard)

1. **Authentication → Providers → Email**: turn **Confirm email** on.
2. **Authentication → SMTP Settings**: enable custom SMTP
   - Host `smtp.zoho.in` (or `smtp.zoho.com` for a non-India Zoho account), port `465`
   - Username `noreply@chasehorse.com`, password = its Zoho app password
   - Sender e-mail `noreply@chasehorse.com`, sender name `ChaseHorse`
3. **Authentication → Email Templates → Confirm signup**: make the body show the code, e.g.

   ```html
   <h2>Verify your ChaseHorse account</h2>
   <p>Your verification code is:</p>
   <p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
   <p>The code expires shortly. If you didn't sign up, ignore this e-mail.</p>
   ```

4. **Authentication → Rate limits**: raise "emails sent per hour" to suit expected sign-ups.

Without steps 1–3, new users never receive a code and cannot finish registering.

### 3. Database

Apply `backend/erp-api/src/main/resources/db/migration/V10__registration_zones_and_email_outbox.sql`
to the Supabase database. It adds the zone / company / verification columns, the `BLOCKED`
status, the `email_outbox` table, and replaces the sign-up trigger so it **no longer
auto-confirms e-mail**. Existing accounts keep working (their verification is carried over).

Apply it **before** deploying the new API: the API reads the new columns.

### 4. API environment

Set in the API's environment (see `backend/erp-api/.env.example`):

```
MAIL_ENABLED=true
MAIL_HOST=smtp.zoho.in
MAIL_PORT=465
MAIL_USERNAME=tech.support@chasehorse.com
MAIL_PASSWORD=<zoho app password>
MAIL_ADMIN_CC=ems.admin@chasehorse.com
APP_PUBLIC_URL=https://<web app domain>
```

With `MAIL_ENABLED=false` notifications still queue in `email_outbox` but are not sent (queued
messages older than 48 hours are dropped rather than sent late).

### 5. Deploy the API, then the web app.

## Checking delivery

```sql
select template, status, attempts, last_error, created_at, sent_at
from email_outbox order by created_at desc limit 20;
```

## Place data

`public/data/india-places.json` (12,235 towns and sub-districts, GeoNames, CC BY 4.0) is generated
by `scripts/build-india-places.mjs`; see the script header to regenerate it.

---

# Enquiry Management System

Every website form (Contact, enquiry pop-ups, home-page request, partner onboarding — on-field,
transport, terminal — Design Your Solution, careers, Live Market bookings, HSE shop requests,
network-map enquiries) now:

1. asks the visitor to verify their e-mail with a 6-digit code from **noreply@chasehorse.com**
   (sent by the API, not Supabase; no account is created),
2. stores the submission in the `enquiries` table with a reference such as `CH-ENQ-482913`,
3. e-mails the visitor a professional acknowledgement with a copy of what they sent, and
4. e-mails the full details to **shravan.vibhas@chasehorse.com** — both from **tech.support@**,
5. shows it in the dashboard at **/enquiries** (pop-up, optional sound / desktop alert, and the
   notification bell).

Limits: one code per address per minute, 5 per hour, 20 per visitor per hour, 10-minute expiry,
5 guesses per code. Codes are stored only as HMAC hashes.

## Extra roll-out steps

1. **Database:** apply `V11__enquiry_management.sql` (after V10).
2. **API environment:**

   ```
   NOREPLY_MAIL_USERNAME=noreply@chasehorse.com
   NOREPLY_MAIL_PASSWORD=<zoho app password for noreply@>
   ENQUIRY_ALERT_TO=shravan.vibhas@chasehorse.com
   ENQUIRY_OTP_SECRET=<long random value, e.g. openssl rand -base64 48>
   ```

   `MAIL_ENABLED=true` is also required (see above). Never set
   `ENQUIRY_LOG_CODES_FOR_DEVELOPMENT=true` outside local development.
3. **Dashboard login (contact@chasehorse.com):**
   - Supabase → Authentication → Users → *Add user* → `contact@chasehorse.com`, set the password
     yourself and tick *Auto confirm*. Use a password different from the Zoho mailbox's.
   - Give it the role (replace the e-mail if needed) in the SQL editor:

     ```sql
     update app_profiles set account_status = 'ACTIVE', display_name = 'Enquiry Desk'
     where email = 'contact@chasehorse.com';
     insert into app_role_assignments (user_id, role)
     select id, 'ENQUIRY_MANAGER' from app_profiles where email = 'contact@chasehorse.com'
     on conflict (user_id, role) do nothing;
     -- remove the default worker roles the sign-up trigger added
     delete from app_role_assignments
     where role in ('EMPLOYEE', 'FIELD_WORKER')
       and user_id = (select id from app_profiles where email = 'contact@chasehorse.com');
     ```

   Signing in lands on **/enquiries**; that account sees nothing else. Admins also see Enquiries.
4. **Behind a proxy:** the per-visitor limit uses the first `X-Forwarded-For` address. Make sure
   your proxy/load balancer sets it.

---

# Zones, task assignment and live location (V12)

Apply `V12__multi_zone_managers.sql` (after V11). It lets an operations manager hold **one or
many zones** and records a reason for every declined / dropped / re-assigned task.

- **Admin → State Areas**: "Edit zones" gives a manager any set of states. Managers see only the
  workers, tasks, approvals and tickets of those states (others return 404).
- **Assign / re-assign** (manager or admin): the picker lists the zone's active workers nearest
  first (live GPS if shared in the last 12 h, else registered zone). Managers can only pick
  workers within the task radius (100 km); admins may override. The worker gets a pop-up and an
  e-mail (CC zone managers + admin); a re-assigned worker is told too.
- **Worker**: Accept & Start, **Decline** (reason required) or **Drop** an accepted task part-way
  (reason required). The task returns to the open pool and is not offered to that worker again;
  zone managers, the task creator and admin get a pop-up and an e-mail with the reason.
- **Pop-ups**: unread notifications pop up after login and whenever a new one arrives (polled
  every 20 s); they stay in the bell.
- **Live location**: a worker who ticks "Sync GPS with Dispatch" (Nearby Tasks) shares their
  position while the portal is open (at most once a minute, or after moving 200 m). Unticking
  deletes the stored position.

New e-mail templates: `TASK_ASSIGNED_WORKER`, `TASK_REASSIGNED_AWAY`, `TASK_DECLINED`,
`TASK_DROPPED`, `TASK_DROPPED_WORKER`.
