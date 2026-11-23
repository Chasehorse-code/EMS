package com.chasehorse.area;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;


@Service
public class AreaScopeService {
    public static final String NO_AREA_SENTINEL = "__NONE__";

    private final JdbcTemplate jdbc;
    private final RoleAuthorization roleAuth;

    public AreaScopeService(JdbcTemplate jdbc, RoleAuthorization roleAuth) {
        this.jdbc = jdbc;
        this.roleAuth = roleAuth;
    }

    public AreaScope resolveScope(Authentication authentication, String requestedStateFilter) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
            throw ApiException.unauthorized("Authentication required");
        }
        String sub = jwtAuth.getToken().getSubject();
        if (sub == null || sub.isBlank()) {
            throw ApiException.unauthorized("Valid user subject required");
        }
        UUID actorId = UUID.fromString(sub);

        List<String> roles = roleAuth.getRoles(sub);
        boolean isAdmin = roleAuth.hasRole(sub, "ADMIN") || roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
        boolean isManager = roleAuth.hasRole(sub, "MANAGER") || roleAuth.hasRole(sub, "OPERATIONS")
            || roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
        boolean isEmployee = roleAuth.hasRole(sub, "EMPLOYEE") || roleAuth.hasRole(sub, "FIELD_WORKER")
            || roles.stream().anyMatch(r -> r.equalsIgnoreCase("EMPLOYEE") || r.equalsIgnoreCase("FIELD_WORKER"));

        if (isAdmin) {
            String stateCode = null;
            if (requestedStateFilter != null && !requestedStateFilter.isBlank()) {
                String clean = requestedStateFilter.trim().toUpperCase();
                var exists = jdbc.query("SELECT code FROM states WHERE code = ?", (rs, n) -> rs.getString("code"), clean);
                if (!exists.isEmpty()) {
                    stateCode = clean;
                }
            }
            return new AreaScope(actorId, true, false, false, stateCode);
        }

        if (isManager) {
            // Managers can never widen their zones via query parameters; they may narrow to one of them.
            List<String> zones = getManagerAssignedStates(actorId);
            if (zones.isEmpty()) {
                return new AreaScope(actorId, false, true, false, NO_AREA_SENTINEL, List.of());
            }
            String primary = zones.get(0);
            if (requestedStateFilter != null && !requestedStateFilter.isBlank()) {
                String clean = requestedStateFilter.trim().toUpperCase();
                if (zones.contains(clean)) {
                    return new AreaScope(actorId, false, true, false, clean, List.of(clean));
                }
            }
            return new AreaScope(actorId, false, true, false, primary, zones);
        }

        if (isEmployee) {
            String st = null;
            try {
                var workerState = jdbc.query(
                    "SELECT state_code FROM app_profiles WHERE id = ?",
                    (rs, n) -> rs.getString("state_code"),
                    actorId
                );
                if (!workerState.isEmpty() && workerState.get(0) instanceof String s) {
                    st = s;
                }
            } catch (Exception ignored) {}
            return new AreaScope(actorId, false, false, true, st);
        }

        return new AreaScope(actorId, false, false, false, null);
    }

    /** SQL fragment listing a manager's zones; bind the manager id once. */
    public static final String MANAGER_STATES_SUBQUERY = "(SELECT ma.state_code FROM manager_areas ma WHERE ma.manager_id = ?)";

    /** All states (zones) the admin assigned to this manager, oldest assignment first. */
    public List<String> getManagerAssignedStates(UUID managerId) {
        if (managerId == null) return List.of();
        return jdbc.query(
            "SELECT state_code FROM manager_areas WHERE manager_id = ? ORDER BY assigned_at, state_code",
            (rs, n) -> rs.getString("state_code"),
            managerId
        );
    }

    /** First assigned zone, or null. Prefer {@link #getManagerAssignedStates} / {@link #managerCovers}. */
    public String getManagerAssignedState(UUID managerId) {
        List<String> zones = getManagerAssignedStates(managerId);
        return zones.isEmpty() ? null : zones.get(0);
    }

    public boolean managerCovers(UUID managerId, String stateCode) {
        if (managerId == null || stateCode == null || stateCode.isBlank()) return false;
        Integer n = jdbc.queryForObject(
            "SELECT COUNT(*) FROM manager_areas WHERE manager_id = ? AND state_code = ?",
            Integer.class, managerId, stateCode.trim().toUpperCase());
        return n != null && n > 0;
    }

    public void assertCanAccessEmployee(AreaScope scope, UUID employeeId) {
        if (scope.isAdmin()) return;

        if (!scope.isManager()) {
            throw ApiException.notFound("Employee", employeeId);
        }

        // Target must exist
        List<?> empList;
        try {
            empList = jdbc.query(
                "SELECT id, state_code FROM app_profiles WHERE id = ?",
                (rs, n) -> new Object[] { rs.getObject("id", UUID.class), rs.getString("state_code") },
                employeeId
            );
        } catch (Exception ex) {
            throw ApiException.notFound("Employee", employeeId);
        }
        if (empList.isEmpty() || !(empList.get(0) instanceof Object[] arr)) {
            throw ApiException.notFound("Employee", employeeId);
        }

        // Managers cannot view Admin, other Managers, or Operations staff (return 404 to hide existence)
        boolean isStaff = false;
        try {
            isStaff = jdbc.query(
                "SELECT 1 FROM app_role_assignments WHERE user_id = ? AND role IN ('ADMIN', 'MANAGER', 'OPERATIONS')",
                (rs, n) -> 1,
                employeeId
            ).size() > 0;
        } catch (Exception ignored) {}
        if (isStaff) {
            throw ApiException.notFound("Employee", employeeId);
        }

        String empState = arr.length > 1 && arr[1] instanceof String s ? s : null;
        if (!scope.coversState(empState)) {
            // Foreign state returns 404 so existence is not revealed
            throw ApiException.notFound("Employee", employeeId);
        }
    }

    public void assertCanAccessTask(AreaScope scope, UUID taskId) {
        if (scope.isAdmin()) return;

        List<?> taskList;
        try {
            taskList = jdbc.query(
                "SELECT id, state_code FROM tasks WHERE id = ?",
                (rs, n) -> rs.getString("state_code"),
                taskId
            );
        } catch (Exception ex) {
            throw ApiException.notFound("Task", taskId);
        }
        if (taskList.isEmpty()) {
            throw ApiException.notFound("Task", taskId);
        }

        if (scope.isManager()) {
            String taskState = taskList.get(0) instanceof String s ? s : null;
            if (!scope.coversState(taskState)) {
                throw ApiException.notFound("Task", taskId);
            }
        }
    }

    public void assertCanAccessTicket(AreaScope scope, UUID ticketId) {
        if (scope.isAdmin()) return;

        List<?> ticketList;
        try {
            ticketList = jdbc.query(
                "SELECT id, state_code, customer_id FROM support_tickets WHERE id = ?",
                (rs, n) -> new Object[] { rs.getString("state_code"), rs.getObject("customer_id", UUID.class) },
                ticketId
            );
        } catch (Exception ex) {
            throw ApiException.notFound("Ticket", ticketId);
        }
        if (ticketList.isEmpty() || !(ticketList.get(0) instanceof Object[] arr)) {
            throw ApiException.notFound("Ticket", ticketId);
        }

        if (scope.isManager()) {
            String ticketState = arr.length > 0 && arr[0] instanceof String s ? s : null;
            if (!scope.coversState(ticketState)) {
                throw ApiException.notFound("Ticket", ticketId);
            }
        } else {
            UUID creatorId = arr.length > 1 && arr[1] instanceof UUID u ? u : null;
            if (creatorId == null || !scope.actorId().equals(creatorId)) {
                throw ApiException.notFound("Ticket", ticketId);
            }
        }
    }

    public void assertCanAccessWallet(AreaScope scope, UUID targetUserId) {
        if (scope.isAdmin()) return;

        if (scope.isManager()) {
            assertCanAccessEmployee(scope, targetUserId);
            return;
        }

        // Regular employee can only view their own wallet
        if (!scope.actorId().equals(targetUserId)) {
            throw ApiException.forbidden("You are only permitted to view your own wallet transactions");
        }
    }
}
