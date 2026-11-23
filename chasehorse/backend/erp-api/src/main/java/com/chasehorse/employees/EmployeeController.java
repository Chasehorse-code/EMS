package com.chasehorse.employees;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import com.chasehorse.area.AreaScope;
import com.chasehorse.area.AreaScopeService;
import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;

@RestController
@RequestMapping("/api/v1/employees")
public class EmployeeController {
    private final JdbcTemplate jdbc;
    private final RoleAuthorization roleAuth;
    private final AreaScopeService areaScopeService;
    private final AuditService audit;

    public EmployeeController(
        JdbcTemplate jdbc,
        RoleAuthorization roleAuth,
        @org.springframework.beans.factory.annotation.Autowired(required = false) AreaScopeService areaScopeService,
        @org.springframework.beans.factory.annotation.Autowired(required = false) AuditService audit
    ) {
        this.jdbc = jdbc;
        this.roleAuth = roleAuth;
        this.areaScopeService = areaScopeService != null ? areaScopeService : new AreaScopeService(jdbc, roleAuth);
        this.audit = audit != null ? audit : new AuditService(jdbc);
    }

    public record EmployeeView(
        UUID id,
        String displayId,
        String displayName,
        String email,
        String phone,
        String region,
        String stateCode,
        String stateName,
        String accountStatus,
        String rejectionReason,
        String rejectedBy,
        List<String> roles,
        OffsetDateTime createdAt,
        String zonePlace,
        String zoneDistrict,
        boolean emailVerified
    ) {
        // Pre-zone signature, kept for existing callers.
        public EmployeeView(
            UUID id, String displayId, String displayName, String email, String phone, String region,
            String stateCode, String stateName, String accountStatus, String rejectionReason, String rejectedBy,
            List<String> roles, OffsetDateTime createdAt
        ) {
            this(id, displayId, displayName, email, phone, region, stateCode, stateName, accountStatus,
                 rejectionReason, rejectedBy, roles, createdAt, null, null, true);
        }

        public EmployeeView(
            UUID id,
            String displayId,
            String displayName,
            String email,
            String phone,
            String region,
            String stateCode,
            String stateName,
            String accountStatus,
            List<String> roles,
            OffsetDateTime createdAt
        ) {
            this(id, displayId, displayName, email, phone, region, stateCode, stateName, accountStatus, null, null, roles, createdAt);
        }

        public EmployeeView(
            UUID id,
            String displayName,
            String email,
            String phone,
            String region,
            String stateCode,
            String stateName,
            String accountStatus,
            List<String> roles,
            OffsetDateTime createdAt
        ) {
            this(id, null, displayName, email, phone, region, stateCode, stateName, accountStatus, null, null, roles, createdAt);
        }

        public EmployeeView(
            UUID id,
            String displayName,
            String email,
            String phone,
            String region,
            String accountStatus,
            List<String> roles,
            OffsetDateTime createdAt
        ) {
            this(id, null, displayName, email, phone, region, null, null, accountStatus, null, null, roles, createdAt);
        }
    }

    public record ApprovalRequest(
        @NotNull AccountStatus status,
        String role,
        String reason
    ) {}

    /**
     * ACTIVE: can sign in and work. PENDING: awaiting approval. SUSPENDED: temporarily paused.
     * BLOCKED: barred until an admin or zone manager reinstates them. REJECTED: application declined.
     * Every non-ACTIVE status removes API access (see RoleAuthorization).
     */
    public enum AccountStatus { ACTIVE, SUSPENDED, BLOCKED, REJECTED, PENDING;
        boolean needsReason() { return this == SUSPENDED || this == BLOCKED || this == REJECTED; }
    }

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public List<EmployeeView> listEmployees(
        Authentication authentication,
        @RequestParam(required = false) String state
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, state);

        String sql;
        Object[] params;

        if (scope.isAdmin()) {
            if (scope.hasState()) {
                sql = """
                    SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                           p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                           COALESCE((
                               SELECT string_agg(r.role, ',')
                               FROM app_role_assignments r
                               WHERE r.user_id = p.id
                           ), 'FIELD_WORKER') as roles_csv
                    FROM app_profiles p
                    LEFT JOIN states s ON s.code = p.state_code
                    JOIN (SELECT DISTINCT user_id FROM app_role_assignments WHERE role IN ('EMPLOYEE', 'FIELD_WORKER')) r ON r.user_id = p.id
                    WHERE p.state_code = ?
                      AND NOT EXISTS (
                          SELECT 1 FROM app_role_assignments r2
                          WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER')
                      )
                    ORDER BY p.created_at DESC LIMIT 500
                    """;
                params = new Object[] { scope.stateCode() };
            } else {
                sql = """
                    SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                           p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                           COALESCE((
                               SELECT string_agg(r.role, ',')
                               FROM app_role_assignments r
                               WHERE r.user_id = p.id
                           ), 'FIELD_WORKER') as roles_csv
                    FROM app_profiles p
                    LEFT JOIN states s ON s.code = p.state_code
                    JOIN (SELECT DISTINCT user_id FROM app_role_assignments WHERE role IN ('EMPLOYEE', 'FIELD_WORKER')) r ON r.user_id = p.id
                    WHERE NOT EXISTS (
                          SELECT 1 FROM app_role_assignments r2
                          WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER')
                      )
                    ORDER BY p.created_at DESC LIMIT 500
                    """;
                params = new Object[] {};
            }
        } else {
            // Manager / Operations: ONLY see field workers in their assigned state.
            // Exclude Admins, other Managers, Operations staff, and Partners.
            sql = """
                SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                       p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                       'FIELD_WORKER' as roles_csv
                FROM app_profiles p
                LEFT JOIN states s ON s.code = p.state_code
                JOIN (SELECT DISTINCT user_id FROM app_role_assignments WHERE role IN ('EMPLOYEE', 'FIELD_WORKER')) r ON r.user_id = p.id
                WHERE p.state_code IN (""" + scopeStatesSql(scope) + """
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM app_role_assignments r2
                      WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER')
                  )
                ORDER BY p.created_at DESC LIMIT 500
                """;
            params = scopeStatesParams(scope);
        }

        return jdbc.query(sql, (rs, rowNum) -> mapEmployeeRow(rs), params);
    }

    @GetMapping("/pending")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public List<EmployeeView> listPendingEmployees(
        Authentication authentication,
        @RequestParam(required = false) String state
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, state);

        String sql;
        Object[] params;

        if (scope.isAdmin()) {
            if (scope.hasState()) {
                sql = """
                    SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                           p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                           COALESCE((
                               SELECT string_agg(r.role, ',')
                               FROM app_role_assignments r
                               WHERE r.user_id = p.id
                           ), 'FIELD_WORKER') as roles_csv
                    FROM app_profiles p
                    LEFT JOIN states s ON s.code = p.state_code
                    JOIN (SELECT DISTINCT user_id FROM app_role_assignments WHERE role IN ('EMPLOYEE', 'FIELD_WORKER')) r ON r.user_id = p.id
                    WHERE p.account_status = 'PENDING' AND p.state_code = ?
                      AND NOT EXISTS (
                          SELECT 1 FROM app_role_assignments r2
                          WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER')
                      )
                    ORDER BY p.created_at DESC LIMIT 500
                    """;
                params = new Object[] { scope.stateCode() };
            } else {
                sql = """
                    SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                           p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                           COALESCE((
                               SELECT string_agg(r.role, ',')
                               FROM app_role_assignments r
                               WHERE r.user_id = p.id
                           ), 'FIELD_WORKER') as roles_csv
                    FROM app_profiles p
                    LEFT JOIN states s ON s.code = p.state_code
                    JOIN (SELECT DISTINCT user_id FROM app_role_assignments WHERE role IN ('EMPLOYEE', 'FIELD_WORKER')) r ON r.user_id = p.id
                    WHERE p.account_status = 'PENDING'
                      AND NOT EXISTS (
                          SELECT 1 FROM app_role_assignments r2
                          WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER')
                      )
                    ORDER BY p.created_at DESC LIMIT 500
                    """;
                params = new Object[] {};
            }
        } else {
            sql = """
                SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                       p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                       'FIELD_WORKER' as roles_csv
                FROM app_profiles p
                LEFT JOIN states s ON s.code = p.state_code
                JOIN (SELECT DISTINCT user_id FROM app_role_assignments WHERE role IN ('EMPLOYEE', 'FIELD_WORKER')) r ON r.user_id = p.id
                WHERE p.account_status = 'PENDING'
                  AND p.state_code IN (""" + scopeStatesSql(scope) + """
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM app_role_assignments r2
                      WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER')
                  )
                ORDER BY p.created_at DESC LIMIT 500
                """;
            params = scopeStatesParams(scope);
        }

        return jdbc.query(sql, (rs, rowNum) -> mapEmployeeRow(rs), params);
    }

    @GetMapping("/{idOrDisplayId}")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public EmployeeView getEmployee(
        @PathVariable String idOrDisplayId,
        Authentication authentication
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, null);
        UUID employeeId = null;
        try {
            employeeId = UUID.fromString(idOrDisplayId);
        } catch (IllegalArgumentException ignored) {}

        String sql = """
            SELECT p.id, p.display_id, p.display_name, p.email, p.phone, p.region, p.state_code, s.name AS state_name,
                   p.account_status, p.rejection_reason, p.rejected_by, p.created_at,
                           p.zone_place, p.zone_district, p.email_verified_at,
                   COALESCE((
                       SELECT string_agg(r.role, ',')
                       FROM app_role_assignments r
                       WHERE r.user_id = p.id
                   ), '') as roles_csv
            FROM app_profiles p
            LEFT JOIN states s ON s.code = p.state_code
            WHERE""" + (employeeId != null ? " p.id = ?" : " p.display_id = ?"); // text blocks drop trailing spaces

        Object param = employeeId != null ? employeeId : idOrDisplayId.trim().toUpperCase();
        var list = jdbc.query(sql, (rs, rowNum) -> mapEmployeeRow(rs), param);

        if (list.isEmpty()) {
            throw ApiException.notFound("Employee", idOrDisplayId);
        }
        EmployeeView emp = list.get(0);
        areaScopeService.assertCanAccessEmployee(scope, emp.id());
        return emp;
    }

    /** Placeholders for every zone in a manager's scope ("?, ?"); a scope with no zones matches nothing. */
    private static String scopeStatesSql(AreaScope scope) {
        int n = Math.max(1, scope.stateCodes().size());
        return String.join(", ", java.util.Collections.nCopies(n, "?"));
    }

    private static Object[] scopeStatesParams(AreaScope scope) {
        return scope.stateCodes().isEmpty()
            ? new Object[] { com.chasehorse.area.AreaScopeService.NO_AREA_SENTINEL }
            : scope.stateCodes().toArray();
    }

    private EmployeeView mapEmployeeRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        String rolesCsv = rs.getString("roles_csv");
        List<String> roles = (rolesCsv != null && !rolesCsv.isBlank())
            ? Arrays.asList(rolesCsv.split(","))
            : List.of("FIELD_WORKER");
        return new EmployeeView(
            rs.getObject("id", UUID.class),
            rs.getString("display_id"),
            rs.getString("display_name"),
            rs.getString("email"),
            rs.getString("phone"),
            rs.getString("region"),
            rs.getString("state_code"),
            rs.getString("state_name"),
            rs.getString("account_status"),
            rs.getString("rejection_reason"),
            rs.getString("rejected_by"),
            roles,
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getString("zone_place"),
            rs.getString("zone_district"),
            rs.getObject("email_verified_at") != null
        );
    }

    @PatchMapping("/{employeeId}/approval")
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public EmployeeView setApproval(
        @PathVariable UUID employeeId,
        @Valid @RequestBody ApprovalRequest request,
        Authentication authentication,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : null;

        // 1. Prevent self-approval / self-escalation
        if (actorId != null && actorId.equals(employeeId)) {
            throw ApiException.forbidden("You cannot approve, reject, or modify your own account status or roles");
        }

        // 2. Validate role modification authorization (Only Admin can assign/modify roles)
        AreaScope scope = areaScopeService.resolveScope(authentication, null);
        if (request.role() != null && !request.role().isBlank()) {
            if (!scope.isAdmin()) {
                throw ApiException.forbidden("Only administrators can assign or modify application roles");
            }
            var validRoles = List.of("ADMIN", "MANAGER", "OPERATIONS", "EMPLOYEE", "CUSTOMER", "PARTNER", "FIELD_WORKER", "ENQUIRY_MANAGER");
            if (!validRoles.contains(request.role().toUpperCase())) {
                throw ApiException.badRequest("Invalid role: " + request.role());
            }
        }

        // 3. Validate area scope (Managers can only decide accounts in their state; foreign returns 404)
        areaScopeService.assertCanAccessEmployee(scope, employeeId);

        // 4. Require justification reason on Reject, Suspend or Block
        if (request.status().needsReason() && (request.reason() == null || request.reason().isBlank())) {
            throw ApiException.badRequest("A reason is required when rejecting, suspending or blocking an account");
        }
        if (request.reason() != null && request.reason().length() > 1000) {
            throw ApiException.badRequest("Reason must be 1000 characters or fewer");
        }

        // 4b. A new field worker can only be approved once they have verified their e-mail (OTP).
        if (request.status() == AccountStatus.ACTIVE) {
            var current = jdbc.query(
                "SELECT account_status, email_verified_at FROM app_profiles WHERE id = ?",
                (rs, n) -> new Object[] { rs.getString("account_status"), rs.getObject("email_verified_at") },
                employeeId);
            if (!current.isEmpty() && current.get(0) instanceof Object[] row
                && "PENDING".equals(row[0]) && row.length > 1 && row[1] == null) {
                throw ApiException.badRequest("This worker has not verified their e-mail address yet. They can be approved after entering the OTP sent to them.");
            }
        }

        // Determine actor name for record
        String actorName = "Staff";
        if (actorId != null) {
            actorName = jdbc.query("SELECT display_name FROM app_profiles WHERE id = ?", (rs, n) -> rs.getString("display_name"), actorId).stream().findFirst().orElse("Staff");
        }

        // 5. Update account status with rejection reason and rejected_by tracking
        int rowsUpdated;
        if (request.status().needsReason()) {
            rowsUpdated = jdbc.update("""
                UPDATE app_profiles
                SET account_status = ?, rejection_reason = ?, rejected_by = ?, updated_at = now()
                WHERE id = ?
                """,
                request.status().name(),
                request.reason(),
                actorName,
                employeeId
            );
        } else if (request.status() == AccountStatus.ACTIVE) {
            rowsUpdated = jdbc.update("""
                UPDATE app_profiles
                SET account_status = ?, rejection_reason = NULL, rejected_by = NULL, updated_at = now()
                WHERE id = ?
                """,
                request.status().name(),
                employeeId
            );
        } else {
            rowsUpdated = jdbc.update("""
                UPDATE app_profiles
                SET account_status = ?, updated_at = now()
                WHERE id = ?
                """,
                request.status().name(),
                employeeId
            );
        }

        if (rowsUpdated == 0) {
            throw ApiException.notFound("Employee", employeeId);
        }

        // 6. If Admin specified role and status ACTIVE, update role assignment
        if (scope.isAdmin() && request.role() != null && !request.role().isBlank() && request.status() == AccountStatus.ACTIVE) {
            String roleUpper = request.role().toUpperCase();
            jdbc.update("DELETE FROM app_role_assignments WHERE user_id = ?", employeeId);
            jdbc.update("""
                INSERT INTO app_role_assignments (user_id, role, granted_by)
                VALUES (?, ?, ?)
                ON CONFLICT (user_id, role) DO NOTHING
                """,
                employeeId, roleUpper, actorId
            );
        }

        // 7. Write audit log (AuditService serialises the metadata safely)
        String targetState = jdbc.query("SELECT state_code FROM app_profiles WHERE id = ?", (rs, n) -> rs.getString("state_code"), employeeId).stream().findFirst().orElse("UNKNOWN");
        audit.log(actorId, "EMPLOYEE_STATUS_DECIDED", "app_profiles", employeeId, java.util.Map.of(
            "status", request.status().name(),
            "reason", request.reason() != null ? request.reason() : "",
            "state_code", targetState != null ? targetState : "UNKNOWN"));

        return getEmployee(employeeId.toString(), authentication);
    }
}
