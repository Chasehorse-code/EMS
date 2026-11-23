package com.chasehorse.area;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;

/**
 * Admin-only: give operations managers one or more zones (states). A manager sees the workers,
 * tasks, approvals and tickets of every zone assigned here, and nothing else.
 */
@RestController
@RequestMapping("/api/v1/admin/managers")
public class AdminAreaController {
    private static final int MAX_ZONES_PER_MANAGER = 40;

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public AdminAreaController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public record Zone(String stateCode, String stateName) {}

    /** stateCode mirrors the first zone and stateName lists all of them, for older clients. */
    public record ManagerAreaAssignment(
        UUID managerId,
        String managerName,
        String managerEmail,
        String stateCode,
        String stateName,
        UUID assignedBy,
        OffsetDateTime assignedAt,
        List<Zone> zones
    ) {}

    /** stateCodes (preferred; an empty list unassigns) or the legacy single stateCode. */
    public record AssignAreaRequest(String stateCode, List<String> stateCodes) {}

    /** One manager × zone row (package-visible for tests). */
    record Row(UUID managerId, String name, String email, String stateCode, String stateName,
                       UUID assignedBy, OffsetDateTime assignedAt) {}

    private static final String MANAGER_ROWS = """
        SELECT p.id AS manager_id, p.display_name, p.email,
               ma.state_code, s.name AS state_name, ma.assigned_by, ma.assigned_at
        FROM app_profiles p
        LEFT JOIN manager_areas ma ON ma.manager_id = p.id
        LEFT JOIN states s ON s.code = ma.state_code
        """;

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN')")
    public List<ManagerAreaAssignment> listManagersWithAreas() {
        return group(rows(MANAGER_ROWS + """
            WHERE EXISTS (SELECT 1 FROM app_role_assignments r
                          WHERE r.user_id = p.id AND r.role IN ('MANAGER', 'OPERATIONS'))
            ORDER BY p.display_name ASC, ma.assigned_at ASC
            """));
    }

    @GetMapping("/{managerId}/area")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN')")
    public ManagerAreaAssignment getManagerArea(@PathVariable UUID managerId) {
        var list = group(rows(MANAGER_ROWS + " WHERE p.id = ? ORDER BY ma.assigned_at ASC", managerId));
        if (list.isEmpty()) {
            throw ApiException.notFound("Manager", managerId);
        }
        return list.get(0);
    }

    @PutMapping("/{managerId}/area")
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN')")
    public ManagerAreaAssignment assignManagerArea(
        @PathVariable UUID managerId,
        @RequestBody AssignAreaRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID adminId = jwt != null ? UUID.fromString(jwt.getSubject()) : null;

        boolean isManager = !jdbc.query(
            "SELECT 1 FROM app_role_assignments WHERE user_id = ? AND role IN ('MANAGER', 'OPERATIONS')",
            (rs, n) -> 1, managerId).isEmpty();
        if (!isManager) {
            throw ApiException.badRequest("Only an operations manager (MANAGER or OPERATIONS role) can be given zones. Assign the role first.");
        }

        LinkedHashSet<String> requested = new LinkedHashSet<>();
        if (request != null && request.stateCodes() != null) {
            request.stateCodes().stream().filter(c -> c != null && !c.isBlank())
                .map(c -> c.trim().toUpperCase()).forEach(requested::add);
        } else if (request != null && request.stateCode() != null && !request.stateCode().isBlank()) {
            requested.add(request.stateCode().trim().toUpperCase());
        } else {
            throw ApiException.badRequest("Send stateCodes: one or more zones, or an empty list to unassign");
        }
        if (requested.size() > MAX_ZONES_PER_MANAGER) {
            throw ApiException.badRequest("A manager can hold at most " + MAX_ZONES_PER_MANAGER + " zones");
        }
        for (String code : requested) {
            if (jdbc.query("SELECT 1 FROM states WHERE code = ?", (rs, n) -> 1, code).isEmpty()) {
                throw ApiException.badRequest("Invalid state code: " + code + ". Must be a recognised Indian state or UT code.");
            }
        }

        // Replace the set: unchanged zones keep their original assignment, removed ones go, new ones are added.
        List<String> current = jdbc.query("SELECT state_code FROM manager_areas WHERE manager_id = ?",
            (rs, n) -> rs.getString("state_code"), managerId);
        for (String code : current) {
            if (!requested.contains(code)) {
                jdbc.update("DELETE FROM manager_areas WHERE manager_id = ? AND state_code = ?", managerId, code);
            }
        }
        for (String code : requested) {
            if (!current.contains(code)) {
                jdbc.update("""
                    INSERT INTO manager_areas (manager_id, state_code, assigned_by, assigned_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, managerId, code, adminId);
            }
        }

        // The manager's own profile state follows their primary (first) zone.
        if (!requested.isEmpty()) {
            jdbc.update("UPDATE app_profiles SET state_code = ? WHERE id = ?", requested.iterator().next(), managerId);
        }

        audit.log(adminId, "MANAGER_AREA_ASSIGNED", "PROFILE", managerId,
            Map.of("state_codes", String.join(",", requested), "previous", String.join(",", current)));

        return getManagerArea(managerId);
    }

    private List<Row> rows(String sql, Object... args) {
        return jdbc.query(sql, (rs, n) -> new Row(
            rs.getObject("manager_id", UUID.class),
            rs.getString("display_name"),
            rs.getString("email"),
            rs.getString("state_code"),
            rs.getString("state_name"),
            rs.getObject("assigned_by", UUID.class),
            rs.getObject("assigned_at", OffsetDateTime.class)
        ), args);
    }

    private static List<ManagerAreaAssignment> group(List<Row> rows) {
        Map<UUID, List<Row>> byManager = new LinkedHashMap<>();
        for (Row row : rows) {
            byManager.computeIfAbsent(row.managerId(), k -> new ArrayList<>()).add(row);
        }
        List<ManagerAreaAssignment> out = new ArrayList<>();
        byManager.forEach((id, list) -> {
            Row first = list.get(0);
            List<Zone> zones = list.stream().filter(r -> r.stateCode() != null)
                .map(r -> new Zone(r.stateCode(), r.stateName())).toList();
            out.add(new ManagerAreaAssignment(id, first.name(), first.email(),
                zones.isEmpty() ? null : zones.get(0).stateCode(),
                zones.isEmpty() ? null : String.join(", ", zones.stream().map(Zone::stateName).toList()),
                first.assignedBy(), first.assignedAt(), zones));
        });
        return out;
    }
}
