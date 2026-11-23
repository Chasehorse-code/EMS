package com.chasehorse.approvals;

import com.chasehorse.area.AreaScopeService;
import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/v1/approvals")
public class ApprovalController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RoleAuthorization roleAuth;
    private final AreaScopeService areaScopeService;

    public ApprovalController(
        JdbcTemplate jdbc,
        AuditService audit,
        @org.springframework.beans.factory.annotation.Autowired(required = false) RoleAuthorization roleAuth,
        @org.springframework.beans.factory.annotation.Autowired(required = false) AreaScopeService areaScopeService
    ) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.roleAuth = roleAuth != null ? roleAuth : new RoleAuthorization(jdbc);
        this.areaScopeService = areaScopeService != null ? areaScopeService : new AreaScopeService(jdbc, this.roleAuth);
    }

    public record ApprovalView(
        UUID id, UUID taskId, UUID evidenceId, UUID employeeId,
        BigDecimal rewardInr, String stage, OffsetDateTime submittedAt,
        OffsetDateTime decidedAt, String decidedBy, String note
    ) {}

    public record ApprovalDecisionRequest(
        @NotBlank String stage,
        String note,
        String decidedBy
    ) {}

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER')")
    public List<ApprovalView> listApprovals(@AuthenticationPrincipal Jwt jwt) {
        StringBuilder sql = new StringBuilder("""
            SELECT a.id, a.task_id, a.evidence_id, t.assigned_to AS employee_id,
                   t.reward_amount, a.decision AS stage, a.created_at, a.reason
            FROM task_approvals a
            JOIN tasks t ON a.task_id = t.id
            WHERE 1=1
            """);
        List<Object> params = new java.util.ArrayList<>();

        if (jwt != null) {
            UUID actorId = UUID.fromString(jwt.getSubject());
            List<String> roles = roleAuth.getRoles(jwt.getSubject());
            boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
            boolean isManager = roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

            if (isManager && !isAdmin) {
                sql.append(" AND t.state_code IN " + AreaScopeService.MANAGER_STATES_SUBQUERY + " ");
                params.add(actorId);
            }
        }

        sql.append(" ORDER BY a.created_at DESC LIMIT 200");

        return jdbc.query(sql.toString(),
            (rs, n) -> new ApprovalView(
                rs.getObject("id", UUID.class),
                rs.getObject("task_id", UUID.class),
                rs.getObject("evidence_id", UUID.class),
                rs.getObject("employee_id", UUID.class),
                rs.getBigDecimal("reward_amount"),
                rs.getString("stage"),
                rs.getObject("created_at", OffsetDateTime.class),
                null,
                null,
                rs.getString("reason")
            ),
            params.toArray()
        );
    }

    @PostMapping("/{id}/decision")
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER')")
    public Map<String, Object> decideApproval(
        @PathVariable UUID id,
        @Valid @RequestBody ApprovalDecisionRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
        boolean isManager = roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        boolean isApproved = "APPROVED".equalsIgnoreCase(request.stage());
        boolean isRework = "REWORK".equalsIgnoreCase(request.stage());

        var approvalRows = jdbc.query("""
            SELECT a.task_id, a.stage, a.reviewer_id, t.assigned_to, t.reward_amount, t.state_code
            FROM task_approvals a
            JOIN tasks t ON a.task_id = t.id
            WHERE a.id = ?
            """, (rs, n) -> Map.of(
                "taskId", rs.getObject("task_id", UUID.class),
                "currentStage", rs.getString("stage") != null ? rs.getString("stage") : "MANAGER_REVIEW",
                "reviewerId", rs.getObject("reviewer_id", UUID.class) != null ? rs.getObject("reviewer_id", UUID.class) : actorId,
                "employeeId", rs.getObject("assigned_to", UUID.class) != null ? rs.getObject("assigned_to", UUID.class) : actorId,
                "rewardAmount", rs.getBigDecimal("reward_amount") != null ? rs.getBigDecimal("reward_amount") : BigDecimal.ZERO,
                "stateCode", rs.getString("state_code") != null ? rs.getString("state_code") : ""
            ), id);

        if (approvalRows.isEmpty()) {
            throw ApiException.notFound("Approval", id);
        }

        var appData = approvalRows.get(0);
        UUID taskId = (UUID) appData.get("taskId");
        String currentStage = (String) appData.get("currentStage");
        UUID previousReviewer = (UUID) appData.get("reviewerId");
        UUID employeeId = (UUID) appData.get("employeeId");
        BigDecimal reward = (BigDecimal) appData.get("rewardAmount");
        String taskState = (String) appData.get("stateCode");

        // 1. Area Scope Check: manager must belong to same state
        if (isManager && !isAdmin) {
            if (!areaScopeService.managerCovers(actorId, taskState)) {
                throw ApiException.notFound("Approval", id);
            }
        }

        // 2. Prevent Self-Review: assigned field worker cannot approve their own submission
        if (actorId.equals(employeeId)) {
            throw ApiException.forbidden("Self-review forbidden: The assigned field worker cannot review or approve their own submission.");
        }

        // 3. Two-Stage Rule Execution
        if (isApproved) {
            if ("MANAGER_REVIEW".equalsIgnoreCase(currentStage)) {
                // Stage 1 approval: transitions to Stage 2 (OPS_REVIEW), task remains IN_REVIEW
                jdbc.update("""
                    UPDATE task_approvals
                    SET stage = 'OPS_REVIEW', decision = 'PENDING', reviewer_id = ?, reason = ?
                    WHERE id = ?
                    """, actorId, request.note(), id);

                jdbc.update("UPDATE tasks SET status = 'IN_REVIEW', updated_at = now() WHERE id = ?", taskId);

                audit.log(actorId, "APPROVAL_STAGE1_COMPLETED", "TASK_APPROVAL", id,
                    Map.of("taskId", taskId.toString(), "nextStage", "OPS_REVIEW"));

                return Map.of("id", id, "stage", "OPS_REVIEW", "status", "SUCCESS", "message", "Stage 1 approved. Forwarded to Stage 2 Operations Review.");
            } else {
                // Stage 2 (OPS_REVIEW / FINAL): must be a DIFFERENT person from Stage 1 reviewer
                if (!isAdmin && previousReviewer != null && actorId.equals(previousReviewer)) {
                    throw ApiException.badRequest("Two-stage rule violation: Stage 2 reviewer must be a different person from Stage 1 reviewer.");
                }

                jdbc.update("""
                    UPDATE task_approvals
                    SET stage = 'FINAL', decision = 'APPROVED', reviewer_id = ?, reason = ?
                    WHERE id = ?
                    """, actorId, request.note(), id);

                jdbc.update("UPDATE tasks SET status = 'APPROVED', updated_at = now() WHERE id = ?", taskId);

                // Credit worker wallet atomically in the same transaction
                if (reward != null && reward.compareTo(BigDecimal.ZERO) > 0) {
                    String idempotencyKey = "task-reward-" + taskId;
                    jdbc.update("""
                        INSERT INTO wallet_ledger (id, user_id, task_id, idempotency_key, entry_type, amount, currency, description, created_by)
                        VALUES (?, ?, ?, ?, 'TASK_REWARD', ?, 'INR', 'Reward for completing task', ?)
                        ON CONFLICT (idempotency_key) DO NOTHING
                        """, UUID.randomUUID(), employeeId, taskId, idempotencyKey, reward, actorId);

                    audit.log(actorId, "WALLET_CREDITED", "WALLET_LEDGER", employeeId,
                        Map.of("taskId", taskId.toString(), "amount", reward.toString()));
                }

                audit.log(actorId, "APPROVAL_DECIDED", "TASK_APPROVAL", id,
                    Map.of("decision", "APPROVED", "taskId", taskId.toString()));

                return Map.of("id", id, "stage", "FINAL", "status", "SUCCESS", "message", "Final approval granted. Bounty credited to worker wallet.");
            }
        } else if (isRework) {
            jdbc.update("""
                UPDATE task_approvals SET decision = 'REWORK', reviewer_id = ?, reason = ? WHERE id = ?
                """, actorId, request.note(), id);

            jdbc.update("UPDATE tasks SET status = 'IN_PROGRESS', updated_at = now() WHERE id = ?", taskId);

            audit.log(actorId, "APPROVAL_REWORK_REQUESTED", "TASK_APPROVAL", id,
                Map.of("taskId", taskId.toString(), "reason", request.note() != null ? request.note() : ""));

            return Map.of("id", id, "stage", currentStage, "status", "REWORK", "message", "Rework requested from worker.");
        } else {
            // Rejection
            jdbc.update("""
                UPDATE task_approvals SET stage = 'FINAL', decision = 'REJECTED', reviewer_id = ?, reason = ? WHERE id = ?
                """, actorId, request.note(), id);

            jdbc.update("UPDATE tasks SET status = 'REJECTED', updated_at = now() WHERE id = ?", taskId);

            audit.log(actorId, "APPROVAL_REJECTED", "TASK_APPROVAL", id,
                Map.of("taskId", taskId.toString(), "reason", request.note() != null ? request.note() : ""));

            return Map.of("id", id, "stage", "FINAL", "status", "REJECTED", "message", "Submission rejected.");
        }
    }
}
