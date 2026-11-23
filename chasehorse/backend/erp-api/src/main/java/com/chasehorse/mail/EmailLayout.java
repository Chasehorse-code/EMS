package com.chasehorse.mail;

import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Map;

/**
 * The branded ChaseHorse e-mail layout (plain-text + HTML). Every dynamic value is HTML-escaped,
 * so user-entered text (names, messages, task titles) can never inject markup or links.
 */
public final class EmailLayout {
    private EmailLayout() {}

    public record Bodies(String text, String html) {}

    /**
     * @param facts      label → value rows shown as a table (insertion order kept)
     * @param ctaLabel   button text, or null for no button
     * @param ctaUrl     button link, or null
     * @param signature  e.g. "ChaseHorse Support · tech.support@chasehorse.com"
     * @param footerNote small print under the signature
     */
    public static Bodies render(String greeting, List<String> paragraphs, Map<String, String> facts,
                                String ctaLabel, String ctaUrl, String signature, String footerNote) {
        boolean hasCta = ctaLabel != null && ctaUrl != null;

        StringBuilder text = new StringBuilder(greeting).append("\n\n");
        paragraphs.forEach(p -> text.append(p).append("\n\n"));
        facts.forEach((k, v) -> text.append(k).append(": ").append(nz(v)).append('\n'));
        if (hasCta) text.append('\n').append(ctaLabel).append(": ").append(ctaUrl).append('\n');
        text.append("\n— ").append(signature).append('\n');

        StringBuilder rows = new StringBuilder();
        facts.forEach((k, v) -> rows.append("<tr><td style=\"padding:6px 16px 6px 0;color:#625E58;white-space:nowrap;vertical-align:top\">")
            .append(esc(k)).append("</td><td style=\"padding:6px 0;color:#171717;font-weight:600;white-space:pre-wrap\">")
            .append(esc(v)).append("</td></tr>"));

        StringBuilder html = new StringBuilder("""
            <!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:Arial,Helvetica,sans-serif;color:#171717">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA;padding:24px 12px">
            <tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="max-width:560px;background:#ffffff;border:1px solid #E2DED5;border-radius:12px">
            <tr><td style="padding:20px 24px;border-bottom:1px solid #E2DED5;font-weight:800;letter-spacing:2px">CHASEHORSE</td></tr>
            <tr><td style="padding:24px;font-size:14px;line-height:1.6">
            """);
        html.append("<p style=\"margin:0 0 16px\">").append(esc(greeting)).append("</p>");
        paragraphs.forEach(p -> html.append("<p style=\"margin:0 0 16px\">").append(esc(p)).append("</p>"));
        if (!facts.isEmpty()) {
            html.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:8px 0 20px;font-size:14px\">")
                .append(rows).append("</table>");
        }
        if (hasCta) {
            html.append("<a href=\"").append(esc(ctaUrl)).append("\" style=\"display:inline-block;background:#FF4D16;color:#ffffff;")
                .append("text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px\">").append(esc(ctaLabel)).append("</a>");
        }
        html.append("</td></tr><tr><td style=\"padding:16px 24px;border-top:1px solid #E2DED5;font-size:12px;color:#625E58\">")
            .append(esc(signature)).append("<br>").append(esc(footerNote)).append("</td></tr>")
            .append("</table></td></tr></table></body></html>");
        return new Bodies(text.toString(), html.toString());
    }

    public static String esc(String value) {
        return HtmlUtils.htmlEscape(nz(value), "UTF-8");
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }
}
