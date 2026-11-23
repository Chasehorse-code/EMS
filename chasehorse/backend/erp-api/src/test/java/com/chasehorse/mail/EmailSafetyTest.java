package com.chasehorse.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class EmailSafetyTest {

    @Test
    @DisplayName("Recipients are validated, lower-cased, de-duplicated and the To address removed from CC")
    void cleansRecipients() {
        List<String> cc = EmailOutbox.cleanAddresses(
            Arrays.asList("Ops.Manager@ChaseHorse.com", "ops.manager@chasehorse.com", "not an address",
                "worker@example.com", null, "  ", "evil@example.com\r\nBcc: victim@example.com"),
            Set.of("worker@example.com"));

        assertThat(cc).containsExactly("ops.manager@chasehorse.com");
    }

    @Test
    @DisplayName("Subjects cannot carry header line breaks and are length-limited")
    void subjectIsSanitised() {
        String subject = EmailOutbox.safeSubject("Task TSK-1 confirmed\r\nBcc: victim@example.com");
        assertThat(subject).doesNotContain("\r").doesNotContain("\n");

        assertThat(EmailOutbox.safeSubject("x".repeat(500))).hasSize(200);
    }

    @Test
    @DisplayName("Retry back-off grows 1, 2, 4, 8, 16 minutes and then stays capped")
    void backoffIsBounded() {
        assertThat(EmailDispatcher.backoff(1)).isEqualTo(Duration.ofMinutes(1));
        assertThat(EmailDispatcher.backoff(3)).isEqualTo(Duration.ofMinutes(4));
        assertThat(EmailDispatcher.backoff(5)).isEqualTo(Duration.ofMinutes(16));
        assertThat(EmailDispatcher.backoff(50)).isEqualTo(Duration.ofMinutes(16));
    }
}
