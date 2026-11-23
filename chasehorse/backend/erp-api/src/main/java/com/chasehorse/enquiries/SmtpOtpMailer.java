package com.chasehorse.enquiries;

import com.chasehorse.mail.EmailLayout;
import com.chasehorse.mail.MailSettings;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Properties;

/**
 * Sends verification codes from noreply@chasehorse.com through Zoho SMTP — synchronously, so the
 * visitor gets the code within seconds and an error immediately if it couldn't be sent.
 *
 * Uses the same SMTP host/port/TLS settings as {@code spring.mail} but its own login
 * ({@code NOREPLY_MAIL_USERNAME} / {@code NOREPLY_MAIL_PASSWORD}).
 */
@Component
public class SmtpOtpMailer implements OtpMailer {
    private static final Logger log = LoggerFactory.getLogger(SmtpOtpMailer.class);

    private final EnquirySettings settings;
    private final JavaMailSenderImpl sender;
    private final boolean configured;

    public SmtpOtpMailer(EnquirySettings settings, MailProperties mail, MailSettings mailSettings) {
        this.settings = settings;
        this.configured = mailSettings.enabled() && settings.noreplyPassword() != null && !settings.noreplyPassword().isBlank();

        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setHost(mail.getHost());
        if (mail.getPort() != null) impl.setPort(mail.getPort());
        impl.setProtocol(mail.getProtocol());
        impl.setUsername(settings.noreplyAddress());
        impl.setPassword(settings.noreplyPassword());
        impl.setDefaultEncoding("UTF-8");
        Properties props = new Properties();
        props.putAll(mail.getProperties());
        impl.setJavaMailProperties(props);
        this.sender = impl;

        if (!configured) {
            log.warn("Verification-code e-mail is not configured (MAIL_ENABLED / NOREPLY_MAIL_PASSWORD). "
                + (settings.logCodesForDevelopment()
                    ? "Codes will be written to this log (development mode)."
                    : "Website forms cannot verify e-mail addresses until it is."));
        }
    }

    @Override
    public void sendCode(String email, String code, int validMinutes) {
        if (!configured) {
            if (settings.logCodesForDevelopment()) {
                log.warn("[DEV ONLY] Verification code for {}: {}", email, code);
                return;
            }
            throw new OtpDeliveryException("E-mail verification is not configured on the server", null);
        }
        try {
            EmailLayout.Bodies body = EmailLayout.render(
                "Hello,",
                List.of("Use this code to verify your e-mail address on chasehorse.com:"),
                Map.of("Verification code", code, "Valid for", validMinutes + " minutes"),
                null, null,
                "ChaseHorse · " + settings.noreplyAddress(),
                "If you didn't request this code, you can ignore this e-mail. Never share it with anyone.");

            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(new InternetAddress(settings.noreplyAddress(), settings.noreplyName(), "UTF-8"));
            helper.setTo(email);
            helper.setSubject(code + " is your ChaseHorse verification code");
            helper.setText(body.text(), body.html());
            sender.send(mime);
        } catch (Exception e) {
            log.error("Could not send verification code e-mail: {}", e.getClass().getSimpleName());
            throw new OtpDeliveryException("Could not send the verification e-mail", e);
        }
    }
}
