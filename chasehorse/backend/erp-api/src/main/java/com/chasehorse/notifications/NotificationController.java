package com.chasehorse.notifications;

import com.chasehorse.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final JdbcTemplate jdbc;

    public NotificationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record NotificationView(
        UUID id, UUID userId, String title, String body, String type,
        String entityType, UUID entityId, boolean read, OffsetDateTime createdAt
    ) {}

    private void syncRealEvents(UUID userId) {
        // Task assignment / accept / decline / drop notifications are written when they happen (InAppNotifier).

        // Task Approvals & Rework
        try {
            var approvals = jdbc.queryForList("""
                SELECT app.task_id, app.decision, app.reason, t.title, app.created_at
                FROM task_approvals app
                JOIN tasks t ON t.id = app.task_id
                WHERE t.assigned_to = ?
                """, userId);
            for (var row : approvals) {
                UUID taskId = (UUID) row.get("task_id");
                String decision = (String) row.get("decision");
                String reason = (String) row.get("reason");
                String title = (String) row.get("title");
                OffsetDateTime createdAt = row.get("created_at") instanceof OffsetDateTime ot ? ot : OffsetDateTime.now();

                if ("APPROVED".equalsIgnoreCase(decision)) {
                    Integer exists = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'TASK_APPROVED' AND entity_id = ?",
                        Integer.class, userId, taskId);
                    if (exists != null && exists == 0) {
                        jdbc.update("""
                            INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, read, created_at)
                            VALUES (?, ?, 'Task Approved', ?, 'TASK_APPROVED', 'TASK', ?, false, ?)
                            """, UUID.randomUUID(), userId, "Your submission for " + (title != null ? title : "task") + " was approved.", taskId, createdAt);
                    }
                } else if ("REWORK".equalsIgnoreCase(decision)) {
                    Integer exists = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'REWORK_REQUESTED' AND entity_id = ?",
                        Integer.class, userId, taskId);
                    if (exists != null && exists == 0) {
                        String body = reason != null && !reason.isBlank() ? "Rework requested: " + reason : "Reviewer requested rework on evidence.";
                        jdbc.update("""
                            INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, read, created_at)
                            VALUES (?, ?, 'Evidence Needs Rework', ?, 'REWORK_REQUESTED', 'TASK', ?, false, ?)
                            """, UUID.randomUUID(), userId, body, taskId, createdAt);
                    }
                }
            }
        } catch (Exception ignored) {}

        // 3. Wallet Credits
        try {
            var credits = jdbc.queryForList("""
                SELECT w.task_id, w.amount, w.created_at
                FROM wallet_ledger w
                WHERE w.user_id = ? AND w.entry_type = 'TASK_REWARD'
                """, userId);
            for (var row : credits) {
                UUID taskId = (UUID) row.get("task_id");
                var amount = row.get("amount");
                OffsetDateTime createdAt = row.get("created_at") instanceof OffsetDateTime ot ? ot : OffsetDateTime.now();
                Integer exists = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'REWARD_CREDITED' AND entity_id = ?",
                    Integer.class, userId, taskId);
                if (exists != null && exists == 0) {
                    jdbc.update("""
                        INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, read, created_at)
                        VALUES (?, ?, 'Reward Credited', ?, 'REWARD_CREDITED', 'WALLET', ?, false, ?)
                        """, UUID.randomUUID(), userId, "Reward of ₹" + amount + " credited to your wallet.", taskId, createdAt);
                }
            }
        } catch (Exception ignored) {}

        // 4. Ticket Replies
        try {
            var comments = jdbc.queryForList("""
                SELECT c.ticket_id, c.author_name, c.message, c.created_at
                FROM support_ticket_comments c
                JOIN support_tickets t ON t.id = c.ticket_id
                WHERE t.customer_id = ? AND c.author_id <> ?
                """, userId, userId);
            for (var row : comments) {
                UUID ticketId = (UUID) row.get("ticket_id");
                String authorName = (String) row.get("author_name");
                String message = (String) row.get("message");
                String snippet = message != null && message.length() > 60 ? message.substring(0, 57) + "..." : message;
                OffsetDateTime createdAt = row.get("created_at") instanceof OffsetDateTime ot ? ot : OffsetDateTime.now();
                Integer exists = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'TICKET_REPLY' AND entity_id = ?",
                    Integer.class, userId, ticketId);
                if (exists != null && exists == 0) {
                    jdbc.update("""
                        INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, read, created_at)
                        VALUES (?, ?, 'Ticket Reply', ?, 'TICKET_REPLY', 'TICKET', ?, false, ?)
                        """, UUID.randomUUID(), userId, (authorName != null ? authorName : "Support") + ": " + snippet, ticketId, createdAt);
                }
            }
        } catch (Exception ignored) {}
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<NotificationView> listNotifications(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        syncRealEvents(userId);
        return jdbc.query("""
            SELECT id, user_id, title, body, type, entity_type, entity_id, read, created_at
            FROM notifications WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 50
            """,
            (rs, n) -> new NotificationView(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("title"),
                rs.getString("body"),
                rs.getString("type"),
                rs.getString("entity_type"),
                rs.getObject("entity_id", UUID.class),
                rs.getBoolean("read"),
                rs.getObject("created_at", OffsetDateTime.class)
            ), userId
        );
    }

    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getUnreadCount(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        syncRealEvents(userId);
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = false",
            Integer.class, userId);
        return Map.of("unreadCount", count != null ? count : 0);
    }

    @PostMapping("/mark-all-read")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> markAllRead(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        int rows = jdbc.update("""
            UPDATE notifications SET read = true WHERE user_id = ? AND read = false
            """, userId);
        return Map.of("updated", rows);
    }

    @PatchMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> markAsRead(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        int rows = jdbc.update("""
            UPDATE notifications SET read = true WHERE id = ? AND user_id = ?
            """, id, userId);

        if (rows == 0) throw ApiException.notFound("Notification", id);
        return Map.of("id", id, "read", true);
    }
}
