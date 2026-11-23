package com.chasehorse.enquiries;

import com.chasehorse.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * E-mail ownership check for public website forms (no account is created).
 *
 * <ol>
 *   <li>{@link #requestCode}: a 6-digit code is e-mailed from noreply@; only an HMAC of it is stored.</li>
 *   <li>{@link #verifyCode}: the right code returns a signed token (valid {@link #TOKEN_TTL}).</li>
 *   <li>{@link #requireVerifiedEmail}: a form submission must carry that token for the same address.</li>
 * </ol>
 *
 * Abuse limits (stored in the database, so they hold across API instances): one code per address
 * per minute, {@value #MAX_CODES_PER_EMAIL_PER_HOUR} per address per hour,
 * {@value #MAX_CODES_PER_CLIENT_PER_HOUR} per visitor per hour, {@value #MAX_ATTEMPTS} guesses per code.
 */
@Service
public class EmailVerificationService {
    static final int CODE_VALID_MINUTES = 10;
    static final int MAX_ATTEMPTS = 5;
    static final int MAX_CODES_PER_EMAIL_PER_HOUR = 5;
    static final int MAX_CODES_PER_CLIENT_PER_HOUR = 20;
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    static final Duration TOKEN_TTL = Duration.ofMinutes(60);

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]{1,64}@[^\\s@]{1,190}\\.[^\\s@]{2,63}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final OtpMailer mailer;
    private final byte[] secret;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public EmailVerificationService(JdbcTemplate jdbc, OtpMailer mailer, EnquirySettings settings) {
        this(jdbc, mailer, settings, Clock.systemUTC());
    }

    EmailVerificationService(JdbcTemplate jdbc, OtpMailer mailer, EnquirySettings settings, Clock clock) {
        this.jdbc = jdbc;
        this.mailer = mailer;
        this.secret = settings.otpSecret().getBytes(StandardCharsets.UTF_8);
        this.clock = clock;
    }

    public record CodeSent(String email, int validMinutes, int resendAfterSeconds) {}

    public record Verified(String email, String token, OffsetDateTime expiresAt) {}

    // ------------------------------------------------------------------ 1. request

    @Transactional
    public CodeSent requestCode(String rawEmail, String clientHash) {
        String email = normaliseEmail(rawEmail);
        OffsetDateTime now = now();

        Integer recentForEmail = jdbc.queryForObject(
            "SELECT COUNT(*) FROM enquiry_email_otps WHERE email = ? AND created_at > ?",
            Integer.class, email, now.minusHours(1));
        if (recentForEmail != null && recentForEmail >= MAX_CODES_PER_EMAIL_PER_HOUR) {
            throw tooMany("Too many codes requested for this address. Please try again in an hour.");
        }
        Integer lastMinute = jdbc.queryForObject(
            "SELECT COUNT(*) FROM enquiry_email_otps WHERE email = ? AND created_at > ?",
            Integer.class, email, now.minus(RESEND_COOLDOWN));
        if (lastMinute != null && lastMinute > 0) {
            throw tooMany("A code was just sent. Please wait a minute before requesting another.");
        }
        if (clientHash != null) {
            Integer recentForClient = jdbc.queryForObject(
                "SELECT COUNT(*) FROM enquiry_email_otps WHERE client_ip_hash = ? AND created_at > ?",
                Integer.class, clientHash, now.minusHours(1));
            if (recentForClient != null && recentForClient >= MAX_CODES_PER_CLIENT_PER_HOUR) {
                throw tooMany("Too many verification requests from your network. Please try again later.");
            }
        }

        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        jdbc.update("""
            INSERT INTO enquiry_email_otps (id, email, code_hash, expires_at, client_ip_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, UUID.randomUUID(), email, hashCode(email, code), now.plusMinutes(CODE_VALID_MINUTES), clientHash, now);

        try {
            mailer.sendCode(email, code, CODE_VALID_MINUTES);
        } catch (OtpMailer.OtpDeliveryException e) {
            // Rolls back the insert, so a failed send doesn't count against the visitor's limits.
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "We couldn't send the verification e-mail right now. Please try again shortly.");
        }
        return new CodeSent(email, CODE_VALID_MINUTES, (int) RESEND_COOLDOWN.toSeconds());
    }

    // ------------------------------------------------------------------ 2. verify

    private record OtpRow(UUID id, String codeHash, int attempts, OffsetDateTime expiresAt) {}

    @Transactional(noRollbackFor = ApiException.class)
    public Verified verifyCode(String rawEmail, String rawCode) {
        String email = normaliseEmail(rawEmail);
        String code = rawCode == null ? "" : rawCode.replaceAll("\\s", "");
        if (!code.matches("\\d{6}")) {
            throw ApiException.badRequest("Enter the 6-digit code from the e-mail.");
        }
        OffsetDateTime now = now();

        OtpRow row = jdbc.query("""
            SELECT id, code_hash, attempts, expires_at FROM enquiry_email_otps
            WHERE email = ? AND consumed_at IS NULL
            ORDER BY created_at DESC LIMIT 1
            """,
            (rs, n) -> new OtpRow(rs.getObject("id", UUID.class), rs.getString("code_hash"),
                rs.getInt("attempts"), rs.getObject("expires_at", OffsetDateTime.class)),
            email).stream().findFirst().orElse(null);

        if (row == null || row.expiresAt().isBefore(now)) {
            throw ApiException.badRequest("This code has expired. Please request a new one.");
        }
        if (row.attempts() >= MAX_ATTEMPTS) {
            throw tooMany("Too many incorrect attempts. Please request a new code.");
        }
        boolean matches = MessageDigest.isEqual(
            row.codeHash().getBytes(StandardCharsets.US_ASCII),
            hashCode(email, code).getBytes(StandardCharsets.US_ASCII));
        if (!matches) {
            jdbc.update("UPDATE enquiry_email_otps SET attempts = attempts + 1 WHERE id = ?", row.id());
            int left = MAX_ATTEMPTS - row.attempts() - 1;
            throw ApiException.badRequest(left > 0
                ? "That code is incorrect. " + left + (left == 1 ? " attempt" : " attempts") + " left."
                : "That code is incorrect. Please request a new code.");
        }
        jdbc.update("UPDATE enquiry_email_otps SET consumed_at = ? WHERE id = ?", now, row.id());

        OffsetDateTime expires = now.plus(TOKEN_TTL);
        return new Verified(email, issueToken(email, expires), expires);
    }

    // ------------------------------------------------------------------ 3. use

    /** @return the verified, normalised e-mail. Throws 403 if the token is missing, forged, expired or for another address. */
    public String requireVerifiedEmail(String token, String rawEmail) {
        String email = normaliseEmail(rawEmail);
        String tokenEmail = readToken(token);
        if (tokenEmail == null || !tokenEmail.equals(email)) {
            throw ApiException.forbidden("Please verify your e-mail address with the code we send you before submitting.");
        }
        return email;
    }

    // ------------------------------------------------------------------ helpers

    static String normaliseEmail(String raw) {
        String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 320 || !EMAIL.matcher(email).matches()) {
            throw ApiException.badRequest("Enter a valid e-mail address.");
        }
        return email;
    }

    private String hashCode(String email, String code) {
        return HexFormat.of().formatHex(hmac("otp|" + email + "|" + code));
    }

    /** token = base64url(email|expiryEpochSeconds) + "." + base64url(hmac) */
    private String issueToken(String email, OffsetDateTime expires) {
        String payload = email + "|" + expires.toEpochSecond();
        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        return b64.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + "." + b64.encodeToString(hmac("token|" + payload));
    }

    private String readToken(String token) {
        if (token == null || token.length() > 1000) return null;
        int dot = token.indexOf('.');
        if (dot <= 0) return null;
        try {
            Base64.Decoder b64 = Base64.getUrlDecoder();
            String payload = new String(b64.decode(token.substring(0, dot)), StandardCharsets.UTF_8);
            byte[] signature = b64.decode(token.substring(dot + 1));
            if (!MessageDigest.isEqual(signature, hmac("token|" + payload))) return null;
            int bar = payload.lastIndexOf('|');
            long expiry = Long.parseLong(payload.substring(bar + 1));
            if (now().toEpochSecond() > expiry) return null;
            return payload.substring(0, bar);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private byte[] hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }

    /** One-way hash of the client address, so limits work without storing IPs. */
    public String clientHash(String clientAddress) {
        if (clientAddress == null || clientAddress.isBlank()) return null;
        return HexFormat.of().formatHex(hmac("client|" + clientAddress.trim())).substring(0, 32);
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static ApiException tooMany(String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, message);
    }
}
