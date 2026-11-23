package com.chasehorse.enquiries;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public (no login) endpoints used by the website forms. Protected by e-mail verification, rate
 * limits and payload validation rather than authentication.
 */
@RestController
@RequestMapping("/api/v1/public/enquiries")
public class PublicEnquiryController {
    private final EmailVerificationService verification;
    private final EnquiryService enquiries;

    public PublicEnquiryController(EmailVerificationService verification, EnquiryService enquiries) {
        this.verification = verification;
        this.enquiries = enquiries;
    }

    public record CodeRequest(@NotBlank @Size(max = 320) String email) {}

    public record VerifyRequest(@NotBlank @Size(max = 320) String email, @NotBlank @Size(max = 12) String code) {}

    public record SubmitRequest(
        @NotBlank @Size(max = 40) String formType,
        @Size(max = 300) String sourcePage,
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 320) String email,
        @Size(max = 30) String phone,
        @Size(max = 200) String company,
        @Size(max = 120) String city,
        @Size(max = 5000) String message,
        Map<String, Object> details,
        @NotBlank @Size(max = 1000) String verificationToken
    ) {}

    @PostMapping("/email-code")
    public EmailVerificationService.CodeSent requestCode(@Valid @RequestBody CodeRequest body, HttpServletRequest request) {
        return verification.requestCode(body.email(), verification.clientHash(clientAddress(request)));
    }

    @PostMapping("/email-code/verify")
    public EmailVerificationService.Verified verify(@Valid @RequestBody VerifyRequest body) {
        return verification.verifyCode(body.email(), body.code());
    }

    @PostMapping
    public EnquiryService.Receipt submit(@Valid @RequestBody SubmitRequest body, HttpServletRequest request) {
        return enquiries.submit(new EnquiryService.SubmitCommand(
                body.formType(), body.sourcePage(), body.name(), body.email(), body.phone(), body.company(),
                body.city(), body.message(), body.details(), body.verificationToken()),
            verification.clientHash(clientAddress(request)),
            request.getHeader("User-Agent"));
    }

    /**
     * Client address for rate limiting. Behind a reverse proxy the socket address is the proxy, so
     * the first X-Forwarded-For hop is used when present. It can be spoofed, which only weakens the
     * per-visitor limit; the per-address limits and code checks still apply.
     */
    static String clientAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty() && first.length() <= 64) return first;
        }
        return request.getRemoteAddr();
    }
}
