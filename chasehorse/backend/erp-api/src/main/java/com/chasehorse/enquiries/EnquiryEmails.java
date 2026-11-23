package com.chasehorse.enquiries;

import com.chasehorse.mail.EmailLayout;
import com.chasehorse.mail.EmailMessage;
import com.chasehorse.mail.EmailOutbox;
import com.chasehorse.mail.MailSettings;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The two e-mails for a new enquiry, both from tech.support@ and queued in the outbox:
 * a professional acknowledgement to the visitor with a copy of what they sent, and an alert with
 * the full details to the internal enquiry mailbox.
 */
@Service
public class EnquiryEmails {
    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.ENGLISH);
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final int MAX_FACTS = 60;

    private final EmailOutbox outbox;
    private final MailSettings mail;
    private final EnquirySettings settings;

    public EnquiryEmails(EmailOutbox outbox, MailSettings mail, EnquirySettings settings) {
        this.outbox = outbox;
        this.mail = mail;
        this.settings = settings;
    }

    public record Submitted(UUID id, String reference, EnquiryFormType formType, String name, String email,
                            String phone, String company, String city, String message,
                            Map<String, String> details, OffsetDateTime createdAt) {}

    public void queue(Submitted e) {
        Map<String, String> summary = new LinkedHashMap<>();
        summary.put("Reference", e.reference());
        summary.put("Request", e.formType().label());
        summary.put("Name", e.name());
        summary.put("E-mail", e.email() + " (verified)");
        if (notBlank(e.phone())) summary.put("Phone", e.phone());
        if (notBlank(e.company())) summary.put("Company", e.company());
        if (notBlank(e.city())) summary.put("City", e.city());
        if (notBlank(e.message())) summary.put("Message", e.message());
        summary.put("Received", WHEN.format(e.createdAt().atZoneSameInstant(IST)) + " IST");

        Map<String, String> all = new LinkedHashMap<>(summary);
        int extra = 0;
        for (var field : e.details().entrySet()) {
            if (extra++ >= MAX_FACTS) break;
            all.putIfAbsent(field.getKey(), field.getValue());
        }

        // 1. Acknowledgement to the visitor
        EmailLayout.Bodies ack = EmailLayout.render(
            "Dear " + e.name() + ",",
            List.of(
                "Thank you for contacting ChaseHorse. We have received your " + e.formType().label().toLowerCase(Locale.ROOT)
                    + " and a member of our team will reach you shortly, usually within one business day.",
                "For your records, here is a copy of the details you submitted. Please quote your reference "
                    + e.reference() + " if you get in touch with us."),
            all, null, null,
            "ChaseHorse Support · " + mail.fromAddress(),
            "You are receiving this because this address was verified on a chasehorse.com form. "
                + "Reply to this e-mail if anything above needs correcting.");
        outbox.enqueue(new EmailMessage("ENQUIRY_ACK", "enquiry-ack:" + e.id(), List.of(e.email()), List.of(),
            "We've received your request — " + e.reference(), ack.text(), ack.html()));

        // 2. Internal alert
        EmailLayout.Bodies alert = EmailLayout.render(
            "New website enquiry: " + e.formType().label(),
            List.of("A new enquiry was submitted on chasehorse.com. The sender's e-mail address was verified with a one-time code."),
            all, "Open in Enquiry Management", mail.appUrl() + "/enquiries?open=" + e.id(),
            "ChaseHorse Enquiry Management · " + mail.fromAddress(),
            "Internal notification. Contains the visitor's personal details — do not forward outside ChaseHorse.");
        outbox.enqueue(new EmailMessage("ENQUIRY_ALERT", "enquiry-alert:" + e.id(), List.of(settings.alertTo()), List.of(),
            "[" + e.reference() + "] New " + e.formType().label() + " from " + e.name()
                + (notBlank(e.company()) ? " (" + e.company() + ")" : ""),
            alert.text(), alert.html()));
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
