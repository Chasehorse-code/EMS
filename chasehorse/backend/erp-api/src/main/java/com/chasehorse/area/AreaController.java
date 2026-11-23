package com.chasehorse.area;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/areas")
public class AreaController {
    private final JdbcTemplate jdbc;
    private final AreaScopeService areaScopeService;

    public AreaController(JdbcTemplate jdbc, AreaScopeService areaScopeService) {
        this.jdbc = jdbc;
        this.areaScopeService = areaScopeService;
    }

    public record StateView(String code, String name) {}

    public record AreaCoverageView(
        String stateCode,
        String stateName,
        UUID managerId,
        String managerName,
        String managerEmail,
        int activeWorkersCount,
        int openTasksCount,
        String coverageStatus
    ) {}

    /** stateCode keeps the first zone for older clients; stateName lists every zone; zones has them all. */
    public record ManagerAreaBanner(
        String stateCode,
        String stateName,
        boolean isAssigned,
        List<StateView> zones
    ) {}

    @GetMapping("/states")
    public List<StateView> listStates() {
        return jdbc.query(
            "SELECT code, name FROM states ORDER BY name ASC",
            (rs, n) -> new StateView(rs.getString("code"), rs.getString("name"))
        );
    }

    @GetMapping("/my-area")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public ManagerAreaBanner getMyArea(Authentication authentication) {
        AreaScope scope = areaScopeService.resolveScope(authentication, null);
        if (scope.isAdmin()) {
            return new ManagerAreaBanner("ALL", "All Jurisdictions (National Admin)", true, List.of());
        }
        List<StateView> zones = jdbc.query("""
            SELECT s.code, s.name FROM manager_areas ma JOIN states s ON s.code = ma.state_code
            WHERE ma.manager_id = ? ORDER BY ma.assigned_at, s.name
            """, (rs, n) -> new StateView(rs.getString("code"), rs.getString("name")), scope.actorId());
        if (zones.isEmpty()) {
            return new ManagerAreaBanner(null, "Unassigned (Contact Platform Admin)", false, List.of());
        }
        String names = String.join(", ", zones.stream().map(StateView::name).toList());
        return new ManagerAreaBanner(zones.get(0).code(), names, true, zones);
    }

    private static final String COVERAGE_SELECT = """
        SELECT s.code, s.name,
               (SELECT ma.manager_id FROM manager_areas ma WHERE ma.state_code = s.code
                ORDER BY ma.assigned_at LIMIT 1) AS manager_id,
               (SELECT string_agg(mp.display_name, ', ') FROM manager_areas ma
                JOIN app_profiles mp ON mp.id = ma.manager_id WHERE ma.state_code = s.code) AS manager_name,
               (SELECT string_agg(mp.email, ', ') FROM manager_areas ma
                JOIN app_profiles mp ON mp.id = ma.manager_id WHERE ma.state_code = s.code) AS manager_email,
               (SELECT COUNT(*) FROM app_profiles w
                JOIN app_role_assignments wr ON wr.user_id = w.id
                WHERE w.state_code = s.code AND wr.role IN ('EMPLOYEE', 'FIELD_WORKER') AND w.account_status = 'ACTIVE') AS active_workers,
               (SELECT COUNT(*) FROM tasks t
                WHERE t.state_code = s.code AND t.status = 'OPEN') AS open_tasks
        FROM states s
        """;

    @GetMapping("/coverage")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public List<AreaCoverageView> getCoverage(
        Authentication authentication,
        @RequestParam(required = false) String state
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, state);

        String sql;
        Object[] params;
        if (scope.isUnrestricted()) {
            sql = COVERAGE_SELECT + " ORDER BY s.name ASC";
            params = new Object[] {};
        } else if (scope.isAdmin()) {
            sql = COVERAGE_SELECT + " WHERE s.code = ? ORDER BY s.name ASC";
            params = new Object[] { scope.stateCode() };
        } else if (scope.isManager()) {
            // Every zone the manager holds (resolveScope may have narrowed it to one requested zone).
            sql = COVERAGE_SELECT + " WHERE s.code IN " + AreaScopeService.MANAGER_STATES_SUBQUERY
                + " AND s.code IN (" + String.join(", ", java.util.Collections.nCopies(Math.max(1, scope.stateCodes().size()), "?"))
                + ") ORDER BY s.name ASC";
            List<Object> p = new java.util.ArrayList<>();
            p.add(scope.actorId());
            if (scope.stateCodes().isEmpty()) p.add(AreaScopeService.NO_AREA_SENTINEL); else p.addAll(scope.stateCodes());
            params = p.toArray();
        } else {
            return List.of();
        }

        return jdbc.query(sql, (rs, n) -> {
            UUID managerId = rs.getObject("manager_id", UUID.class);
            int activeWorkers = rs.getInt("active_workers");
            int openTasks = rs.getInt("open_tasks");
            String status = managerId != null ? "COVERED"
                : (activeWorkers > 0 || openTasks > 0) ? "COVERAGE_GAP" : "NO_ACTIVITY";
            return new AreaCoverageView(rs.getString("code"), rs.getString("name"), managerId,
                rs.getString("manager_name"), rs.getString("manager_email"), activeWorkers, openTasks, status);
        }, params);
    }
}
