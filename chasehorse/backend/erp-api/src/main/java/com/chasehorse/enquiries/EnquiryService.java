package com.chasehorse.enquiries;

import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/** Stores website enquiries and runs the Enquiry Management workflow. */
@Service
public class EnquiryService {
    public static final Set<String> STATUSES = Set.of("NEW", "IN_PROGRESS", "CONTACTED", "CLOSED", "SPAM");
    static final List<String> STAFF_ROLES = List.of("ENQUIRY_MANAGER", "ADMIN");

    private static final int MAX_DETAIL_FIELDS = 80;
    private static final int MAX_VALUE_LENGTH = 4000;
    private static final int MAX_LIST_ITEMS = 40;
    private static final Duration DUPLICATE_WINDOW = Duration.ofMinutes(2);
    private static final Pattern FIELD_NAME = Pattern.compile("^[A-Za-z][A-Za-z0-9 _()/&.,'-]{0,59}$");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final EmailVerificationService verification;
    private final EnquiryEmails emails;
    private final AuditService audit;

    public EnquiryService(JdbcTemplate jdbc, EmailVerificationService verification, EnquiryEmails emails, AuditService audit) {
        this.jdbc = jdbc;
        this.verification = verification;
        this.emails = emails;
        this.audit = audit;
    }

    // ================================================================ public submission

    public record SubmitCommand(
        String formType, String sourcePage, String name, String email, String phone, String company,
        String city, String message, Map<String, Object> details, String verificationToken
    ) {}

    public record Receipt(String reference, String formLabel, OffsetDateTime receivedAt) {}

    @Transactional
    public Receipt submit(SubmitCommand cmd, String clientHash, String userAgent) {
        EnquiryFormType type = EnquiryFormType.parse(cmd.formType());
        String email = verification.requireVerifiedEmail(cmd.verificationToken(), cmd.email());

        String name = required(cmd.name(), "Name", 2, 160);
        String phone = optional(cmd.phone(), "Phone", 30);
        if (phone != null && !phone.matches("^[+0-9 ()-]{6,30}$")) throw ApiException.badRequest("Enter a valid phone number.");
        String company = optional(cmd.company(), "Company", 200);
        String city = optional(cmd.city(), "City", 120);
        String message = optional(cmd.message(), "Message", 5000);
        String sourcePage = optional(cmd.sourcePage(), "Source page", 300);
        Map<String, String> details = cleanDetails(cmd.details());
        String detailsJson = toJson(details);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        // Double-click / retry protection: the same form from the same verified address with the
        // same content within two minutes returns the original receipt.
        var duplicate = jdbc.query("""
            SELECT reference, created_at FROM enquiries
            WHERE lower(email) = ? AND form_type = ? AND details = ? AND created_at > ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (rs, n) -> new Receipt(rs.getString("reference"), type.label(), rs.getObject("created_at", OffsetDateTime.class)),
            email, type.name(), detailsJson, now.minus(DUPLICATE_WINDOW));
        if (!duplicate.isEmpty()) return duplicate.get(0);

        UUID id = UUID.randomUUID();
        String reference = newReference();
        jdbc.update("""
            INSERT INTO enquiries (id, reference, form_type, source_page, name, email, phone, company, city, message,
                                   details, email_verified_at, status, client_ip_hash, user_agent, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?)
            """,
            id, reference, type.name(), sourcePage, name, email, phone, company, city, message,
            detailsJson, now, clientHash, truncate(userAgent, 300), now, now);
        jdbc.update("""
            INSERT INTO enquiry_events (id, enquiry_id, event_type, new_value, note, created_at)
            VALUES (?, ?, 'CREATED', 'NEW', ?, ?)
            """, UUID.randomUUID(), id, "Submitted via " + type.label(), now);

        notifyStaff(id, reference, type, name, company);
        emails.queue(new EnquiryEmails.Submitted(id, reference, type, name, email, phone, company, city, message, details, now));

        return new Receipt(reference, type.label(), now);
    }

    /** In-app notification (bell) for every active enquiry manager and admin. */
    private void notifyStaff(UUID enquiryId, String reference, EnquiryFormType type, String name, String company) {
        List<UUID> staff = jdbc.query("""
            SELECT DISTINCT p.id FROM app_profiles p
            JOIN app_role_assignments r ON r.user_id = p.id
            WHERE p.account_status = 'ACTIVE' AND r.role IN ('ENQUIRY_MANAGER', 'ADMIN')
            """, (rs, n) -> rs.getObject("id", UUID.class));
        String title = "New enquiry " + reference;
        String body = type.label() + " from " + name + (company != null ? " (" + company + ")" : "");
        for (UUID userId : staff) {
            jdbc.update("""
                INSERT INTO notifications (id, user_id, title, body, type, entity_type, entity_id)
                VALUES (?, ?, ?, ?, 'ENQUIRY', 'ENQUIRY', ?)
                """, UUID.randomUUID(), userId, title, truncate(body, 1000), enquiryId);
        }
    }

    // ================================================================ dashboard

    public record EnquiryRow(UUID id, String reference, String formType, String formLabel, String name, String email,
                             String phone, String company, String city, String status, UUID assignedTo,
                             String assigneeName, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}

    public record Page(List<EnquiryRow> items, long total, int page, int size) {}

    public record EventView(String eventType, String actorName, String oldValue, String newValue, String note,
                            OffsetDateTime createdAt) {}

    public record EnquiryDetail(EnquiryRow enquiry, String sourcePage, String message, Map<String, String> details,
                                OffsetDateTime emailVerifiedAt, OffsetDateTime firstResponseAt, List<EventView> events) {}

    public record Filters(String status, String formType, String search, OffsetDateTime from, OffsetDateTime to) {}

    private static final String ROW_COLUMNS = """
        e.id, e.reference, e.form_type, e.name, e.email, e.phone, e.company, e.city, e.status, e.assigned_to,
        a.display_name AS assignee_name, e.created_at, e.updated_at
        """;

    public Page list(Filters filters, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        List<Object> params = new ArrayList<>();
        String where = whereClause(filters, params);

        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM enquiries e" + where, Long.class, params.toArray());
        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(safeSize);
        pageParams.add(safePage * safeSize);
        List<EnquiryRow> rows = jdbc.query(
            "SELECT " + ROW_COLUMNS + " FROM enquiries e LEFT JOIN app_profiles a ON a.id = e.assigned_to"
                + where + " ORDER BY e.created_at DESC LIMIT ? OFFSET ?",
            (rs, n) -> mapRow(rs), pageParams.toArray());
        return new Page(rows, total == null ? 0 : total, safePage, safeSize);
    }

    public EnquiryDetail get(UUID id) {
        var found = jdbc.query("""
            SELECT %s, e.source_page, e.message, e.details, e.email_verified_at, e.first_response_at
            FROM enquiries e LEFT JOIN app_profiles a ON a.id = e.assigned_to
            WHERE e.id = ?
            """.formatted(ROW_COLUMNS),
            (rs, n) -> new EnquiryDetail(
                mapRow(rs), rs.getString("source_page"), rs.getString("message"), fromJson(rs.getString("details")),
                rs.getObject("email_verified_at", OffsetDateTime.class),
                rs.getObject("first_response_at", OffsetDateTime.class), List.of()),
            id);
        if (found.isEmpty()) throw ApiException.notFound("Enquiry", id);
        List<EventView> events = jdbc.query("""
            SELECT event_type, actor_name, old_value, new_value, note, created_at
            FROM enquiry_events WHERE enquiry_id = ? ORDER BY created_at
            """,
            (rs, n) -> new EventView(rs.getString("event_type"), rs.getString("actor_name"), rs.getString("old_value"),
                rs.getString("new_value"), rs.getString("note"), rs.getObject("created_at", OffsetDateTime.class)),
            id);
        EnquiryDetail d = found.get(0);
        return new EnquiryDetail(d.enquiry(), d.sourcePage(), d.message(), d.details(), d.emailVerifiedAt(),
            d.firstResponseAt(), events);
    }

    @Transactional
    public EnquiryDetail updateStatus(UUID id, String rawStatus, String note, UUID actorId) {
        String status = rawStatus == null ? "" : rawStatus.trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(status)) throw ApiException.badRequest("Unknown status");
        String current = currentStatus(id);
        if (current.equals(status)) return get(id);
        String cleanNote = optional(note, "Note", 2000);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        jdbc.update("""
            UPDATE enquiries SET status = ?, updated_at = ?,
                   first_response_at = CASE WHEN first_response_at IS NULL AND ? <> 'NEW' THEN ? ELSE first_response_at END
            WHERE id = ?
            """, status, now, status, now, id);
        event(id, actorId, "STATUS_CHANGED", current, status, cleanNote, now);
        audit.log(actorId, "ENQUIRY_STATUS_CHANGED", "ENQUIRY", id, Map.of("from", current, "to", status));
        return get(id);
    }

    @Transactional
    public EnquiryDetail assign(UUID id, UUID assigneeId, UUID actorId) {
        currentStatus(id);
        String assigneeName = null;
        if (assigneeId != null) {
            assigneeName = assignableStaff().stream().filter(s -> s.id().equals(assigneeId)).map(Staff::name)
                .findFirst().orElseThrow(() -> ApiException.badRequest("Enquiries can only be assigned to enquiry managers or admins"));
        }
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("UPDATE enquiries SET assigned_to = ?, updated_at = ? WHERE id = ?", assigneeId, now, id);
        event(id, actorId, "ASSIGNED", null, assigneeName == null ? "Unassigned" : assigneeName, null, now);
        return get(id);
    }

    @Transactional
    public EnquiryDetail addNote(UUID id, String note, UUID actorId) {
        currentStatus(id);
        String clean = required(note, "Note", 1, 2000);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("UPDATE enquiries SET updated_at = ? WHERE id = ?", now, id);
        event(id, actorId, "NOTE", null, null, clean, now);
        return get(id);
    }

    public record Staff(UUID id, String name, String email) {}

    public List<Staff> assignableStaff() {
        return jdbc.query("""
            SELECT DISTINCT p.id, p.display_name, p.email FROM app_profiles p
            JOIN app_role_assignments r ON r.user_id = p.id
            WHERE p.account_status = 'ACTIVE' AND r.role IN ('ENQUIRY_MANAGER', 'ADMIN')
            ORDER BY p.display_name
            """, (rs, n) -> new Staff(rs.getObject("id", UUID.class), rs.getString("display_name"), rs.getString("email")));
    }

    public record Summary(long total, long newCount, long inProgress, long contacted, long closed, long spam,
                          long today, Double avgFirstResponseMinutes, OffsetDateTime latestCreatedAt) {}

    public Summary summary() {
        Map<String, Long> byStatus = new LinkedHashMap<>();
        jdbc.query("SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status",
            rs -> { byStatus.put(rs.getString("status"), rs.getLong("n")); });
        OffsetDateTime startOfDayIst = OffsetDateTime.now(java.time.ZoneId.of("Asia/Kolkata"))
            .toLocalDate().atStartOfDay(java.time.ZoneId.of("Asia/Kolkata")).toOffsetDateTime();
        Long today = jdbc.queryForObject("SELECT COUNT(*) FROM enquiries WHERE created_at >= ?", Long.class, startOfDayIst);
        OffsetDateTime latest = jdbc.queryForObject("SELECT MAX(created_at) FROM enquiries", OffsetDateTime.class);

        List<long[]> responses = jdbc.query(
            "SELECT created_at, first_response_at FROM enquiries WHERE first_response_at IS NOT NULL AND created_at > ?",
            (rs, n) -> new long[] {
                rs.getObject("created_at", OffsetDateTime.class).toEpochSecond(),
                rs.getObject("first_response_at", OffsetDateTime.class).toEpochSecond() },
            OffsetDateTime.now(ZoneOffset.UTC).minusDays(30));
        Double avg = responses.isEmpty() ? null
            : responses.stream().mapToLong(r -> r[1] - r[0]).average().orElse(0) / 60.0;

        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        return new Summary(total, byStatus.getOrDefault("NEW", 0L), byStatus.getOrDefault("IN_PROGRESS", 0L),
            byStatus.getOrDefault("CONTACTED", 0L), byStatus.getOrDefault("CLOSED", 0L), byStatus.getOrDefault("SPAM", 0L),
            today == null ? 0 : today, avg, latest);
    }

    /** Enquiries created after {@code since} (newest first, max 20) — polled by the dashboard for live pop-ups. */
    public List<EnquiryRow> createdSince(OffsetDateTime since) {
        return jdbc.query(
            "SELECT " + ROW_COLUMNS + " FROM enquiries e LEFT JOIN app_profiles a ON a.id = e.assigned_to"
                + " WHERE e.created_at > ? ORDER BY e.created_at DESC LIMIT 20",
            (rs, n) -> mapRow(rs), since);
    }

    /** CSV of the filtered list (max 5000 rows). Cells are protected against spreadsheet formula injection. */
    public String exportCsv(Filters filters) {
        List<Object> params = new ArrayList<>();
        String where = whereClause(filters, params);
        StringBuilder csv = new StringBuilder("﻿Reference,Received (UTC),Form,Status,Name,Email,Phone,Company,City,Assigned to,Message\r\n");
        jdbc.query("SELECT " + ROW_COLUMNS + ", e.message FROM enquiries e LEFT JOIN app_profiles a ON a.id = e.assigned_to"
                + where + " ORDER BY e.created_at DESC LIMIT 5000",
            rs -> {
                EnquiryRow r = mapRow(rs);
                csv.append(String.join(",", List.of(
                    cell(r.reference()), cell(String.valueOf(r.createdAt())), cell(r.formLabel()), cell(r.status()),
                    cell(r.name()), cell(r.email()), cell(r.phone()), cell(r.company()), cell(r.city()),
                    cell(r.assigneeName()), cell(rs.getString("message"))))).append("\r\n");
            }, params.toArray());
        return csv.toString();
    }

    // ================================================================ helpers

    private String whereClause(Filters f, List<Object> params) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if (f.status() != null && !f.status().isBlank()) {
            String s = f.status().trim().toUpperCase(Locale.ROOT);
            if (!STATUSES.contains(s)) throw ApiException.badRequest("Unknown status");
            where.append(" AND e.status = ?");
            params.add(s);
        }
        if (f.formType() != null && !f.formType().isBlank()) {
            where.append(" AND e.form_type = ?");
            params.add(EnquiryFormType.parse(f.formType()).name());
        }
        if (f.search() != null && !f.search().isBlank()) {
            String term = "%" + f.search().trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" AND (lower(e.reference) LIKE ? OR lower(e.name) LIKE ? OR lower(e.email) LIKE ?"
                + " OR lower(COALESCE(e.company, '')) LIKE ? OR COALESCE(e.phone, '') LIKE ?)");
            for (int i = 0; i < 5; i++) params.add(term);
        }
        if (f.from() != null) { where.append(" AND e.created_at >= ?"); params.add(f.from()); }
        if (f.to() != null) { where.append(" AND e.created_at < ?"); params.add(f.to()); }
        return where.toString();
    }

    private EnquiryRow mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        String formType = rs.getString("form_type");
        String label;
        try { label = EnquiryFormType.valueOf(formType).label(); } catch (IllegalArgumentException e) { label = formType; }
        return new EnquiryRow(rs.getObject("id", UUID.class), rs.getString("reference"), formType, label,
            rs.getString("name"), rs.getString("email"), rs.getString("phone"), rs.getString("company"),
            rs.getString("city"), rs.getString("status"), rs.getObject("assigned_to", UUID.class),
            rs.getString("assignee_name"), rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class));
    }

    private String currentStatus(UUID id) {
        return jdbc.query("SELECT status FROM enquiries WHERE id = ?", (rs, n) -> rs.getString("status"), id)
            .stream().findFirst().orElseThrow(() -> ApiException.notFound("Enquiry", id));
    }

    private void event(UUID enquiryId, UUID actorId, String type, String oldValue, String newValue, String note, OffsetDateTime at) {
        String actorName = actorId == null ? null : jdbc.query("SELECT display_name FROM app_profiles WHERE id = ?",
            (rs, n) -> rs.getString("display_name"), actorId).stream().findFirst().orElse(null);
        jdbc.update("""
            INSERT INTO enquiry_events (id, enquiry_id, actor_id, actor_name, event_type, old_value, new_value, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, UUID.randomUUID(), enquiryId, actorId, actorName, type, oldValue, newValue, note, at);
    }

    private String newReference() {
        for (int i = 0; i < 10; i++) {
            String ref = String.format(Locale.ROOT, "CH-ENQ-%06d", RANDOM.nextInt(1_000_000));
            Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM enquiries WHERE reference = ?", Integer.class, ref);
            if (exists == null || exists == 0) return ref;
        }
        throw new IllegalStateException("Could not allocate an enquiry reference");
    }

    /** Field labels → printable values. Rejects oversized or oddly-named payloads. */
    static Map<String, String> cleanDetails(Map<String, Object> raw) {
        Map<String, String> out = new LinkedHashMap<>();
        if (raw == null) return out;
        if (raw.size() > MAX_DETAIL_FIELDS) throw ApiException.badRequest("Too many form fields");
        for (var entry : raw.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().trim();
            if (!FIELD_NAME.matcher(key).matches()) throw ApiException.badRequest("Invalid form field name");
            String value = printable(entry.getValue());
            if (value == null || value.isBlank()) continue;
            if (value.length() > MAX_VALUE_LENGTH) throw ApiException.badRequest("A form field is too long");
            out.put(key, value.trim());
        }
        return out;
    }

    private static String printable(Object value) {
        if (value == null) return null;
        if (value instanceof String s) return s;
        if (value instanceof Number || value instanceof Boolean) {
            return value instanceof Boolean b ? (b ? "Yes" : "No") : value.toString();
        }
        if (value instanceof Collection<?> list) {
            if (list.size() > MAX_LIST_ITEMS) throw ApiException.badRequest("Too many selections in a form field");
            List<String> parts = new ArrayList<>();
            for (Object item : list) {
                if (!(item instanceof String || item instanceof Number || item instanceof Boolean)) {
                    throw ApiException.badRequest("Unsupported form value");
                }
                parts.add(String.valueOf(item));
            }
            return String.join(", ", parts);
        }
        throw ApiException.badRequest("Unsupported form value");
    }

    private static String required(String value, String field, int min, int max) {
        String v = value == null ? "" : value.trim();
        if (v.length() < min) throw ApiException.badRequest(field + " is required.");
        if (v.length() > max) throw ApiException.badRequest(field + " is too long.");
        return v;
    }

    private static String optional(String value, String field, int max) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (v.length() > max) throw ApiException.badRequest(field + " is too long.");
        return v;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String toJson(Map<String, String> map) {
        try {
            return JSON.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Map<String, String> fromJson(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return JSON.readValue(json, new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    /** CSV cell: quoted, with leading =,+,-,@ neutralised so spreadsheets don't run formulas. */
    static String cell(String value) {
        if (value == null) return "";
        String v = value.replace("\r", " ").replace("\n", " ");
        if (!v.isEmpty() && "=+-@\t".indexOf(v.charAt(0)) >= 0) v = "'" + v;
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }
}
