package com.chasehorse.enquiries;

import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import com.chasehorse.mail.EmailOutbox;
import com.chasehorse.mail.MailSettings;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** End-to-end Enquiry Management flow on real SQL (H2, PostgreSQL mode). */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({
    EmailVerificationService.class, EnquiryService.class, EnquiryEmails.class, EmailOutbox.class, AuditService.class,
    EnquiryFlowIntegrationTest.Beans.class
})
class EnquiryFlowIntegrationTest {

    /** Captures codes instead of sending them. */
    static class CapturingMailer implements OtpMailer {
        final List<String[]> sent = new ArrayList<>();
        @Override public void sendCode(String email, String code, int validMinutes) { sent.add(new String[] { email, code }); }
        String lastCode() { return sent.get(sent.size() - 1)[1]; }
    }

    @TestConfiguration
    static class Beans {
        @Bean CapturingMailer otpMailer() { return new CapturingMailer(); }
        @Bean MailSettings mailSettings() {
            return new MailSettings(false, "tech.support@chasehorse.com", "ChaseHorse Support",
                "ems.admin@chasehorse.com", "https://app.example.test");
        }
        @Bean EnquirySettings enquirySettings() {
            return new EnquirySettings("alerts@chasehorse.example", "x".repeat(48), "noreply@chasehorse.com",
                "ChaseHorse", "", false);
        }
    }

    private static final String EMAIL = "Priya.Sharma@Example.com";

    @Autowired JdbcTemplate jdbc;
    @Autowired EmailVerificationService verification;
    @Autowired EnquiryService enquiries;
    @Autowired CapturingMailer mailer;

    UUID enquiryManager;

    @BeforeEach
    void seed() {
        mailer.sent.clear();
        enquiryManager = UUID.randomUUID();
        jdbc.update("INSERT INTO app_profiles (id, display_name, email, account_status) VALUES (?, 'Contact Desk', 'contact@chasehorse.com', 'ACTIVE')", enquiryManager);
        jdbc.update("INSERT INTO app_role_assignments (user_id, role) VALUES (?, 'ENQUIRY_MANAGER')", enquiryManager);
    }

    // ---------------------------------------------------------------- verification

    @Test
    @DisplayName("A 6-digit code is e-mailed and only its hash is stored")
    void codeIsSentAndHashed() {
        var sent = verification.requestCode(EMAIL, "client-a");

        assertThat(sent.email()).isEqualTo("priya.sharma@example.com");
        assertThat(mailer.sent).hasSize(1);
        String code = mailer.lastCode();
        assertThat(code).matches("\\d{6}");
        String stored = jdbc.queryForObject("SELECT code_hash FROM enquiry_email_otps WHERE email = ?", String.class, sent.email());
        assertThat(stored).doesNotContain(code).hasSize(64);
    }

    @Test
    @DisplayName("Requesting another code within a minute is refused")
    void resendCooldown() {
        verification.requestCode(EMAIL, "client-a");
        ApiException ex = assertThrows(ApiException.class, () -> verification.requestCode(EMAIL, "client-a"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
    }

    @Test
    @DisplayName("Wrong codes count down and lock after 5 attempts; then even the right code is refused")
    void wrongCodesLockOut() {
        verification.requestCode(EMAIL, "client-a");
        String right = mailer.lastCode();
        String wrong = right.equals("000000") ? "111111" : "000000";

        ApiException first = assertThrows(ApiException.class, () -> verification.verifyCode(EMAIL, wrong));
        assertThat(first.getMessage()).contains("4 attempts left");
        for (int i = 0; i < 4; i++) assertThrows(ApiException.class, () -> verification.verifyCode(EMAIL, wrong));

        ApiException locked = assertThrows(ApiException.class, () -> verification.verifyCode(EMAIL, right));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, locked.getStatus());
    }

    @Test
    @DisplayName("Submitting without a token, or with a token for another address, is refused")
    void submitRequiresMatchingToken() {
        ApiException none = assertThrows(ApiException.class, () -> enquiries.submit(command(EMAIL, null), "c", "ua"));
        assertEquals(HttpStatus.FORBIDDEN, none.getStatus());

        String token = verifiedToken("someone.else@example.com");
        ApiException other = assertThrows(ApiException.class, () -> enquiries.submit(command(EMAIL, token), "c", "ua"));
        assertEquals(HttpStatus.FORBIDDEN, other.getStatus());

        ApiException forged = assertThrows(ApiException.class,
            () -> enquiries.submit(command(EMAIL, token.substring(0, token.length() - 4) + "AAAA"), "c", "ua"));
        assertEquals(HttpStatus.FORBIDDEN, forged.getStatus());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM enquiries", Integer.class)).isZero();
    }

    // ---------------------------------------------------------------- submission

    @Test
    @DisplayName("A verified submission is stored, notifies staff, and queues the acknowledgement and the alert")
    void submissionStoredNotifiedAndEmailed() {
        var receipt = enquiries.submit(command(EMAIL, verifiedToken(EMAIL)), "client-a", "JUnit");

        assertThat(receipt.reference()).matches("CH-ENQ-\\d{6}");
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM enquiries WHERE reference = ?", receipt.reference());
        assertThat(row.get("EMAIL")).isEqualTo("priya.sharma@example.com");
        assertThat(row.get("STATUS")).isEqualTo("NEW");
        assertThat((String) row.get("DETAILS")).contains("Nearest hub").contains("Hyderabad");

        // Bell notification for the enquiry manager
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'ENQUIRY'",
            Integer.class, enquiryManager)).isEqualTo(1);

        // Acknowledgement to the visitor, alert to the internal mailbox, both from tech.support@
        Map<String, Object> ack = jdbc.queryForMap("SELECT * FROM email_outbox WHERE template = 'ENQUIRY_ACK'");
        assertThat(ack.get("TO_ADDRESSES")).isEqualTo("priya.sharma@example.com");
        assertThat(ack.get("FROM_ADDRESS")).isEqualTo("tech.support@chasehorse.com");
        assertThat((String) ack.get("BODY_TEXT")).contains("reach you shortly").contains(receipt.reference()).contains("Hyderabad");

        Map<String, Object> alert = jdbc.queryForMap("SELECT * FROM email_outbox WHERE template = 'ENQUIRY_ALERT'");
        assertThat(alert.get("TO_ADDRESSES")).isEqualTo("alerts@chasehorse.example");
        // Visitor-supplied markup is escaped in the HTML e-mail
        assertThat((String) alert.get("BODY_HTML")).contains("&lt;script&gt;").doesNotContain("<script>");
    }

    @Test
    @DisplayName("A double-clicked submission returns the first receipt instead of a duplicate")
    void duplicateSubmissionIsIgnored() {
        String token = verifiedToken(EMAIL);
        var first = enquiries.submit(command(EMAIL, token), "c", "ua");
        var second = enquiries.submit(command(EMAIL, token), "c", "ua");

        assertThat(second.reference()).isEqualTo(first.reference());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM enquiries", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("Oversized or oddly-named form fields are rejected")
    void detailsAreValidated() {
        Map<String, Object> badKey = Map.of("<img src=x>", "v");
        ApiException ex = assertThrows(ApiException.class, () -> EnquiryService.cleanDetails(badKey));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());

        Map<String, Object> tooLong = Map.of("Notes", "x".repeat(5000));
        assertThrows(ApiException.class, () -> EnquiryService.cleanDetails(tooLong));
    }

    // ---------------------------------------------------------------- dashboard

    @Test
    @DisplayName("Moving out of NEW records the first response time and an event; list filters and search work")
    void workflowAndListing() {
        var receipt = enquiries.submit(command(EMAIL, verifiedToken(EMAIL)), "c", "ua");
        UUID id = jdbc.queryForObject("SELECT id FROM enquiries WHERE reference = ?", UUID.class, receipt.reference());

        var detail = enquiries.updateStatus(id, "in_progress", "Called back", enquiryManager);

        assertThat(detail.enquiry().status()).isEqualTo("IN_PROGRESS");
        assertThat(detail.firstResponseAt()).isNotNull();
        assertThat(detail.events()).extracting(EnquiryService.EventView::eventType).containsExactly("CREATED", "STATUS_CHANGED");
        assertThat(detail.events().get(1).actorName()).isEqualTo("Contact Desk");

        var filters = new EnquiryService.Filters("IN_PROGRESS", "CONTACT", "priya", null, null);
        assertThat(enquiries.list(filters, 0, 25).total()).isEqualTo(1);
        assertThat(enquiries.list(new EnquiryService.Filters("NEW", null, null, null, null), 0, 25).total()).isZero();
        assertThat(enquiries.summary().inProgress()).isEqualTo(1);
    }

    @Test
    @DisplayName("CSV export neutralises spreadsheet formulas")
    void csvIsFormulaSafe() {
        assertThat(EnquiryService.cell("=HYPERLINK(\"http://evil\")")).isEqualTo("\"'=HYPERLINK(\"\"http://evil\"\")\"");
        assertThat(EnquiryService.cell("Plain")).isEqualTo("\"Plain\"");
    }

    // ---------------------------------------------------------------- helpers

    private String verifiedToken(String email) {
        verification.requestCode(email, "client-" + email);
        return verification.verifyCode(email, mailer.lastCode()).token();
    }

    private static EnquiryService.SubmitCommand command(String email, String token) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("Nearest hub", "Hyderabad");
        details.put("Services", List.of("CH Deploy", "TMS"));
        return new EnquiryService.SubmitCommand("contact", "/contact", "Priya Sharma", email, "+91 98450 12345",
            "Apex Retail", "Hyderabad", "Need 20 auditors <script>alert(1)</script>", details, token);
    }
}
