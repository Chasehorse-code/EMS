package com.chasehorse.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.UnsupportedEncodingException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * Sends queued e-mail from {@code email_outbox} through SMTP (Zoho).
 *
 * <p>Each row is claimed with a conditional UPDATE before sending, so several API instances can
 * run this safely. Failures retry with back-off; messages older than {@link #EXPIRY} are dropped
 * rather than sent late (e.g. after SMTP was misconfigured for days).
 */
@Component
@ConditionalOnProperty(prefix = "chasehorse.mail", name = "enabled", havingValue = "true")
public class EmailDispatcher {
    private static final Logger log = LoggerFactory.getLogger(EmailDispatcher.class);
    static final int MAX_ATTEMPTS = 6;
    private static final int BATCH_SIZE = 20;
    private static final Duration LEASE = Duration.ofMinutes(5);
    private static final Duration EXPIRY = Duration.ofHours(48);

    private final JdbcTemplate jdbc;
    private final JavaMailSender mailSender;
    private final MailSettings settings;

    public EmailDispatcher(JdbcTemplate jdbc, JavaMailSender mailSender, MailSettings settings) {
        this.jdbc = jdbc;
        this.mailSender = mailSender;
        this.settings = settings;
        log.info("E-mail dispatcher enabled; sending as {}", settings.fromAddress());
    }

    private record Pending(UUID id, String to, String cc, String subject, String text, String html,
                           int attempts, OffsetDateTime createdAt) {}

    @Scheduled(initialDelayString = "PT15S", fixedDelayString = "PT30S")
    public void dispatchDue() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<Pending> due = jdbc.query("""
            SELECT id, to_addresses, cc_addresses, subject, body_text, body_html, attempts, created_at
            FROM email_outbox
            WHERE status = 'PENDING' AND next_attempt_at <= ?
            ORDER BY created_at
            LIMIT ?
            """,
            (rs, n) -> new Pending(
                rs.getObject("id", UUID.class), rs.getString("to_addresses"), rs.getString("cc_addresses"),
                rs.getString("subject"), rs.getString("body_text"), rs.getString("body_html"),
                rs.getInt("attempts"), rs.getObject("created_at", OffsetDateTime.class)),
            now, BATCH_SIZE);

        for (Pending message : due) {
            if (message.createdAt() != null && message.createdAt().isBefore(now.minus(EXPIRY))) {
                markFailed(message.id(), "Expired before it could be sent");
                continue;
            }
            // Claim: push next_attempt_at forward. Another instance that already claimed it wins.
            int claimed = jdbc.update("""
                UPDATE email_outbox SET attempts = attempts + 1, next_attempt_at = ?
                WHERE id = ? AND status = 'PENDING' AND next_attempt_at <= ?
                """, now.plus(LEASE), message.id(), now);
            if (claimed == 0) continue;
            send(message, message.attempts() + 1);
        }
    }

    private void send(Pending message, int attempt) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(new InternetAddress(settings.fromAddress(), settings.fromName(), "UTF-8"));
            helper.setTo(message.to().split(","));
            if (message.cc() != null && !message.cc().isBlank()) helper.setCc(message.cc().split(","));
            helper.setSubject(message.subject());
            helper.setText(message.text(), message.html());
            mailSender.send(mime);

            jdbc.update("UPDATE email_outbox SET status = 'SENT', sent_at = ?, last_error = NULL WHERE id = ?",
                OffsetDateTime.now(ZoneOffset.UTC), message.id());
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            String error = e.getClass().getSimpleName() + ": " + String.valueOf(e.getMessage());
            if (attempt >= MAX_ATTEMPTS) {
                markFailed(message.id(), error);
                log.error("E-mail {} failed permanently after {} attempts: {}", message.id(), attempt, error);
            } else {
                jdbc.update("UPDATE email_outbox SET next_attempt_at = ?, last_error = ? WHERE id = ?",
                    OffsetDateTime.now(ZoneOffset.UTC).plus(backoff(attempt)), truncate(error), message.id());
                log.warn("E-mail {} attempt {} failed, will retry: {}", message.id(), attempt, error);
            }
        }
    }

    /** 1, 2, 4, 8, 16 minutes. */
    static Duration backoff(int attempt) {
        return Duration.ofMinutes(1L << Math.max(0, Math.min(attempt - 1, 4)));
    }

    private void markFailed(UUID id, String error) {
        jdbc.update("UPDATE email_outbox SET status = 'FAILED', last_error = ? WHERE id = ?", truncate(error), id);
    }

    private static String truncate(String value) {
        return value.length() <= 1000 ? value : value.substring(0, 1000);
    }
}
