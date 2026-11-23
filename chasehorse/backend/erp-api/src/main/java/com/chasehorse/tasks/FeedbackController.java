package com.chasehorse.tasks;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class FeedbackController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RoleAuthorization roleAuth;

    public FeedbackController(JdbcTemplate jdbc, AuditService audit, RoleAuthorization roleAuth) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.roleAuth = roleAuth;
    }

    public record CreateFeedbackRequest(
        @NotNull @Min(1) @Max(5) Integer overallRating,
        @Min(1) @Max(5) Integer qualityRating,
        @Min(1) @Max(5) Integer punctualityRating,
        @Min(1) @Max(5) Integer communicationRating,
        @Min(1) @Max(5) Integer evidenceClarityRating,
        String comment
    ) {}

    public record FeedbackView(
        UUID id,
        UUID taskId,
        String taskTitle,
        UUID employeeId,
        String employeeName,
        UUID customerId,
        String customerName,
        int overallRating,
        int qualityRating,
        int punctualityRating,
        int communicationRating,
        int evidenceClarityRating,
        String comment,
        OffsetDateTime createdAt
    ) {}

    @PostMapping("/tasks/{taskId}/feedback")
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'CUSTOMER', 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public FeedbackView submitFeedback(
        @PathVariable UUID taskId,
        @Valid @RequestBody CreateFeedbackRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaff = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        // 1. Task check: must exist, be APPROVED, and match customer
        var tasks = jdbc.query("""
            SELECT id, title, customer_id, assigned_to, status
            FROM tasks WHERE id = ?
            """,
            (rs, n) -> Map.of(
                "title", rs.getString("title"),
                "customer_id", rs.getObject("customer_id", UUID.class),
                "assigned_to", rs.getObject("assigned_to", UUID.class) != null ? rs.getObject("assigned_to", UUID.class) : UUID.randomUUID(),
                "has_worker", rs.getObject("assigned_to", UUID.class) != null,
                "status", rs.getString("status")
            ),
            taskId
        );

        if (tasks.isEmpty()) {
            throw ApiException.notFound("Task", taskId);
        }

        var task = tasks.get(0);
        String status = (String) task.get("status");
        if (!"APPROVED".equalsIgnoreCase(status)) {
            throw ApiException.badRequest("Feedback can only be submitted for completed tasks with status APPROVED (current status: " + status + ")");
        }

        UUID customerId = (UUID) task.get("customer_id");
        if (!isStaff && !actorId.equals(customerId)) {
            throw ApiException.forbidden("Only the customer who requested the task can submit feedback");
        }

        boolean hasWorker = (Boolean) task.get("has_worker");
        if (!hasWorker) {
            throw ApiException.badRequest("Cannot submit feedback on a task with no assigned worker");
        }
        UUID employeeId = (UUID) task.get("assigned_to");

        // 2. Prevent duplicate feedback
        Integer existingCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM task_feedback WHERE task_id = ?",
            Integer.class, taskId
        );
        if (existingCount != null && existingCount > 0) {
            throw ApiException.conflict("Feedback has already been submitted for this task");
        }

        UUID feedbackId = UUID.randomUUID();
        int quality = req.qualityRating() != null ? req.qualityRating() : req.overallRating();
        int punctuality = req.punctualityRating() != null ? req.punctualityRating() : req.overallRating();
        int communication = req.communicationRating() != null ? req.communicationRating() : req.overallRating();
        int evidenceClarity = req.evidenceClarityRating() != null ? req.evidenceClarityRating() : req.overallRating();

        jdbc.update("""
            INSERT INTO task_feedback (
                id, task_id, employee_id, customer_id,
                overall_rating, quality_rating, punctuality_rating,
                communication_rating, evidence_clarity_rating, comment, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
            """,
            feedbackId, taskId, employeeId, actorId,
            req.overallRating(), quality, punctuality, communication, evidenceClarity,
            req.comment() != null ? req.comment().trim() : null
        );

        audit.log(actorId, "TASK_FEEDBACK_SUBMITTED", "TASK", taskId, Map.of(
            "feedback_id", feedbackId.toString(),
            "overall_rating", req.overallRating().toString(),
            "employee_id", employeeId.toString()
        ));

        return getTaskFeedback(taskId, jwt);
    }

    @GetMapping("/tasks/{taskId}/feedback")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'CUSTOMER', 'EMPLOYEE', 'FIELD_WORKER', 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public FeedbackView getTaskFeedback(
        @PathVariable UUID taskId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaff = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        var items = jdbc.query("""
            SELECT f.id, f.task_id, t.title as task_title, f.employee_id, ep.display_name as employee_name,
                   f.customer_id, cp.display_name as customer_name,
                   f.overall_rating, f.quality_rating, f.punctuality_rating,
                   f.communication_rating, f.evidence_clarity_rating, f.comment, f.created_at
            FROM task_feedback f
            JOIN tasks t ON t.id = f.task_id
            JOIN app_profiles ep ON ep.id = f.employee_id
            JOIN app_profiles cp ON cp.id = f.customer_id
            WHERE f.task_id = ?
            """,
            (rs, n) -> new FeedbackView(
                rs.getObject("id", UUID.class),
                rs.getObject("task_id", UUID.class),
                rs.getString("task_title"),
                rs.getObject("employee_id", UUID.class),
                rs.getString("employee_name"),
                rs.getObject("customer_id", UUID.class),
                rs.getString("customer_name"),
                rs.getInt("overall_rating"),
                rs.getInt("quality_rating"),
                rs.getInt("punctuality_rating"),
                rs.getInt("communication_rating"),
                rs.getInt("evidence_clarity_rating"),
                rs.getString("comment"),
                rs.getObject("created_at", OffsetDateTime.class)
            ),
            taskId
        );

        if (items.isEmpty()) {
            throw ApiException.notFound("Feedback for task", taskId);
        }

        FeedbackView fb = items.get(0);
        // Authorization check: only author customer, assigned worker, or staff can view
        if (!isStaff && !actorId.equals(fb.customerId()) && !actorId.equals(fb.employeeId())) {
            throw ApiException.forbidden("You do not have permission to view feedback for this task");
        }

        return fb;
    }

    @GetMapping("/employees/{employeeId}/feedback")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'CUSTOMER', 'EMPLOYEE', 'FIELD_WORKER', 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public List<FeedbackView> getEmployeeFeedback(
        @PathVariable UUID employeeId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaff = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
        boolean isSelf = actorId.equals(employeeId);

        // If customer, they only see feedback they authored; staff and worker see all
        String query;
        List<Object> params = new ArrayList<>();
        if (isStaff || isSelf) {
            query = """
                SELECT f.id, f.task_id, t.title as task_title, f.employee_id, ep.display_name as employee_name,
                       f.customer_id, cp.display_name as customer_name,
                       f.overall_rating, f.quality_rating, f.punctuality_rating,
                       f.communication_rating, f.evidence_clarity_rating, f.comment, f.created_at
                FROM task_feedback f
                JOIN tasks t ON t.id = f.task_id
                JOIN app_profiles ep ON ep.id = f.employee_id
                JOIN app_profiles cp ON cp.id = f.customer_id
                WHERE f.employee_id = ?
                ORDER BY f.created_at DESC
                """;
            params.add(employeeId);
        } else {
            query = """
                SELECT f.id, f.task_id, t.title as task_title, f.employee_id, ep.display_name as employee_name,
                       f.customer_id, cp.display_name as customer_name,
                       f.overall_rating, f.quality_rating, f.punctuality_rating,
                       f.communication_rating, f.evidence_clarity_rating, f.comment, f.created_at
                FROM task_feedback f
                JOIN tasks t ON t.id = f.task_id
                JOIN app_profiles ep ON ep.id = f.employee_id
                JOIN app_profiles cp ON cp.id = f.customer_id
                WHERE f.employee_id = ? AND f.customer_id = ?
                ORDER BY f.created_at DESC
                """;
            params.add(employeeId);
            params.add(actorId);
        }

        return jdbc.query(query, (rs, n) -> new FeedbackView(
            rs.getObject("id", UUID.class),
            rs.getObject("task_id", UUID.class),
            rs.getString("task_title"),
            rs.getObject("employee_id", UUID.class),
            rs.getString("employee_name"),
            rs.getObject("customer_id", UUID.class),
            rs.getString("customer_name"),
            rs.getInt("overall_rating"),
            rs.getInt("quality_rating"),
            rs.getInt("punctuality_rating"),
            rs.getInt("communication_rating"),
            rs.getInt("evidence_clarity_rating"),
            rs.getString("comment"),
            rs.getObject("created_at", OffsetDateTime.class)
        ), params.toArray());
    }
}
