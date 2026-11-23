package com.chasehorse.tickets;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class TicketService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RoleAuthorization roleAuth;
    private final com.chasehorse.area.AreaScopeService areaScopeService;
    private final com.chasehorse.common.IdGeneratorService idGenerator;
    private final com.chasehorse.mail.NotificationEmails notificationEmails;

    public TicketService(
        JdbcTemplate jdbc,
        AuditService audit,
        RoleAuthorization roleAuth,
        @org.springframework.beans.factory.annotation.Autowired(required = false) com.chasehorse.area.AreaScopeService areaScopeService,
        @org.springframework.beans.factory.annotation.Autowired(required = false) com.chasehorse.common.IdGeneratorService idGenerator,
        @org.springframework.beans.factory.annotation.Autowired(required = false) com.chasehorse.mail.NotificationEmails notificationEmails
    ) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.roleAuth = roleAuth;
        this.areaScopeService = areaScopeService != null ? areaScopeService : new com.chasehorse.area.AreaScopeService(jdbc, roleAuth);
        this.idGenerator = idGenerator != null ? idGenerator : new com.chasehorse.common.IdGeneratorService(jdbc);
        this.notificationEmails = notificationEmails;
    }

    public record TicketCommentView(
        UUID id, UUID ticketId, UUID authorId, String authorName,
        String message, boolean isInternal, String attachments, OffsetDateTime createdAt
    ) {}

    public record TicketEventView(
        UUID id, UUID ticketId, UUID actorId, String eventType,
        String oldValue, String newValue, String notes, OffsetDateTime createdAt
    ) {}

    public record TicketView(
        UUID id, String displayId, String ticketNumber, UUID customerId, String customerName,
        UUID assignedTo, String assigneeName, UUID relatedTaskId, String subject,
        String category, String urgency, String status, String region, String stateCode,
        OffsetDateTime createdAt, OffsetDateTime updatedAt, OffsetDateTime resolvedAt,
        List<TicketCommentView> comments, List<TicketEventView> events
    ) {
        public TicketView(
            UUID id, String ticketNumber, UUID customerId, String customerName,
            UUID assignedTo, String assigneeName, UUID relatedTaskId, String subject,
            String category, String urgency, String status, String region, String stateCode,
            OffsetDateTime createdAt, OffsetDateTime updatedAt, OffsetDateTime resolvedAt,
            List<TicketCommentView> comments, List<TicketEventView> events
        ) {
            this(id, null, ticketNumber, customerId, customerName, assignedTo, assigneeName,
                 relatedTaskId, subject, category, urgency, status, region, stateCode,
                 createdAt, updatedAt, resolvedAt, comments, events);
        }

        public TicketView(
            UUID id, String ticketNumber, UUID customerId, String customerName,
            UUID assignedTo, String assigneeName, UUID relatedTaskId, String subject,
            String category, String urgency, String status, String region,
            OffsetDateTime createdAt, OffsetDateTime updatedAt, OffsetDateTime resolvedAt,
            List<TicketCommentView> comments, List<TicketEventView> events
        ) {
            this(id, null, ticketNumber, customerId, customerName, assignedTo, assigneeName,
                 relatedTaskId, subject, category, urgency, status, region, "AP",
                 createdAt, updatedAt, resolvedAt, comments, events);
        }
    }

    public record CreateTicketCommand(
        String subject, String category, String urgency, String message,
        UUID relatedTaskId, String region, String attachmentsJson
    ) {}

    public record AddCommentCommand(
        String message, boolean isInternal, String attachmentsJson
    ) {}

    @Transactional
    public TicketView createTicket(CreateTicketCommand cmd, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        if (cmd.subject() == null || cmd.subject().isBlank()) {
            throw ApiException.badRequest("Ticket subject is required");
        }
        assertMayLinkTask(actorId, cmd.relatedTaskId());
        String ticketNumber = "TKT-" + jdbc.queryForObject("SELECT nextval('support_ticket_seq')", Long.class);
        String displayId = idGenerator.nextTicketId();

        String category = cmd.category() != null ? cmd.category() : "OPERATIONS";
        String urgency = cmd.urgency() != null ? cmd.urgency().toUpperCase() : "NORMAL";
        String region = cmd.region() != null ? cmd.region() : "Central Cluster";

        // Determine state_code: from user's state_code or region
        String stateCode = "AP";
        var userState = jdbc.query("SELECT state_code FROM app_profiles WHERE id = ?", (rs, n) -> rs.getString("state_code"), actorId);
        if (!userState.isEmpty() && userState.get(0) != null) {
            stateCode = userState.get(0);
        } else if (region != null && region.toUpperCase().contains("TELANGANA")) {
            stateCode = "TG";
        }

        UUID ticketId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO support_tickets (id, display_id, ticket_number, customer_id, related_task_id,
                                        subject, category, urgency, status, region, state_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
            """,
            ticketId, displayId, ticketNumber, actorId, cmd.relatedTaskId(),
            cmd.subject().trim(), category, urgency, region, stateCode
        );

        // Get customer display name
        String authorName = jdbc.query(
            "SELECT display_name FROM app_profiles WHERE id = ?",
            (rs, n) -> rs.getString("display_name"), actorId
        ).stream().findFirst().orElse("Customer");

        // First message stored as initial comment
        if (cmd.message() != null && !cmd.message().isBlank()) {
            UUID commentId = UUID.randomUUID();
            jdbc.update("""
                INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, attachments)
                VALUES (?, ?, ?, ?, ?, false, ?::jsonb)
                """,
                commentId, ticketId, actorId, authorName, cmd.message().trim(),
                cmd.attachmentsJson() != null ? cmd.attachmentsJson() : "[]"
            );
        }

        // Append-only event
        jdbc.update("""
            INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, new_value, notes)
            VALUES (gen_random_uuid(), ?, ?, 'CREATED', 'OPEN', 'Ticket logged by customer')
            """,
            ticketId, actorId
        );

        audit.log(actorId, "TICKET_CREATED", "SUPPORT_TICKET", ticketId,
            Map.of("ticketNumber", ticketNumber, "subject", cmd.subject(), "state_code", stateCode));

        // Acknowledgement from tech.support@ (CC: related worker, zone manager, admin); queued in
        // this transaction so it is only sent if the ticket is saved.
        if (notificationEmails != null) {
            notificationEmails.ticketRaised(ticketId);
        }

        return getTicket(ticketId, jwt);
    }

    /**
     * A ticket may reference a task only if the requester is that task's customer or assigned
     * worker, or is staff. Prevents linking to arbitrary tasks — the ticket e-mail copies the
     * task's worker, so an unchecked link would expose their address to strangers.
     */
    private void assertMayLinkTask(UUID actorId, UUID taskId) {
        if (taskId == null) return;
        var task = jdbc.query("SELECT customer_id, assigned_to FROM tasks WHERE id = ?",
            (rs, n) -> new UUID[] { rs.getObject("customer_id", UUID.class), rs.getObject("assigned_to", UUID.class) },
            taskId);
        if (task.isEmpty()) {
            throw ApiException.badRequest("The related task does not exist");
        }
        UUID[] owners = task.get(0);
        if (actorId.equals(owners[0]) || actorId.equals(owners[1])) return;
        boolean isStaff = roleAuth.getRoles(actorId.toString()).stream()
            .anyMatch(r -> r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
        if (!isStaff) {
            throw ApiException.badRequest("You can only link a ticket to one of your own tasks");
        }
    }

    public List<TicketView> listTickets(Jwt jwt, String statusFilter, String urgencyFilter, String search) {
        return listTickets(jwt, statusFilter, urgencyFilter, search, null);
    }

    public List<TicketView> listTickets(Jwt jwt, String statusFilter, String urgencyFilter, String search, String stateFilter) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
        boolean isManager = roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
        boolean isStaffOrAdmin = isAdmin || isManager;

        StringBuilder sql = new StringBuilder("""
            SELECT t.id, t.display_id, t.ticket_number, t.customer_id, p.display_name AS customer_name,
                   t.assigned_to, ap.display_name AS assignee_name, t.related_task_id,
                   t.subject, t.category, t.urgency, t.status, t.region, t.state_code,
                   t.created_at, t.updated_at, t.resolved_at
            FROM support_tickets t
            LEFT JOIN app_profiles p ON p.id = t.customer_id
            LEFT JOIN app_profiles ap ON ap.id = t.assigned_to
            WHERE 1=1
            """);

        List<Object> params = new ArrayList<>();

        if (!isStaffOrAdmin) {
            // Customer can only view their own tickets
            sql.append(" AND t.customer_id = ? ");
            params.add(actorId);
        } else if (isManager && !isAdmin) {
            List<String> zones = areaScopeService.getManagerAssignedStates(actorId);
            if (zones.isEmpty()) {
                return List.of();
            }
            sql.append(" AND (t.state_code IN " + com.chasehorse.area.AreaScopeService.MANAGER_STATES_SUBQUERY + " OR t.state_code IS NULL) ");
            params.add(actorId);
        } else if (isAdmin && stateFilter != null && !stateFilter.isBlank()) {
            sql.append(" AND t.state_code = ? ");
            params.add(stateFilter.trim().toUpperCase());
        }

        if (statusFilter != null && !statusFilter.isBlank() && !statusFilter.equalsIgnoreCase("ALL")) {
            sql.append(" AND UPPER(t.status) = ? ");
            params.add(statusFilter.trim().toUpperCase());
        }

        if (urgencyFilter != null && !urgencyFilter.isBlank() && !urgencyFilter.equalsIgnoreCase("ALL")) {
            sql.append(" AND UPPER(t.urgency) = ? ");
            params.add(urgencyFilter.trim().toUpperCase());
        }

        if (search != null && !search.isBlank()) {
            sql.append(" AND (LOWER(t.subject) LIKE ? OR LOWER(t.ticket_number) LIKE ? OR LOWER(COALESCE(t.display_id, '')) LIKE ?) ");
            String term = "%" + search.trim().toLowerCase() + "%";
            params.add(term);
            params.add(term);
            params.add(term);
        }

        sql.append(" ORDER BY t.created_at DESC LIMIT 200");

        return jdbc.query(sql.toString(), (rs, n) -> new TicketView(
            rs.getObject("id", UUID.class),
            rs.getString("display_id"),
            rs.getString("ticket_number"),
            rs.getObject("customer_id", UUID.class),
            rs.getString("customer_name") != null ? rs.getString("customer_name") : "Customer",
            rs.getObject("assigned_to", UUID.class),
            rs.getString("assignee_name"),
            rs.getObject("related_task_id", UUID.class),
            rs.getString("subject"),
            rs.getString("category"),
            rs.getString("urgency"),
            rs.getString("status"),
            rs.getString("region"),
            rs.getString("state_code"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class),
            rs.getObject("resolved_at", OffsetDateTime.class),
            List.of(),
            List.of()
        ), params.toArray());
    }

    public TicketView getTicket(UUID ticketId, Jwt jwt) {
        return getTicket(ticketId.toString(), jwt);
    }

    public TicketView getTicket(String idOrDisplayId, Jwt jwt) {
        if (idOrDisplayId == null || idOrDisplayId.isBlank()) {
            throw ApiException.badRequest("Ticket ID or display ID is required");
        }
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
        boolean isManager = roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
        boolean isStaffOrAdmin = isAdmin || isManager;

        boolean isUuid = idOrDisplayId.trim().matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
        String sql = """
            SELECT t.id, t.display_id, t.ticket_number, t.customer_id, p.display_name AS customer_name,
                   t.assigned_to, ap.display_name AS assignee_name, t.related_task_id,
                   t.subject, t.category, t.urgency, t.status, t.region, t.state_code,
                   t.created_at, t.updated_at, t.resolved_at
            FROM support_tickets t
            LEFT JOIN app_profiles p ON p.id = t.customer_id
            LEFT JOIN app_profiles ap ON ap.id = t.assigned_to
            WHERE""" + (isUuid ? " t.id = ?" : " (t.display_id = ? OR t.display_id ILIKE ? OR t.ticket_number = ?)"); // text blocks drop trailing spaces

        List<TicketView> list;
        if (isUuid) {
            list = jdbc.query(sql, (rs, n) -> new TicketView(
                rs.getObject("id", UUID.class),
                rs.getString("display_id"),
                rs.getString("ticket_number"),
                rs.getObject("customer_id", UUID.class),
                rs.getString("customer_name") != null ? rs.getString("customer_name") : "Customer",
                rs.getObject("assigned_to", UUID.class),
                rs.getString("assignee_name"),
                rs.getObject("related_task_id", UUID.class),
                rs.getString("subject"),
                rs.getString("category"),
                rs.getString("urgency"),
                rs.getString("status"),
                rs.getString("region"),
                rs.getString("state_code"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class),
                rs.getObject("resolved_at", OffsetDateTime.class),
                new ArrayList<>(),
                new ArrayList<>()
            ), UUID.fromString(idOrDisplayId.trim()));
        } else {
            String trimmed = idOrDisplayId.trim().toUpperCase();
            list = jdbc.query(sql, (rs, n) -> new TicketView(
                rs.getObject("id", UUID.class),
                rs.getString("display_id"),
                rs.getString("ticket_number"),
                rs.getObject("customer_id", UUID.class),
                rs.getString("customer_name") != null ? rs.getString("customer_name") : "Customer",
                rs.getObject("assigned_to", UUID.class),
                rs.getString("assignee_name"),
                rs.getObject("related_task_id", UUID.class),
                rs.getString("subject"),
                rs.getString("category"),
                rs.getString("urgency"),
                rs.getString("status"),
                rs.getString("region"),
                rs.getString("state_code"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class),
                rs.getObject("resolved_at", OffsetDateTime.class),
                new ArrayList<>(),
                new ArrayList<>()
            ), trimmed, trimmed, trimmed);
        }

        if (list.isEmpty()) {
            throw ApiException.notFound("SupportTicket", idOrDisplayId);
        }

        TicketView base = list.get(0);

        if (isManager && !isAdmin) {
            boolean hasZones = !areaScopeService.getManagerAssignedStates(actorId).isEmpty();
            if (!hasZones || (base.stateCode() != null && !areaScopeService.managerCovers(actorId, base.stateCode()))) {
                // Foreign state returns 404 (not 403) so existence is not revealed
                throw ApiException.notFound("SupportTicket", idOrDisplayId);
            }
        } else if (!isStaffOrAdmin && !actorId.equals(base.customerId())) {
            throw ApiException.forbidden("You do not have permission to view this ticket");
        }

        // Load comments (hide internal notes from customers)
        String commentSql = """
            SELECT id, ticket_id, author_id, author_name, message, is_internal, attachments, created_at
            FROM support_ticket_comments
            WHERE ticket_id = ?
            """ + (!isStaffOrAdmin ? " AND is_internal = false " : "") +
            " ORDER BY created_at ASC";

        List<TicketCommentView> comments = jdbc.query(commentSql,
            (rs, n) -> new TicketCommentView(
                rs.getObject("id", UUID.class),
                rs.getObject("ticket_id", UUID.class),
                rs.getObject("author_id", UUID.class),
                rs.getString("author_name"),
                rs.getString("message"),
                rs.getBoolean("is_internal"),
                rs.getString("attachments"),
                rs.getObject("created_at", OffsetDateTime.class)
            ),
            base.id()
        );

        // Load append-only event history
        List<TicketEventView> events = jdbc.query("""
            SELECT id, ticket_id, actor_id, event_type, old_value, new_value, notes, created_at
            FROM support_ticket_events
            WHERE ticket_id = ?
            ORDER BY created_at ASC
            """,
            (rs, n) -> new TicketEventView(
                rs.getObject("id", UUID.class),
                rs.getObject("ticket_id", UUID.class),
                rs.getObject("actor_id", UUID.class),
                rs.getString("event_type"),
                rs.getString("old_value"),
                rs.getString("new_value"),
                rs.getString("notes"),
                rs.getObject("created_at", OffsetDateTime.class)
            ),
            base.id()
        );

        return new TicketView(
            base.id(), base.displayId(), base.ticketNumber(), base.customerId(), base.customerName(),
            base.assignedTo(), base.assigneeName(), base.relatedTaskId(), base.subject(),
            base.category(), base.urgency(), base.status(), base.region(), base.stateCode(),
            base.createdAt(), base.updatedAt(), base.resolvedAt(), comments, events
        );
    }

    @Transactional
    public TicketCommentView addComment(UUID ticketId, AddCommentCommand cmd, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        TicketView ticket = getTicket(ticketId, jwt);

        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaffOrAdmin = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        boolean isInternal = isStaffOrAdmin && cmd.isInternal();

        String authorName = jdbc.query(
            "SELECT display_name FROM app_profiles WHERE id = ?",
            (rs, n) -> rs.getString("display_name"), actorId
        ).stream().findFirst().orElse(isStaffOrAdmin ? "Support Agent" : "Customer");

        UUID commentId = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO support_ticket_comments (id, ticket_id, author_id, author_name, message, is_internal, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)
            """,
            commentId, ticketId, actorId, authorName, cmd.message().trim(),
            isInternal, cmd.attachmentsJson() != null ? cmd.attachmentsJson() : "[]"
        );

        // If customer comments on WAITING_ON_CUSTOMER or RESOLVED, advance status
        if (!isStaffOrAdmin) {
            if ("WAITING_ON_CUSTOMER".equalsIgnoreCase(ticket.status())) {
                updateTicketStatus(ticketId, "IN_PROGRESS", "Customer replied with information", jwt);
            } else if ("RESOLVED".equalsIgnoreCase(ticket.status())) {
                updateTicketStatus(ticketId, "OPEN", "Customer reopened ticket with follow-up", jwt);
            }
        }

        jdbc.update("UPDATE support_tickets SET updated_at = now() WHERE id = ?", ticketId);

        jdbc.update("""
            INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, notes)
            VALUES (gen_random_uuid(), ?, ?, 'COMMENT_ADDED', ?)
            """,
            ticketId, actorId, isInternal ? "Internal staff note added" : "Public reply added"
        );

        return new TicketCommentView(
            commentId, ticketId, actorId, authorName, cmd.message().trim(),
            isInternal, cmd.attachmentsJson(), OffsetDateTime.now()
        );
    }

    @Transactional
    public TicketView updateTicketStatus(UUID ticketId, String newStatus, String notes, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        TicketView ticket = getTicket(ticketId, jwt);

        String target = newStatus.trim().toUpperCase();
        var validStates = Set.of("OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED");
        if (!validStates.contains(target)) {
            throw ApiException.badRequest("Invalid ticket status: " + newStatus);
        }

        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaffOrAdmin = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        if (!isStaffOrAdmin) {
            // Customers can only reopen a resolved ticket or close their own ticket
            if (target.equals("OPEN") && "RESOLVED".equalsIgnoreCase(ticket.status())) {
                // allowed
            } else if (target.equals("CLOSED")) {
                // allowed
            } else {
                throw ApiException.forbidden("Customers can only close or reopen tickets");
            }
        }

        OffsetDateTime resolvedAt = target.equals("RESOLVED") || target.equals("CLOSED") ? OffsetDateTime.now() : null;

        jdbc.update("""
            UPDATE support_tickets
            SET status = ?, updated_at = now(), resolved_at = COALESCE(?, resolved_at)
            WHERE id = ?
            """,
            target, resolvedAt, ticketId
        );

        // Append to audit events
        jdbc.update("""
            INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, old_value, new_value, notes)
            VALUES (gen_random_uuid(), ?, ?, 'STATUS_CHANGED', ?, ?, ?)
            """,
            ticketId, actorId, ticket.status(), target, notes != null ? notes : "Status updated"
        );

        audit.log(actorId, "TICKET_STATUS_CHANGED", "SUPPORT_TICKET", ticketId,
            Map.of("oldStatus", ticket.status(), "newStatus", target));

        return getTicket(ticketId, jwt);
    }

    @Transactional
    public TicketView assignTicket(UUID ticketId, UUID staffId, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        TicketView ticket = getTicket(ticketId, jwt);

        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaffOrAdmin = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        if (!isStaffOrAdmin) {
            throw ApiException.forbidden("Only staff can assign tickets");
        }

        // Verify staff exists and is active
        var staffExists = jdbc.query("SELECT id FROM app_profiles WHERE id = ? AND account_status = 'ACTIVE'",
            (rs, n) -> rs.getObject("id", UUID.class), staffId);
        if (staffExists.isEmpty()) {
            throw ApiException.badRequest("Target staff member not found or is not active");
        }

        jdbc.update("""
            UPDATE support_tickets
            SET assigned_to = ?, status = CASE WHEN status = 'OPEN' THEN 'ASSIGNED' ELSE status END, updated_at = now()
            WHERE id = ?
            """,
            staffId, ticketId
        );

        jdbc.update("""
            INSERT INTO support_ticket_events (id, ticket_id, actor_id, event_type, old_value, new_value, notes)
            VALUES (gen_random_uuid(), ?, ?, 'ASSIGNED', ?, ?, 'Assigned to duty operations specialist')
            """,
            ticketId, actorId,
            ticket.assignedTo() != null ? ticket.assignedTo().toString() : "UNASSIGNED",
            staffId.toString()
        );

        audit.log(actorId, "TICKET_ASSIGNED", "SUPPORT_TICKET", ticketId,
            Map.of("assignedTo", staffId.toString()));

        return getTicket(ticketId, jwt);
    }
}
