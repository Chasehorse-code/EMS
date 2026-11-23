package com.chasehorse.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Records important user and system actions for accountability.
 * Audit entries are append-only; they are never updated or deleted.
 */
@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final JdbcTemplate jdbc;

    public AuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Log an audit event. All parameters except action and entityType may be null.
     *
     * @param actorId    The user performing the action (null for system events)
     * @param action     A short verb phrase, e.g. "APPROVE_TASK", "ASSIGN_ROLE"
     * @param entityType The domain entity, e.g. "TASK", "PROFILE", "WALLET"
     * @param entityId   The ID of the affected entity
     * @param metadata   Additional structured context (stored as JSON)
     */
    public void log(UUID actorId, String action, String entityType, UUID entityId, Map<String, Object> metadata) {
        try {
            String metaJson = metadata != null ? toJson(metadata) : "{}";
            jdbc.update("""
                INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, metadata)
                VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))
                """,
                UUID.randomUUID(), actorId, action, entityType, entityId, metaJson);
        } catch (Exception ex) {
            // Audit failures must never break business operations
            AuditService.log.error("Failed to write audit event: action={}, entity={}:{}", action, entityType, entityId, ex);
        }
    }

    public void log(UUID actorId, String action, String entityType, UUID entityId) {
        log(actorId, action, entityType, entityId, null);
    }

    public java.util.List<Map<String, Object>> listRecent(int limit) {
        return jdbc.query("""
            SELECT a.id, a.actor_id, p.display_name AS actor_name, a.action, a.entity_type, a.entity_id,
                   a.metadata, a.created_at
            FROM audit_events a
            LEFT JOIN app_profiles p ON p.id = a.actor_id
            ORDER BY a.created_at DESC
            LIMIT ?
            """, (rs, rowNum) -> {
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", rs.getObject("id"));
                map.put("actorId", rs.getObject("actor_id"));
                map.put("actorName", rs.getString("actor_name") != null ? rs.getString("actor_name") : "System");
                map.put("action", rs.getString("action"));
                map.put("entityType", rs.getString("entity_type"));
                map.put("entityId", rs.getObject("entity_id"));
                map.put("metadata", rs.getString("metadata"));
                map.put("createdAt", rs.getObject("created_at") != null ? rs.getObject("created_at").toString() : "");
                return map;
            }, limit > 0 ? limit : 50);
    }

    private String toJson(Map<String, Object> map) {
        // Simple JSON serialization without pulling in Jackson directly
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (var entry : map.entrySet()) {
            if (!first) sb.append(",");
            sb.append("\"").append(escapeJson(entry.getKey())).append("\":");
            Object val = entry.getValue();
            if (val == null) {
                sb.append("null");
            } else if (val instanceof Number) {
                sb.append(val);
            } else if (val instanceof Boolean) {
                sb.append(val);
            } else {
                sb.append("\"").append(escapeJson(val.toString())).append("\"");
            }
            first = false;
        }
        return sb.append("}").toString();
    }

    /** JSON string escaping per RFC 8259, including control characters (e.g. line breaks in reasons). */
    static String escapeJson(String s) {
        StringBuilder out = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.toString();
    }
}
