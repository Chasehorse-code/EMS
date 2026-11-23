package com.chasehorse.notifications;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Writes rows to the notifications table (bell + pop-up in the portal). Runs inside the caller's
 * transaction, so a notification exists only if the action it describes was committed.
 */
@Service
public class InAppNotifier {
    private static final int MAX_BODY = 1000;

    private final JdbcTemplate jdbc;

    public InAppNotifier(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void notify(UUID userId, String title, String body, String type, String entityType, UUID entityId) {
        if (userId == null) return;
        jdbc.update("""
            INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id, read)
            VALUES (?, ?, ?, ?, ?, ?, ?, false)
            """, UUID.randomUUID(), userId, truncate(title, 255), truncate(body, MAX_BODY), type, entityType, entityId);
    }

    public void notifyAll(Collection<UUID> userIds, String title, String body, String type, String entityType, UUID entityId) {
        for (UUID id : new LinkedHashSet<>(userIds)) {
            notify(id, title, body, type, entityType, entityId);
        }
    }

    /** Active operations managers of the zone (state). */
    public List<UUID> zoneManagers(String stateCode) {
        if (stateCode == null || stateCode.isBlank()) return List.of();
        return jdbc.query("""
            SELECT DISTINCT p.id FROM manager_areas m JOIN app_profiles p ON p.id = m.manager_id
            WHERE m.state_code = ? AND p.account_status = 'ACTIVE'
              AND EXISTS (SELECT 1 FROM app_role_assignments r WHERE r.user_id = p.id AND r.role IN ('MANAGER', 'OPERATIONS'))
            """, (rs, n) -> rs.getObject("id", UUID.class), stateCode);
    }

    /** Active platform admins. */
    public List<UUID> admins() {
        return jdbc.query("""
            SELECT DISTINCT p.id FROM app_profiles p JOIN app_role_assignments r ON r.user_id = p.id
            WHERE r.role = 'ADMIN' AND p.account_status = 'ACTIVE'
            """, (rs, n) -> rs.getObject("id", UUID.class));
    }

    /** Zone managers + admins + extra people, without the actor (no one is notified of their own action). */
    public Set<UUID> staffFor(String stateCode, UUID actorId, UUID... extra) {
        Set<UUID> ids = new LinkedHashSet<>(zoneManagers(stateCode));
        ids.addAll(admins());
        for (UUID id : extra) if (id != null) ids.add(id);
        if (actorId != null) ids.remove(actorId);
        return ids;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
