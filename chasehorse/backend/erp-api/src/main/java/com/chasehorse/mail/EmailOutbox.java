package com.chasehorse.mail;

import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Queues e-mail in the {@code email_outbox} table.
 *
 * <p>Call it inside the same transaction as the business change: if the change rolls back, the
 * e-mail is never queued, and if it commits, {@link EmailDispatcher} sends it (with retries).
 * Queuing never throws for bad recipient data — a notification must not break the business action.
 */
@Service
public class EmailOutbox {
    private static final Logger log = LoggerFactory.getLogger(EmailOutbox.class);
    private static final int MAX_SUBJECT = 200;

    private final JdbcTemplate jdbc;
    private final MailSettings settings;

    public EmailOutbox(JdbcTemplate jdbc, MailSettings settings) {
        this.jdbc = jdbc;
        this.settings = settings;
    }

    /** @return true when a new row was queued; false when skipped (no valid recipient) or already queued. */
    public boolean enqueue(EmailMessage message) {
        List<String> to = cleanAddresses(message.to(), Set.of());
        if (to.isEmpty()) {
            log.warn("E-mail {} not queued: no valid recipient", message.dedupeKey());
            return false;
        }
        List<String> cc = cleanAddresses(message.cc(), Set.copyOf(to));

        String dedupeKey = truncate(message.dedupeKey(), 255);
        Integer existing = jdbc.queryForObject(
            "SELECT COUNT(*) FROM email_outbox WHERE dedupe_key = ?", Integer.class, dedupeKey);
        if (existing != null && existing > 0) return false;
        try {
            jdbc.update("""
                INSERT INTO email_outbox (id, dedupe_key, template, from_address, to_addresses, cc_addresses,
                                          subject, body_text, body_html)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                dedupeKey,
                truncate(message.template(), 60),
                settings.fromAddress(),
                String.join(",", to),
                cc.isEmpty() ? null : String.join(",", cc),
                safeSubject(message.subject()),
                message.textBody(),
                message.htmlBody()
            );
            return true;
        } catch (DuplicateKeyException raced) {
            // Another transaction queued the same notification first; the unique key keeps it single.
            return false;
        }
    }

    /** Validated, lower-cased, de-duplicated addresses, excluding any in {@code exclude}. */
    static List<String> cleanAddresses(List<String> raw, Set<String> exclude) {
        Set<String> out = new LinkedHashSet<>();
        for (String candidate : raw) {
            if (candidate == null) continue;
            String address = candidate.trim().toLowerCase(Locale.ROOT);
            if (address.isEmpty() || exclude.contains(address)) continue;
            try {
                InternetAddress parsed = new InternetAddress(address, true);
                parsed.validate();
                out.add(parsed.getAddress());
            } catch (AddressException e) {
                log.warn("Skipping invalid e-mail address in notification");
            }
        }
        return new ArrayList<>(out);
    }

    /** Subjects come partly from user input (task titles): no line breaks, bounded length. */
    static String safeSubject(String subject) {
        String flat = subject == null ? "" : subject.replaceAll("[\\r\\n\\t]+", " ").trim();
        return truncate(flat, MAX_SUBJECT);
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
