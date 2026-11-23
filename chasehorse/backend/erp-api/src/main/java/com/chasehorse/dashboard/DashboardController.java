package com.chasehorse.dashboard;

import com.chasehorse.area.AreaScopeService;
import com.chasehorse.auth.RoleAuthorization;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final JdbcTemplate jdbc;
    private final RoleAuthorization roleAuth;
    private final AreaScopeService areaScopeService;

    public DashboardController(JdbcTemplate jdbc, RoleAuthorization roleAuth) {
        this(jdbc, roleAuth, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public DashboardController(
        JdbcTemplate jdbc,
        RoleAuthorization roleAuth,
        @org.springframework.beans.factory.annotation.Autowired(required = false) AreaScopeService areaScopeService
    ) {
        this.jdbc = jdbc;
        this.roleAuth = roleAuth;
        this.areaScopeService = areaScopeService != null ? areaScopeService : new AreaScopeService(jdbc, roleAuth);
    }

    public Map<String, Object> getStats(String customerId, Jwt jwt) {
        return getStats(customerId, null, jwt);
    }

    @GetMapping("/stats")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER', 'EMPLOYEE', 'FIELD_WORKER')")
    public Map<String, Object> getStats(
        @RequestParam(required = false) String customerId,
        @RequestParam(required = false) String state,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
        boolean isManager = !isAdmin && roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
        boolean isOpsOrAdmin = isAdmin || isManager;
        boolean isCustomer = !isOpsOrAdmin && roles.stream().anyMatch(r -> r.equalsIgnoreCase("CUSTOMER"));
        boolean isEmployee = !isOpsOrAdmin && !isCustomer && roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("EMPLOYEE") || r.equalsIgnoreCase("FIELD_WORKER"));

        Map<String, Object> stats = new LinkedHashMap<>();

        if (isEmployee) {
            // Employee scoped home dashboard
            int openNearby = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE status = 'OPEN'", Integer.class);
            int inProgress = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status IN ('ASSIGNED', 'IN_PROGRESS')",
                Integer.class, actorId);
            int awaitingReview = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status IN ('SUBMITTED', 'IN_REVIEW')",
                Integer.class, actorId);
            int approvedMonth = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'APPROVED' AND updated_at >= date_trunc('month', now())",
                Integer.class, actorId);
            int approvedTotal = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'APPROVED'",
                Integer.class, actorId);
            int rejectedTotal = jdbc.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'REJECTED'",
                Integer.class, actorId);

            BigDecimal walletAvailable = jdbc.queryForObject(
                "SELECT COALESCE(SUM(amount), 0) FROM wallet_ledger WHERE user_id = ?",
                BigDecimal.class, actorId);
            BigDecimal walletPending = jdbc.queryForObject(
                "SELECT COALESCE(SUM(reward_amount), 0) FROM tasks WHERE assigned_to = ? AND status IN ('SUBMITTED', 'IN_REVIEW')",
                BigDecimal.class, actorId);

            stats.put("totalTasks", openNearby + inProgress + awaitingReview + approvedTotal);
            stats.put("openTasks", openNearby);
            stats.put("inProgress", inProgress);
            stats.put("awaitingReview", awaitingReview);
            stats.put("approvedThisMonth", approvedMonth);
            stats.put("approvedTotal", approvedTotal);
            stats.put("walletAvailable", walletAvailable != null ? walletAvailable : BigDecimal.ZERO);
            stats.put("walletPending", walletPending != null ? walletPending : BigDecimal.ZERO);

            double approvalRate = (approvedTotal + rejectedTotal) > 0
                ? Math.round(((double) approvedTotal / (approvedTotal + rejectedTotal)) * 100.0)
                : 100.0;
            double reworkRate = (approvedTotal + rejectedTotal) > 0
                ? Math.round(((double) rejectedTotal / (approvedTotal + rejectedTotal)) * 100.0)
                : 0.0;
            stats.put("approvalRate", approvalRate);
            stats.put("reworkRate", reworkRate);

            // Active task details for "Continue where you left off"
            var activeTasks = jdbc.query("""
                SELECT id, title, category, priority, location_area, location_address, due_at, reward_amount
                FROM tasks
                WHERE assigned_to = ? AND status IN ('ASSIGNED', 'IN_PROGRESS')
                ORDER BY updated_at DESC LIMIT 1
                """,
                (rs, n) -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", rs.getObject("id", UUID.class).toString());
                    map.put("title", rs.getString("title"));
                    map.put("category", rs.getString("category"));
                    map.put("priority", rs.getString("priority"));
                    map.put("area", rs.getString("location_area"));
                    map.put("address", rs.getString("location_address"));
                    map.put("dueAt", rs.getObject("due_at"));
                    map.put("rewardInr", rs.getBigDecimal("reward_amount"));
                    return map;
                },
                actorId
            );

            if (!activeTasks.isEmpty()) {
                Map<String, Object> activeTask = new LinkedHashMap<>(activeTasks.get(0));
                UUID activeTaskId = UUID.fromString((String) activeTask.get("id"));

                Integer doneChecklist = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM task_checklist_results WHERE task_id = ? AND completed = true",
                    Integer.class, activeTaskId);
                Integer totalChecklist = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM checklist_items ci
                    JOIN tasks t ON t.checklist_template_id = ci.template_id
                    WHERE t.id = ?
                    """, Integer.class, activeTaskId);

                activeTask.put("checklistProgress", doneChecklist != null ? doneChecklist : 0);
                activeTask.put("checklistTotal", totalChecklist != null && totalChecklist > 0 ? totalChecklist : 1);
                stats.put("activeTask", activeTask);
            }

            // 14-day completion history
            var dailyHistory = jdbc.query("""
                SELECT to_char(date_trunc('day', updated_at), 'YYYY-MM-DD') as day, COUNT(*) as cnt
                FROM tasks
                WHERE assigned_to = ? AND status = 'APPROVED' AND updated_at >= now() - INTERVAL '14 days'
                GROUP BY date_trunc('day', updated_at)
                ORDER BY day ASC
                """,
                (rs, n) -> Map.entry(rs.getString("day"), rs.getInt("cnt")),
                actorId
            );
            Map<String, Integer> historyMap = new LinkedHashMap<>();
            dailyHistory.forEach(e -> historyMap.put(e.getKey(), e.getValue()));
            stats.put("dailyCompletedHistory", historyMap);

            return stats;
        }

        // Customer or Operations/Admin counts
        String countSql;
        List<Map.Entry<String, Integer>> taskCounts;

        if (isCustomer) {
            countSql = "SELECT status, COUNT(*) as cnt FROM tasks WHERE customer_id = ? GROUP BY status";
            taskCounts = jdbc.query(countSql, (rs, n) -> Map.entry(rs.getString("status"), rs.getInt("cnt")), actorId);
        } else if (isManager) {
            // Manager: strictly scoped to assigned state
            // Manager: strictly scoped to every zone the admin assigned (one or many)
            countSql = "SELECT status, COUNT(*) as cnt FROM tasks WHERE state_code IN "
                + AreaScopeService.MANAGER_STATES_SUBQUERY + " GROUP BY status";
            taskCounts = jdbc.query(countSql, (rs, n) -> Map.entry(rs.getString("status"), rs.getInt("cnt")), actorId);

            var zones = jdbc.query("""
                SELECT s.code, s.name FROM manager_areas ma JOIN states s ON s.code = ma.state_code
                WHERE ma.manager_id = ? ORDER BY ma.assigned_at, s.name
                """, (rs, n) -> Map.entry(rs.getString("code"), rs.getString("name")), actorId);
            stats.put("areaStateCode", zones.isEmpty() ? AreaScopeService.NO_AREA_SENTINEL
                : String.join(",", zones.stream().map(Map.Entry::getKey).toList()));
            stats.put("areaStateName", zones.isEmpty() ? "Unassigned"
                : String.join(", ", zones.stream().map(Map.Entry::getValue).toList()));
        } else if (isAdmin && state != null && !state.isBlank()) {
            countSql = "SELECT status, COUNT(*) as cnt FROM tasks WHERE state_code = ? GROUP BY status";
            taskCounts = jdbc.query(countSql, (rs, n) -> Map.entry(rs.getString("status"), rs.getInt("cnt")), state.trim().toUpperCase());
        } else if (customerId != null && !customerId.isBlank()) {
            countSql = "SELECT status, COUNT(*) as cnt FROM tasks WHERE customer_id = ? GROUP BY status";
            taskCounts = jdbc.query(countSql, (rs, n) -> Map.entry(rs.getString("status"), rs.getInt("cnt")), UUID.fromString(customerId));
        } else {
            countSql = "SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status";
            taskCounts = jdbc.query(countSql, (rs, n) -> Map.entry(rs.getString("status"), rs.getInt("cnt")));
        }

        Map<String, Integer> byStatus = new LinkedHashMap<>();
        int total = 0, open = 0, inProgress = 0, awaitingReview = 0, approved = 0;
        for (var entry : taskCounts) {
            byStatus.put(entry.getKey(), entry.getValue());
            total += entry.getValue();
            switch (entry.getKey()) {
                case "OPEN" -> open = entry.getValue();
                case "IN_PROGRESS", "ASSIGNED" -> inProgress += entry.getValue();
                case "SUBMITTED", "IN_REVIEW" -> awaitingReview += entry.getValue();
                case "APPROVED" -> approved = entry.getValue();
            }
        }

        stats.put("totalTasks", total);
        stats.put("openTasks", open);
        stats.put("inProgress", inProgress);
        stats.put("awaitingReview", awaitingReview);
        stats.put("approvedTotal", approved);
        stats.put("byStatus", byStatus);

        if (isManager) {
            String zonesSql = AreaScopeService.MANAGER_STATES_SUBQUERY;

            Integer activeEmployees = jdbc.queryForObject("""
                SELECT COUNT(*) FROM app_profiles p
                JOIN app_role_assignments r ON r.user_id = p.id
                WHERE p.account_status = 'ACTIVE' AND p.state_code IN """ + zonesSql + """
                  AND r.role IN ('EMPLOYEE', 'FIELD_WORKER')
                  AND NOT EXISTS (
                      SELECT 1 FROM app_role_assignments r2
                      WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS')
                  )
                """, Integer.class, actorId);
            stats.put("activeEmployees", activeEmployees != null ? activeEmployees : 0);

            Integer pendingApprovals = jdbc.queryForObject("""
                SELECT COUNT(*) FROM app_profiles p
                JOIN app_role_assignments r ON r.user_id = p.id
                WHERE p.account_status = 'PENDING' AND p.state_code IN """ + zonesSql + """
                  AND r.role IN ('EMPLOYEE', 'FIELD_WORKER')
                  AND NOT EXISTS (
                      SELECT 1 FROM app_role_assignments r2
                      WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS')
                  )
                """, Integer.class, actorId);
            stats.put("pendingEmployeeApprovals", pendingApprovals != null ? pendingApprovals : 0);

            Integer awaitingOps = jdbc.queryForObject("""
                SELECT COUNT(*) FROM tasks WHERE status IN ('SUBMITTED', 'IN_REVIEW') AND state_code IN """ + zonesSql + """
                """, Integer.class, actorId);
            stats.put("awaitingOps", awaitingOps != null ? awaitingOps : 0);
        } else if (isAdmin) {
            if (state != null && !state.isBlank()) {
                String st = state.trim().toUpperCase();
                Integer activeEmployees = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM app_profiles WHERE account_status = 'ACTIVE' AND state_code = ?", Integer.class, st);
                stats.put("activeEmployees", activeEmployees != null ? activeEmployees : 0);

                Integer pendingApprovals = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM app_profiles WHERE account_status = 'PENDING' AND state_code = ?", Integer.class, st);
                stats.put("pendingEmployeeApprovals", pendingApprovals != null ? pendingApprovals : 0);

                Integer awaitingOps = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM tasks WHERE status IN ('SUBMITTED', 'IN_REVIEW') AND state_code = ?
                    """, Integer.class, st);
                stats.put("awaitingOps", awaitingOps != null ? awaitingOps : 0);
            } else {
                Integer activeEmployees = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM app_profiles WHERE account_status = 'ACTIVE'", Integer.class);
                stats.put("activeEmployees", activeEmployees != null ? activeEmployees : 0);

                Integer pendingApprovals = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM app_profiles WHERE account_status = 'PENDING'", Integer.class);
                stats.put("pendingEmployeeApprovals", pendingApprovals != null ? pendingApprovals : 0);

                Integer awaitingOps = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM tasks WHERE status IN ('SUBMITTED', 'IN_REVIEW')", Integer.class);
                stats.put("awaitingOps", awaitingOps != null ? awaitingOps : 0);
            }
        } else {
            stats.put("activeEmployees", 0);
            stats.put("pendingEmployeeApprovals", 0);
            stats.put("awaitingOps", 0);
        }

        return stats;
    }
}
