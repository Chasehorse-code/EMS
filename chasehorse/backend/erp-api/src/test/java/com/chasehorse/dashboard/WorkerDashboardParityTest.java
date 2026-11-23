package com.chasehorse.dashboard;

import com.chasehorse.auth.RoleAuthorization;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

class WorkerDashboardParityTest {

    private JdbcTemplate jdbc;
    private RoleAuthorization roleAuth;
    private DashboardController controller;

    @BeforeEach
    void setUp() {
        jdbc = Mockito.mock(JdbcTemplate.class);
        roleAuth = Mockito.mock(RoleAuthorization.class);
        controller = new DashboardController(jdbc, roleAuth);
    }

    @Test
    void employeeDashboardNumbersMatchDirectSqlCounts() {
        UUID workerId = UUID.randomUUID();
        Jwt jwt = Mockito.mock(Jwt.class);
        when(jwt.getSubject()).thenReturn(workerId.toString());

        // Worker role configuration
        when(roleAuth.getRoles(workerId.toString())).thenReturn(List.of("EMPLOYEE", "FIELD_WORKER"));

        // Direct SQL values
        int expectedOpen = 8;
        int expectedInProgress = 2;
        int expectedAwaitingReview = 3;
        int expectedApprovedMonth = 15;
        int expectedApprovedTotal = 42;
        int expectedRejectedTotal = 3;
        BigDecimal expectedWalletAvailable = new BigDecimal("4500.00");
        BigDecimal expectedWalletPending = new BigDecimal("1200.00");

        // Mock exact SQL queries executed by DashboardController
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM tasks WHERE status = 'OPEN'"), eq(Integer.class)))
            .thenReturn(expectedOpen);
        when(jdbc.queryForObject(contains("status IN ('ASSIGNED', 'IN_PROGRESS')"), eq(Integer.class), eq(workerId)))
            .thenReturn(expectedInProgress);
        when(jdbc.queryForObject(contains("status IN ('SUBMITTED', 'IN_REVIEW')"), eq(Integer.class), eq(workerId)))
            .thenReturn(expectedAwaitingReview);
        when(jdbc.queryForObject(contains("date_trunc('month', now())"), eq(Integer.class), eq(workerId)))
            .thenReturn(expectedApprovedMonth);
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'APPROVED'"), eq(Integer.class), eq(workerId)))
            .thenReturn(expectedApprovedTotal);
        when(jdbc.queryForObject(eq("SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'REJECTED'"), eq(Integer.class), eq(workerId)))
            .thenReturn(expectedRejectedTotal);
        when(jdbc.queryForObject(contains("FROM wallet_ledger WHERE user_id = ?"), eq(BigDecimal.class), eq(workerId)))
            .thenReturn(expectedWalletAvailable);
        when(jdbc.queryForObject(contains("reward_amount"), eq(BigDecimal.class), eq(workerId)))
            .thenReturn(expectedWalletPending);

        when(jdbc.query(contains("ORDER BY updated_at DESC LIMIT 1"), any(org.springframework.jdbc.core.RowMapper.class), eq(workerId)))
            .thenReturn(List.of(Map.of("id", UUID.randomUUID().toString(), "title", "Test Store Audit", "rewardInr", new BigDecimal("600.00"))));

        when(jdbc.query(contains("GROUP BY date_trunc('day', updated_at)"), any(org.springframework.jdbc.core.RowMapper.class), eq(workerId)))
            .thenReturn(List.of(Map.entry("2026-10-24", 4), Map.entry("2026-10-25", 6)));

        // Call Dashboard API
        Map<String, Object> stats = controller.getStats(null, jwt);

        // Verify Parity: API returned value == Direct SQL count
        assertEquals(expectedOpen, stats.get("openTasks"), "openTasks count must match SQL count");
        assertEquals(expectedInProgress, stats.get("inProgress"), "inProgress count must match SQL count");
        assertEquals(expectedAwaitingReview, stats.get("awaitingReview"), "awaitingReview count must match SQL count");
        assertEquals(expectedApprovedMonth, stats.get("approvedThisMonth"), "approvedThisMonth count must match SQL count");
        assertEquals(expectedApprovedTotal, stats.get("approvedTotal"), "approvedTotal count must match SQL count");
        assertEquals(expectedWalletAvailable, stats.get("walletAvailable"), "walletAvailable must match SQL sum");
        assertEquals(expectedWalletPending, stats.get("walletPending"), "walletPending must match SQL sum");

        // Verify Rate formulas
        double expectedApprovalRate = Math.round(((double) expectedApprovedTotal / (expectedApprovedTotal + expectedRejectedTotal)) * 100.0);
        double expectedReworkRate = Math.round(((double) expectedRejectedTotal / (expectedApprovedTotal + expectedRejectedTotal)) * 100.0);
        assertEquals(expectedApprovalRate, (Double) stats.get("approvalRate"), 0.01);
        assertEquals(expectedReworkRate, (Double) stats.get("reworkRate"), 0.01);

        assertNotNull(stats.get("activeTask"), "Active task must be returned for resume");
        assertNotNull(stats.get("dailyCompletedHistory"), "14-day history must be returned");
    }
}
