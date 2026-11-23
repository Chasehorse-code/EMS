package com.chasehorse.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Transactional e-mail settings ({@code chasehorse.mail.*} in application.yml).
 *
 * @param enabled     send queued e-mail through SMTP; when false, notifications only queue
 * @param fromAddress sender mailbox; must be the Zoho account (or an alias of it) in MAIL_USERNAME
 * @param fromName    display name shown to recipients
 * @param adminCc     operations admin mailbox copied on task and ticket notifications
 * @param appUrl      public web-app URL used for links in e-mails
 */
@ConfigurationProperties(prefix = "chasehorse.mail")
public record MailSettings(
    boolean enabled,
    String fromAddress,
    String fromName,
    String adminCc,
    String appUrl
) {
    public MailSettings {
        fromAddress = blankToDefault(fromAddress, "tech.support@chasehorse.com");
        fromName = blankToDefault(fromName, "ChaseHorse Support");
        adminCc = blankToDefault(adminCc, "ems.admin@chasehorse.com");
        appUrl = blankToDefault(appUrl, "http://localhost:5173").replaceAll("/+$", "");
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
