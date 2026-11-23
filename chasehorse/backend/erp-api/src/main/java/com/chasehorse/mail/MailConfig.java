package com.chasehorse.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@EnableConfigurationProperties(MailSettings.class)
public class MailConfig {
    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    public MailConfig(MailSettings settings) {
        if (!settings.enabled()) {
            log.warn("Transactional e-mail is disabled (MAIL_ENABLED=false). Notifications are queued in "
                + "email_outbox but not sent until SMTP is configured.");
        }
    }
}
