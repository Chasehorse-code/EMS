package com.chasehorse.wallets;

import com.chasehorse.area.AreaScope;
import com.chasehorse.area.AreaScopeService;
import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wallets")
public class WalletController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RoleAuthorization roleAuth;
    private final AreaScopeService areaScopeService;

    @org.springframework.beans.factory.annotation.Autowired
    public WalletController(
        JdbcTemplate jdbc,
        AuditService audit,
        RoleAuthorization roleAuth,
        @org.springframework.beans.factory.annotation.Autowired(required = false) AreaScopeService areaScopeService
    ) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.roleAuth = roleAuth;
        this.areaScopeService = areaScopeService != null ? areaScopeService : new AreaScopeService(jdbc, roleAuth);
    }

    public record WalletAccountView(
        UUID employeeId, BigDecimal balanceInr, BigDecimal pendingInr
    ) {}

    public record WalletTransactionView(
        UUID id, UUID employeeId, String type, BigDecimal amountInr,
        String status, OffsetDateTime createdAt, String reference, UUID taskId
    ) {}

    public record AdjustWalletRequest(
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotBlank String entryType,
        @NotBlank String description
    ) {}

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER')")
    public List<WalletAccountView> listWalletAccounts(
        @RequestParam(required = false) String state,
        Authentication authentication
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, state);

        String sql;
        Object[] params;

        if (scope.isAdmin()) {
            if (scope.hasState()) {
                sql = """
                    SELECT w.user_id, COALESCE(SUM(w.amount), 0) AS balance
                    FROM wallet_ledger w
                    JOIN app_profiles p ON p.id = w.user_id
                    WHERE p.state_code = ?
                    GROUP BY w.user_id
                    """;
                params = new Object[] { scope.stateCode() };
            } else {
                sql = """
                    SELECT user_id, COALESCE(SUM(amount), 0) AS balance
                    FROM wallet_ledger
                    GROUP BY user_id
                    """;
                params = new Object[] {};
            }
        } else {
            // Manager: only see field workers belonging to their assigned state
            sql = """
                SELECT w.user_id, COALESCE(SUM(w.amount), 0) AS balance
                FROM wallet_ledger w
                JOIN app_profiles p ON p.id = w.user_id
                JOIN app_role_assignments r ON r.user_id = p.id
                WHERE p.state_code = ?
                  AND r.role IN ('EMPLOYEE', 'FIELD_WORKER')
                  AND NOT EXISTS (
                      SELECT 1 FROM app_role_assignments r2
                      WHERE r2.user_id = p.id AND r2.role IN ('ADMIN', 'MANAGER', 'OPERATIONS')
                  )
                GROUP BY w.user_id
                """;
            params = new Object[] { scope.stateCode() };
        }

        return jdbc.query(sql,
            (rs, n) -> new WalletAccountView(
                rs.getObject("user_id", UUID.class),
                rs.getBigDecimal("balance"),
                BigDecimal.ZERO
            ),
            params
        );
    }

    @GetMapping("/me")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'EMPLOYEE', 'FIELD_WORKER')")
    public WalletAccountView getMyWalletAccount(
        @AuthenticationPrincipal Jwt jwt,
        Authentication authentication
    ) {
        UUID employeeId = UUID.fromString(jwt.getSubject());
        return getWalletAccount(employeeId, authentication);
    }

    @GetMapping("/me/transactions")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'EMPLOYEE', 'FIELD_WORKER')")
    public List<WalletTransactionView> listMyTransactions(
        @AuthenticationPrincipal Jwt jwt,
        Authentication authentication
    ) {
        UUID employeeId = UUID.fromString(jwt.getSubject());
        return listTransactions(employeeId, authentication);
    }

    @GetMapping("/{employeeId}")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'EMPLOYEE', 'FIELD_WORKER')")
    public WalletAccountView getWalletAccount(
        @PathVariable UUID employeeId,
        Authentication authentication
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, null);
        areaScopeService.assertCanAccessWallet(scope, employeeId);

        BigDecimal balance = jdbc.queryForObject(
            "SELECT COALESCE(SUM(amount), 0) FROM wallet_ledger WHERE user_id = ?",
            BigDecimal.class, employeeId
        );

        BigDecimal pending = jdbc.queryForObject(
            "SELECT COALESCE(SUM(reward_amount), 0) FROM tasks WHERE assigned_to = ? AND status IN ('SUBMITTED', 'IN_REVIEW')",
            BigDecimal.class, employeeId
        );

        return new WalletAccountView(employeeId, balance != null ? balance : BigDecimal.ZERO, pending != null ? pending : BigDecimal.ZERO);
    }

    @GetMapping("/{employeeId}/transactions")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'EMPLOYEE', 'FIELD_WORKER')")
    public List<WalletTransactionView> listTransactions(
        @PathVariable UUID employeeId,
        Authentication authentication
    ) {
        AreaScope scope = areaScopeService.resolveScope(authentication, null);
        areaScopeService.assertCanAccessWallet(scope, employeeId);

        return jdbc.query("""
            SELECT id, user_id, entry_type, amount, created_at, description, task_id
            FROM wallet_ledger WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 100
            """,
            (rs, n) -> new WalletTransactionView(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("entry_type") != null ? rs.getString("entry_type").toLowerCase() : "task_reward",
                rs.getBigDecimal("amount"),
                "completed",
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getString("description"),
                rs.getObject("task_id", UUID.class)
            ), employeeId
        );
    }

    @PostMapping("/{employeeId}/adjust")
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN')")
    public Map<String, Object> adjustWallet(
        @PathVariable UUID employeeId,
        @Valid @RequestBody AdjustWalletRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : null;
        UUID id = UUID.randomUUID();
        String idempotencyKey = "manual-adj-" + UUID.randomUUID();

        jdbc.update("""
            INSERT INTO wallet_ledger (id, user_id, idempotency_key, entry_type, amount, currency, description, created_by)
            VALUES (?, ?, ?, ?, ?, 'INR', ?, ?)
            """, id, employeeId, idempotencyKey, request.entryType().toUpperCase(),
            request.amount(), request.description(), actorId);

        audit.log(actorId, "WALLET_MANUAL_ADJUSTMENT", "WALLET_LEDGER", employeeId,
            Map.of("amount", request.amount().toString(), "description", request.description()));

        return Map.of("id", id, "status", "SUCCESS", "adjustedAmount", request.amount());
    }
}
