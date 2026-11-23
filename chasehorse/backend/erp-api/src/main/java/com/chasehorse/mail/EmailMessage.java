package com.chasehorse.mail;

import java.util.List;

/**
 * A rendered e-mail ready to queue.
 *
 * @param template  short template name, kept for diagnostics (e.g. "TASK_ACCEPTED_WORKER")
 * @param dedupeKey unique per logical notification; queuing the same key twice sends once
 */
public record EmailMessage(
    String template,
    String dedupeKey,
    List<String> to,
    List<String> cc,
    String subject,
    String textBody,
    String htmlBody
) {
    public EmailMessage {
        to = to == null ? List.of() : List.copyOf(to);
        cc = cc == null ? List.of() : List.copyOf(cc);
    }
}
