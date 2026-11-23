package com.chasehorse.common;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Concurrency-safe database-generated display identifier service.
 * Increments global sequence counters in id_counters using row-level locks
 * (INSERT ... ON CONFLICT DO UPDATE RETURNING).
 *
 * Never uses MAX() + 1. Sequences never reuse a number, even across rollbacks.
 * Numbers are padded to at least 3 digits (e.g., AOFW001, ST001, EMP001).
 */
@Service
public class IdGeneratorService {
    private final JdbcTemplate jdbc;

    public IdGeneratorService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Generates the next atomic sequence ID for a given prefix in an autonomous transaction
     * to ensure numbers are never rolled back or reused.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String nextId(String prefix) {
        String cleanPrefix = prefix != null ? prefix.trim().toUpperCase() : "CH";

        Long val = jdbc.queryForObject("""
            INSERT INTO id_counters (prefix, current_value, updated_at)
            VALUES (?, 1, now())
            ON CONFLICT (prefix)
            DO UPDATE SET current_value = id_counters.current_value + 1, updated_at = now()
            RETURNING current_value
            """, Long.class, cleanPrefix);

        long seq = (val != null) ? val : 1L;
        return String.format("%s%03d", cleanPrefix, seq);
    }

    /**
     * Resolves creator role to appropriate task ID prefix:
     *   ADMIN -> AOFW
     *   CUSTOMER -> COFW
     *   OPERATIONS -> OOFW
     *   MANAGER -> MOFW
     */
    public String nextTaskId(String creatorRole) {
        String prefix;
        if (creatorRole == null) {
            prefix = "AOFW";
        } else {
            String upper = creatorRole.toUpperCase();
            if (upper.contains("ADMIN")) {
                prefix = "AOFW";
            } else if (upper.contains("CUSTOMER") || upper.contains("CLIENT")) {
                prefix = "COFW";
            } else if (upper.contains("OPERATION") || upper.contains("OPS")) {
                prefix = "OOFW";
            } else if (upper.contains("MANAGER")) {
                prefix = "MOFW";
            } else {
                prefix = "AOFW";
            }
        }
        return nextId(prefix);
    }

    /**
     * Generates next support ticket display ID (ST001, ST002, ...)
     */
    public String nextTicketId() {
        return nextId("ST");
    }

    /**
     * Generates next employee display ID (EMP001, EMP002, ...)
     */
    public String nextEmployeeId() {
        return nextId("EMP");
    }
}
