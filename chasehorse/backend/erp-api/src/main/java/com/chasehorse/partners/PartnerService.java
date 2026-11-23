package com.chasehorse.partners;

import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import com.chasehorse.common.IdGeneratorService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class PartnerService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final IdGeneratorService idGen;

    public PartnerService(JdbcTemplate jdbc, AuditService audit, IdGeneratorService idGen) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.idGen = idGen;
    }

    @jakarta.annotation.PostConstruct
    public void initSchema() {
        try {
            try {
                jdbc.execute("CREATE OR REPLACE FUNCTION random_uuid() RETURNS uuid AS $$ SELECT gen_random_uuid(); $$ LANGUAGE SQL;");
            } catch (Exception ignored) {}

            jdbc.execute("""
                CREATE TABLE IF NOT EXISTS partner_profiles (
                    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    reference_id     VARCHAR(50) UNIQUE NOT NULL,
                    user_id          UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
                    partner_type     VARCHAR(50) NOT NULL,
                    status           VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                    contact_name     VARCHAR(255) NOT NULL,
                    company_name     VARCHAR(255),
                    email            VARCHAR(320) NOT NULL,
                    phone            VARCHAR(30) NOT NULL,
                    masked_gst       VARCHAR(30),
                    submitted_data   TEXT NOT NULL DEFAULT '{}',
                    rejection_reason TEXT,
                    reviewed_by      UUID REFERENCES app_profiles(id),
                    reviewed_at      TIMESTAMPTZ,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            """);
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_partner_status ON partner_profiles(status);");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_partner_type   ON partner_profiles(partner_type);");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_partner_email  ON partner_profiles(email);");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_partner_ref    ON partner_profiles(reference_id);");

            jdbc.execute("""
                CREATE TABLE IF NOT EXISTS partner_approvals (
                    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    partner_id      UUID NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
                    actor_id        UUID REFERENCES app_profiles(id),
                    action          VARCHAR(50) NOT NULL,
                    previous_status VARCHAR(50),
                    new_status      VARCHAR(50) NOT NULL,
                    reason          TEXT,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            """);
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_partner_appr_partner ON partner_approvals(partner_id, created_at DESC);");

            jdbc.execute("""
                CREATE TABLE IF NOT EXISTS tracking_trips (
                    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    traqo_trip_id        VARCHAR(100),
                    invoice_number       VARCHAR(100),
                    lr_number            VARCHAR(100),
                    truck_number         VARCHAR(50) NOT NULL,
                    driver_phone         VARCHAR(30) NOT NULL,
                    status               VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
                    origin_name          VARCHAR(255),
                    origin_lat           DECIMAL(10,7),
                    origin_lng           DECIMAL(10,7),
                    destination_name     VARCHAR(255),
                    destination_lat      DECIMAL(10,7),
                    destination_lng      DECIMAL(10,7),
                    eta_timestamp        TIMESTAMPTZ,
                    consent_status       VARCHAR(50) DEFAULT 'PENDING',
                    consent_count        INT DEFAULT 0,
                    created_by           UUID REFERENCES app_profiles(id),
                    assigned_manager_id  UUID REFERENCES app_profiles(id),
                    metadata             TEXT DEFAULT '{}',
                    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            """);
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tracking_status  ON tracking_trips(status);");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tracking_traqo   ON tracking_trips(traqo_trip_id);");
            jdbc.execute("CREATE INDEX IF NOT EXISTS idx_tracking_invoice ON tracking_trips(invoice_number);");
        } catch (Exception ignored) {
        }
    }

    public record RegistrationRequest(
        String partnerType,
        String contactName,
        String companyName,
        String email,
        String phone,
        String password,
        String maskedGst,
        String referenceId,
        Map<String, Object> submittedData
    ) {}

    public record DecisionRequest(
        String reason
    ) {}

    public record BulkApproveRequest(
        List<UUID> partnerIds
    ) {}

    /**
     * Registers a new partner with PENDING status.
     * Enforces audit trail and creates a pending app_profile for login gate verification.
     */
    @Transactional
    public PartnerProfile register(RegistrationRequest req) {
        if (req.partnerType() == null || req.partnerType().isBlank()) {
            throw ApiException.badRequest("Partner type is required.");
        }
        if (req.email() == null || req.email().isBlank()) {
            throw ApiException.badRequest("Email is required.");
        }
        if (req.phone() == null || req.phone().isBlank()) {
            throw ApiException.badRequest("Phone number is required.");
        }

        UUID partnerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        String refId = req.referenceId();
        if (refId == null || refId.isBlank()) {
            String prefix = req.partnerType().length() >= 3
                ? req.partnerType().substring(0, 3).toUpperCase(Locale.ROOT)
                : "PRT";
            refId = "CH-" + prefix + "-" + (100000 + new Random().nextInt(900000));
        }

        String rawDataJson = "{}";
        if (req.submittedData() != null) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                rawDataJson = mapper.writeValueAsString(req.submittedData());
            } catch (Exception e) {
                rawDataJson = "{}";
            }
        }

        // 1. Create PENDING user profile in app_profiles so login returns PENDING gate
        String displayId = idGen.nextEmployeeId();
        jdbc.update("""
            INSERT INTO app_profiles (id, display_id, display_name, email, phone, account_status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
            ON CONFLICT (id) DO NOTHING
            """, userId, displayId, req.contactName(), req.email().trim().toLowerCase(Locale.ROOT), req.phone());

        // 2. Insert into partner_profiles
        jdbc.update("""
            INSERT INTO partner_profiles (
                id, reference_id, user_id, partner_type, status,
                contact_name, company_name, email, phone, masked_gst, submitted_data
            ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)
            """,
            partnerId, refId, userId, req.partnerType(),
            req.contactName(), req.companyName(), req.email().trim().toLowerCase(Locale.ROOT),
            req.phone(), req.maskedGst(), rawDataJson
        );

        // 3. Log audit event
        audit.log(userId, "PARTNER_APPLICATION_SUBMITTED", "PARTNER_PROFILE", partnerId,
            Map.of("referenceId", refId, "partnerType", req.partnerType(), "email", req.email()));

        // 4. Create in-app notification
        jdbc.update("""
            INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id)
            VALUES (RANDOM_UUID(), ?, 'Application Submitted', 'Your partner application is under review by Operations.', 'SYSTEM', 'PARTNER', ?)
            """, userId, partnerId);

        return findById(partnerId);
    }

    /**
     * Lists partner registrations with filtering by partnerType and status.
     */
    public List<PartnerProfile> list(String partnerType, String status, int limit) {
        StringBuilder sql = new StringBuilder("""
            SELECT id, reference_id, user_id, partner_type, status,
                   contact_name, company_name, email, phone, masked_gst,
                   submitted_data, rejection_reason, reviewed_by, reviewed_at,
                   created_at, updated_at
            FROM partner_profiles
            WHERE 1=1
            """);
        List<Object> params = new ArrayList<>();

        if (partnerType != null && !partnerType.isBlank() && !"ALL".equalsIgnoreCase(partnerType)) {
            sql.append(" AND LOWER(partner_type) = LOWER(?) ");
            params.add(partnerType);
        }
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            sql.append(" AND UPPER(status) = UPPER(?) ");
            params.add(status);
        }

        sql.append(" ORDER BY created_at DESC LIMIT ? ");
        params.add(limit > 0 ? limit : 200);

        return jdbc.query(sql.toString(), (rs, rowNum) -> new PartnerProfile(
            rs.getObject("id", UUID.class),
            rs.getString("reference_id"),
            rs.getObject("user_id", UUID.class),
            rs.getString("partner_type"),
            rs.getString("status"),
            rs.getString("contact_name"),
            rs.getString("company_name"),
            rs.getString("email"),
            rs.getString("phone"),
            rs.getString("masked_gst"),
            rs.getString("submitted_data"),
            rs.getString("rejection_reason"),
            rs.getObject("reviewed_by", UUID.class),
            rs.getObject("reviewed_at", OffsetDateTime.class),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        ), params.toArray());
    }

    public PartnerProfile findById(UUID id) {
        var list = jdbc.query("""
            SELECT id, reference_id, user_id, partner_type, status,
                   contact_name, company_name, email, phone, masked_gst,
                   submitted_data, rejection_reason, reviewed_by, reviewed_at,
                   created_at, updated_at
            FROM partner_profiles
            WHERE id = ?
            """,
            (rs, rowNum) -> new PartnerProfile(
                rs.getObject("id", UUID.class),
                rs.getString("reference_id"),
                rs.getObject("user_id", UUID.class),
                rs.getString("partner_type"),
                rs.getString("status"),
                rs.getString("contact_name"),
                rs.getString("company_name"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("masked_gst"),
                rs.getString("submitted_data"),
                rs.getString("rejection_reason"),
                rs.getObject("reviewed_by", UUID.class),
                rs.getObject("reviewed_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
            ),
            id);

        if (list.isEmpty()) {
            throw ApiException.notFound("PartnerProfile", id);
        }
        return list.get(0);
    }

    public PartnerProfile findByReference(String refId) {
        var list = jdbc.query("""
            SELECT id, reference_id, user_id, partner_type, status,
                   contact_name, company_name, email, phone, masked_gst,
                   submitted_data, rejection_reason, reviewed_by, reviewed_at,
                   created_at, updated_at
            FROM partner_profiles
            WHERE reference_id = ?
            """,
            (rs, rowNum) -> new PartnerProfile(
                rs.getObject("id", UUID.class),
                rs.getString("reference_id"),
                rs.getObject("user_id", UUID.class),
                rs.getString("partner_type"),
                rs.getString("status"),
                rs.getString("contact_name"),
                rs.getString("company_name"),
                rs.getString("email"),
                rs.getString("phone"),
                rs.getString("masked_gst"),
                rs.getString("submitted_data"),
                rs.getString("rejection_reason"),
                rs.getObject("reviewed_by", UUID.class),
                rs.getObject("reviewed_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
            ),
            refId);

        if (list.isEmpty()) {
            throw ApiException.notFound("PartnerReference", refId);
        }
        return list.get(0);
    }

    /**
     * Approves a partner application.
     * Transitions status to APPROVED, activates app_profile, assigns specific partner role.
     */
    @Transactional
    public PartnerProfile approve(UUID id, UUID reviewerId) {
        PartnerProfile p = findById(id);
        if ("APPROVED".equalsIgnoreCase(p.status())) {
            return p;
        }

        // Map partnerType to AppRole
        String assignedRole = switch (p.partnerType().toLowerCase(Locale.ROOT)) {
            case "transporter" -> "TRANSPORTER";
            case "fleet_owner" -> "FLEET_OWNER";
            case "driver" -> "DRIVER";
            case "freight_trader" -> "FREIGHT_TRADER";
            case "freight_financial" -> "FREIGHT_FINANCIAL";
            case "terminal_space" -> "TERMINAL_OWNER";
            default -> "ONFIELD_PROFESSIONAL";
        };

        // 1. Update partner_profiles
        jdbc.update("""
            UPDATE partner_profiles
            SET status = 'APPROVED', reviewed_by = ?, reviewed_at = now(), updated_at = now()
            WHERE id = ?
            """, reviewerId, id);

        // 2. Activate user in app_profiles & grant role
        if (p.userId() != null) {
            jdbc.update("UPDATE app_profiles SET account_status = 'ACTIVE', updated_at = now() WHERE id = ?", p.userId());
            jdbc.update("""
                INSERT INTO app_role_assignments (user_id, role, granted_by)
                VALUES (?, ?, ?)
                ON CONFLICT (user_id, role) DO NOTHING
                """, p.userId(), assignedRole, reviewerId);

            // Also grant PARTNER common role
            jdbc.update("""
                INSERT INTO app_role_assignments (user_id, role, granted_by)
                VALUES (?, 'PARTNER', ?)
                ON CONFLICT (user_id, role) DO NOTHING
                """, p.userId(), reviewerId);
        }

        // 3. Record decision in partner_approvals table
        jdbc.update("""
            INSERT INTO partner_approvals (partner_id, actor_id, action, previous_status, new_status, reason)
            VALUES (?, ?, 'APPROVE', ?, 'APPROVED', 'Application verified and approved by Operations')
            """, id, reviewerId, p.status());

        // 4. Log audit event
        audit.log(reviewerId, "PARTNER_APPROVED", "PARTNER_PROFILE", id,
            Map.of("previousStatus", p.status(), "assignedRole", assignedRole));

        // 5. Notify user
        if (p.userId() != null) {
            jdbc.update("""
                INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id)
                VALUES (RANDOM_UUID(), ?, 'Partner Application Approved', 'Congratulations! Your partner account is approved. Full dashboard access unlocked.', 'SYSTEM', 'PARTNER', ?)
                """, p.userId(), id);
        }

        return findById(id);
    }

    /**
     * Rejects a partner application with mandatory reason.
     */
    @Transactional
    public PartnerProfile reject(UUID id, String reason, UUID reviewerId) {
        if (reason == null || reason.trim().isBlank()) {
            throw ApiException.badRequest("Mandatory rejection reason required.");
        }

        PartnerProfile p = findById(id);

        jdbc.update("""
            UPDATE partner_profiles
            SET status = 'REJECTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = now(), updated_at = now()
            WHERE id = ?
            """, reason.trim(), reviewerId, id);

        if (p.userId() != null) {
            jdbc.update("UPDATE app_profiles SET account_status = 'REJECTED', updated_at = now() WHERE id = ?", p.userId());
        }

        jdbc.update("""
            INSERT INTO partner_approvals (partner_id, actor_id, action, previous_status, new_status, reason)
            VALUES (?, ?, 'REJECT', ?, 'REJECTED', ?)
            """, id, reviewerId, p.status(), reason.trim());

        audit.log(reviewerId, "PARTNER_REJECTED", "PARTNER_PROFILE", id,
            Map.of("previousStatus", p.status(), "reason", reason.trim()));

        if (p.userId() != null) {
            jdbc.update("""
                INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id)
                VALUES (RANDOM_UUID(), ?, 'Partner Application Update', 'Your application was not approved: ' || ?, 'SYSTEM', 'PARTNER', ?)
                """, p.userId(), reason.trim(), id);
        }

        return findById(id);
    }

    /**
     * Requests more information from partner.
     */
    @Transactional
    public PartnerProfile requestMoreInfo(UUID id, String notes, UUID reviewerId) {
        PartnerProfile p = findById(id);

        jdbc.update("""
            UPDATE partner_profiles
            SET status = 'MORE_INFO_REQUESTED', rejection_reason = ?, reviewed_by = ?, reviewed_at = now(), updated_at = now()
            WHERE id = ?
            """, notes, reviewerId, id);

        jdbc.update("""
            INSERT INTO partner_approvals (partner_id, actor_id, action, previous_status, new_status, reason)
            VALUES (?, ?, 'REQUEST_INFO', ?, 'MORE_INFO_REQUESTED', ?)
            """, id, reviewerId, p.status(), notes != null ? notes : "");

        audit.log(reviewerId, "PARTNER_INFO_REQUESTED", "PARTNER_PROFILE", id,
            Map.of("notes", notes != null ? notes : ""));

        return findById(id);
    }

    /**
     * Bulk approves partner applications.
     */
    @Transactional
    public List<PartnerProfile> bulkApprove(List<UUID> ids, UUID reviewerId) {
        List<PartnerProfile> results = new ArrayList<>();
        if (ids == null) return results;
        for (UUID id : ids) {
            results.add(approve(id, reviewerId));
        }
        return results;
    }

    /**
     * Authoritative partner statistics derived exclusively from PostgreSQL.
     */
    public Map<String, Object> getStats() {
        Integer pending = jdbc.queryForObject("SELECT COUNT(*) FROM partner_profiles WHERE UPPER(status) = 'PENDING'", Integer.class);
        Integer approved = jdbc.queryForObject("SELECT COUNT(*) FROM partner_profiles WHERE UPPER(status) = 'APPROVED'", Integer.class);
        Integer rejected = jdbc.queryForObject("SELECT COUNT(*) FROM partner_profiles WHERE UPPER(status) = 'REJECTED'", Integer.class);
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM partner_profiles", Integer.class);
        Integer activeTrips = 0;
        try {
            activeTrips = jdbc.queryForObject("SELECT COUNT(*) FROM tracking_trips WHERE UPPER(status) = 'RUNNING'", Integer.class);
        } catch (Exception ignored) {}

        var distribution = jdbc.query("""
            SELECT partner_type, COUNT(*) as cnt
            FROM partner_profiles
            GROUP BY partner_type
            ORDER BY cnt DESC
            """, (rs, n) -> Map.of("type", rs.getString("partner_type"), "count", rs.getInt("cnt")));

        var recentActivity = audit.listRecent(5);

        Map<String, Object> map = new HashMap<>();
        map.put("pending", pending != null ? pending : 0);
        map.put("approved", approved != null ? approved : 0);
        map.put("rejected", rejected != null ? rejected : 0);
        map.put("total", total != null ? total : 0);
        map.put("activeTrips", activeTrips != null ? activeTrips : 0);
        map.put("distribution", distribution);
        map.put("recentActivity", recentActivity);
        return map;
    }
}

