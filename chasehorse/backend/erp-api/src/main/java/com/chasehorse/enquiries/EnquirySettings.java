package com.chasehorse.enquiries;

import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * {@code chasehorse.enquiries.*} settings.
 *
 * @param alertTo                 internal mailbox alerted for every new enquiry
 * @param otpSecret               HMAC key for code hashes and verification tokens
 * @param noreplyAddress          sender (and SMTP login) of the one-time codes
 * @param noreplyName             display name for the code e-mails
 * @param noreplyPassword         Zoho app password for {@code noreplyAddress}
 * @param logCodesForDevelopment  local development only: log codes instead of failing when SMTP is off
 */
@ConfigurationProperties(prefix = "chasehorse.enquiries")
public record EnquirySettings(
    String alertTo,
    String otpSecret,
    String noreplyAddress,
    String noreplyName,
    String noreplyPassword,
    boolean logCodesForDevelopment
) {
    public EnquirySettings {
        alertTo = blank(alertTo) ? "shravan.vibhas@chasehorse.com" : alertTo.trim();
        noreplyAddress = blank(noreplyAddress) ? "noreply@chasehorse.com" : noreplyAddress.trim();
        noreplyName = blank(noreplyName) ? "ChaseHorse" : noreplyName.trim();
        if (blank(otpSecret) || otpSecret.length() < 32) {
            byte[] random = new byte[48];
            new SecureRandom().nextBytes(random);
            otpSecret = Base64.getEncoder().encodeToString(random);
            LoggerFactory.getLogger(EnquirySettings.class).warn(
                "ENQUIRY_OTP_SECRET is not set (or shorter than 32 characters): using a random per-process secret. "
                + "Verification codes and tokens will not survive a restart or work across several API instances.");
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
