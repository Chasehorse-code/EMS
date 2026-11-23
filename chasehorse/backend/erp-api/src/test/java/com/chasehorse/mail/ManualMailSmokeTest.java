package com.chasehorse.mail;

import com.chasehorse.enquiries.EnquiryEmails;
import com.chasehorse.enquiries.EnquiryFormType;
import com.chasehorse.enquiries.EnquirySettings;
import com.chasehorse.enquiries.SmtpOtpMailer;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;

/**
 * MANUAL check — sends one real e-mail of every kind through Zoho, all to a single test inbox.
 * Skipped in normal builds; runs only when MAIL_SMOKE_TO is set:
 *
 *   MAIL_SMOKE_TO=you@chasehorse.com mvn test -Dtest=ManualMailSmokeTest   (plus the MAIL_* / NOREPLY_* settings)
 *
 * Uses the production templates with sample data in the in-memory test database (nothing touches
 * the live database). Every message is re-addressed to MAIL_SMOKE_TO, CCs are dropped, and the
 * subject is prefixed with [TEST]; the would-be recipients are printed instead.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "MAIL_SMOKE_TO", matches = ".+@.+")
@Import({EmailOutbox.class, NotificationEmails.class, EnquiryEmails.class, ManualMailSmokeTest.Beans.class})
class ManualMailSmokeTest {

    @TestConfiguration
    static class Beans {
        @Bean MailSettings mailSettings() {
            return new MailSettings(true, env("MAIL_FROM", "tech.support@chasehorse.com"), env("MAIL_FROM_NAME", "ChaseHorse Support"),
                env("MAIL_ADMIN_CC", "ems.admin@chasehorse.com"), env("APP_PUBLIC_URL", "http://localhost:5173"));
        }
        @Bean EnquirySettings enquirySettings() {
            return new EnquirySettings(env("ENQUIRY_ALERT_TO", "alerts@example.invalid"), "x".repeat(48),
                env("NOREPLY_MAIL_USERNAME", "noreply@chasehorse.com"), env("NOREPLY_MAIL_FROM_NAME", "ChaseHorse"),
                System.getenv("NOREPLY_MAIL_PASSWORD"), false);
        }
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? fallback : v;
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired NotificationEmails notifications;
    @Autowired EnquiryEmails enquiryEmails;
    @Autowired MailSettings mailSettings;
    @Autowired EnquirySettings enquirySettings;

    @Test
    void sendOneOfEveryEmail() throws Exception {
        String to = System.getenv("MAIL_SMOKE_TO");

        // 1. Website-form verification code (noreply@, sent directly — not through the outbox)
        MailProperties props = new MailProperties();
        props.setHost(env("MAIL_HOST", "smtp.zoho.in"));
        props.setPort(Integer.parseInt(env("MAIL_PORT", "465")));
        props.getProperties().putAll(Map.of("mail.smtp.auth", "true", "mail.smtp.ssl.enable", "true"));
        new SmtpOtpMailer(enquirySettings, props, mailSettings).sendCode(to, "482913", 10);
        System.out.println("[smoke] SENT  OTP_CODE  from " + enquirySettings.noreplyAddress());

        // 2-4. Task accepted (worker + customer) and ticket raised — sample data in the test DB
        UUID manager = profile("Asha Rao (AP Ops Manager)", "ap.manager@example.invalid", null);
        jdbc.update("INSERT INTO app_role_assignments (user_id, role) VALUES (?, 'OPERATIONS')", manager);
        jdbc.update("INSERT INTO manager_areas (manager_id, state_code) VALUES (?, 'AP')", manager);
        UUID worker = profile("Ravi Kumar", "worker@example.invalid", null);
        jdbc.update("UPDATE app_profiles SET display_id = 'EMP042' WHERE id = ?", worker);
        UUID customer = profile("Priya Sharma", "customer@example.invalid", "Apex Retail Pvt Ltd");

        UUID task = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO tasks (id, display_id, title, status, state_code, created_by, assigned_to, customer_id,
                               location_area, location_address, due_at, reward_amount)
            VALUES (?, 'TSK-1042', 'Shelf audit — beverages aisle', 'IN_PROGRESS', 'AP', ?, ?, ?,
                    'Tenali', 'FreshMart, Main Road, Tenali', ?, ?)
            """, task, manager, worker, customer, OffsetDateTime.now(ZoneOffset.UTC).plusDays(1), new BigDecimal("450"));
        notifications.taskAccepted(task);

        UUID ticket = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO support_tickets (id, ticket_number, customer_id, related_task_id, subject, category, urgency, status, state_code)
            VALUES (?, 'TKT-1001', ?, ?, 'Photos for TSK-1042 look blurred', 'OPERATIONS', 'HIGH', 'OPEN', 'AP')
            """, ticket, customer, task);
        notifications.ticketRaised(ticket);

        // 5-6. Website enquiry: acknowledgement to the visitor + alert to the enquiry mailbox
        Map<String, String> details = new LinkedHashMap<>();
        details.put("Nearest service hub", "Hyderabad");
        details.put("Services", "CH Deploy, TMS");
        enquiryEmails.queue(new EnquiryEmails.Submitted(UUID.randomUUID(), "CH-ENQ-482913", EnquiryFormType.CONTACT,
            "Priya Sharma", "visitor@example.invalid", "+91 98450 12345", "Apex Retail Pvt Ltd", "Hyderabad",
            "Need 10 auditors in Hyderabad next week.", details, OffsetDateTime.now(ZoneOffset.UTC)));

        // Send every queued message (tech.support@) to the test inbox
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(props.getHost());
        sender.setPort(props.getPort());
        sender.setUsername(env("MAIL_USERNAME", mailSettings.fromAddress()));
        sender.setPassword(System.getenv("MAIL_PASSWORD"));
        sender.setDefaultEncoding("UTF-8");
        Properties javaMail = new Properties();
        javaMail.putAll(props.getProperties());
        sender.setJavaMailProperties(javaMail);

        var rows = jdbc.queryForList("SELECT template, to_addresses, cc_addresses, subject, body_text, body_html FROM email_outbox ORDER BY created_at");
        for (var row : rows) {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(new InternetAddress(mailSettings.fromAddress(), mailSettings.fromName(), "UTF-8"));
            helper.setTo(to);
            helper.setSubject("[TEST] " + row.get("SUBJECT"));
            helper.setText((String) row.get("BODY_TEXT"), (String) row.get("BODY_HTML"));
            sender.send(mime);
            System.out.println("[smoke] SENT  " + row.get("TEMPLATE") + "  (would go to: " + row.get("TO_ADDRESSES")
                + (row.get("CC_ADDRESSES") != null ? "  cc: " + row.get("CC_ADDRESSES") : "") + ")");
        }
        System.out.println("[smoke] DONE  " + (rows.size() + 1) + " e-mails sent to " + to);
    }

    private UUID profile(String name, String email, String company) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_profiles (id, display_name, email, company_name, state_code, account_status) VALUES (?, ?, ?, ?, 'AP', 'ACTIVE')",
            id, name, email, company);
        return id;
    }
}
