package com.chasehorse.mail;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Builds and queues the business notification e-mails, all sent from tech.support@.
 *
 * <ul>
 *   <li>Task accepted → field worker (CC: zone operations manager(s), admin)</li>
 *   <li>Task accepted → customer, "a professional has been assigned" (CC: admin, zone manager(s))</li>
 *   <li>Support ticket raised → requester (CC: related field worker, zone manager(s), admin)</li>
 * </ul>
 *
 * Every value that can come from user input is HTML-escaped. The customer e-mail names the
 * worker and their EMP ID only — never the worker's phone number or e-mail address.
 */
@Service
public class NotificationEmails {
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DUE_FORMAT = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.ENGLISH);

    private final JdbcTemplate jdbc;
    private final EmailOutbox outbox;
    private final MailSettings settings;

    public NotificationEmails(JdbcTemplate jdbc, EmailOutbox outbox, MailSettings settings) {
        this.jdbc = jdbc;
        this.outbox = outbox;
        this.settings = settings;
    }

    // ------------------------------------------------------------------ tasks

    private record TaskInfo(UUID id, String code, String title, String area, String address,
                            OffsetDateTime dueAt, BigDecimal reward, String currency, String stateCode,
                            UUID workerId, String workerName, String workerCode, String workerEmail,
                            String customerName, String customerEmail) {}

    /** Queue both "task accepted" e-mails. Call inside the transaction that accepts the task. */
    public void taskAccepted(UUID taskId) {
        TaskInfo task = jdbc.query("""
            SELECT t.id, t.display_id, t.title, t.location_area, t.location_address, t.due_at,
                   t.reward_amount, t.currency, t.state_code,
                   w.id AS worker_id, w.display_name AS worker_name, w.display_id AS worker_code, w.email AS worker_email,
                   COALESCE(c.company_name, c.display_name) AS customer_name, c.email AS customer_email
            FROM tasks t
            LEFT JOIN app_profiles w ON w.id = t.assigned_to
            LEFT JOIN app_profiles c ON c.id = t.customer_id
            WHERE t.id = ?
            """,
            (rs, n) -> new TaskInfo(
                rs.getObject("id", UUID.class), rs.getString("display_id"), rs.getString("title"),
                rs.getString("location_area"), rs.getString("location_address"),
                rs.getObject("due_at", OffsetDateTime.class), rs.getBigDecimal("reward_amount"),
                rs.getString("currency"), rs.getString("state_code"),
                rs.getObject("worker_id", UUID.class), rs.getString("worker_name"), rs.getString("worker_code"),
                rs.getString("worker_email"), rs.getString("customer_name"), rs.getString("customer_email")),
            taskId).stream().findFirst().orElse(null);
        if (task == null || task.workerId() == null) return;

        List<String> managers = zoneManagerEmails(task.stateCode());
        String code = task.code() != null ? task.code() : task.id().toString().substring(0, 8);
        String where = joinNonBlank(task.area(), task.address());

        // 1. To the field worker
        Map<String, String> workerFacts = new LinkedHashMap<>();
        workerFacts.put("Task", code + " — " + task.title());
        if (!where.isBlank()) workerFacts.put("Location", where);
        if (task.dueAt() != null) workerFacts.put("Due", DUE_FORMAT.format(task.dueAt().atZoneSameInstant(IST)) + " IST");
        if (task.reward() != null) workerFacts.put("Reward", money(task.reward(), task.currency()));
        outbox.enqueue(message(
            "TASK_ACCEPTED_WORKER",
            "task-accepted-worker:" + task.id() + ":" + task.workerId(),
            List.of(nz(task.workerEmail())),
            with(managers, settings.adminCc()),
            "Task " + code + " confirmed: " + task.title(),
            render("Hi " + firstName(task.workerName()) + ",",
                List.of("You have accepted this task. It is now assigned to you and marked In progress.",
                    "On site: check in inside the task's location radius, complete the checklist and upload "
                        + "clear photo evidence. Your zone operations manager reviews the work, and the reward "
                        + "is credited to your wallet after approval."),
                workerFacts, "Open the task", settings.appUrl() + "/tasks/" + task.id())));

        // 2. To the customer, if the task belongs to one
        if (task.customerEmail() != null && !task.customerEmail().isBlank()) {
            Map<String, String> customerFacts = new LinkedHashMap<>();
            customerFacts.put("Task", code + " — " + task.title());
            customerFacts.put("Assigned professional", nz(task.workerName())
                + (task.workerCode() != null ? " (" + task.workerCode() + ")" : ""));
            if (!where.isBlank()) customerFacts.put("Location", where);
            if (task.dueAt() != null) customerFacts.put("Due", DUE_FORMAT.format(task.dueAt().atZoneSameInstant(IST)) + " IST");
            outbox.enqueue(message(
                "TASK_ASSIGNED_CUSTOMER",
                "task-assigned-customer:" + task.id() + ":" + task.workerId(),
                List.of(task.customerEmail()),
                with(List.of(settings.adminCc()), managers),
                "A verified professional has been assigned to " + code,
                render("Hello " + nz(task.customerName()) + ",",
                    List.of("Good news: a verified ChaseHorse on-field professional has accepted your task and "
                            + "will complete it to our professional standards.",
                        "You can follow progress, photo evidence and the review in your customer portal."),
                    customerFacts, "Track your task", settings.appUrl() + "/customer/tasks/" + task.id())));
        }
    }

    /** Task details joined to a specific worker (who may no longer be the task's assignee). */
    private TaskInfo loadTask(UUID taskId, UUID workerId) {
        return jdbc.query("""
            SELECT t.id, t.display_id, t.title, t.location_area, t.location_address, t.due_at,
                   t.reward_amount, t.currency, t.state_code,
                   w.id AS worker_id, w.display_name AS worker_name, w.display_id AS worker_code, w.email AS worker_email,
                   COALESCE(c.company_name, c.display_name) AS customer_name, c.email AS customer_email
            FROM tasks t
            LEFT JOIN app_profiles w ON w.id = ?
            LEFT JOIN app_profiles c ON c.id = t.customer_id
            WHERE t.id = ?
            """,
            (rs, n) -> new TaskInfo(
                rs.getObject("id", UUID.class), rs.getString("display_id"), rs.getString("title"),
                rs.getString("location_area"), rs.getString("location_address"),
                rs.getObject("due_at", OffsetDateTime.class), rs.getBigDecimal("reward_amount"),
                rs.getString("currency"), rs.getString("state_code"),
                rs.getObject("worker_id", UUID.class), rs.getString("worker_name"), rs.getString("worker_code"),
                rs.getString("worker_email"), rs.getString("customer_name"), rs.getString("customer_email")),
            workerId, taskId).stream().findFirst().orElse(null);
    }

    private Map<String, String> taskFacts(TaskInfo task) {
        Map<String, String> facts = new LinkedHashMap<>();
        facts.put("Task", codeOf(task) + " — " + task.title());
        String where = joinNonBlank(task.area(), task.address());
        if (!where.isBlank()) facts.put("Location", where);
        if (task.dueAt() != null) facts.put("Due", DUE_FORMAT.format(task.dueAt().atZoneSameInstant(IST)) + " IST");
        if (task.reward() != null) facts.put("Reward", money(task.reward(), task.currency()));
        return facts;
    }

    private static String codeOf(TaskInfo task) {
        return task.code() != null ? task.code() : task.id().toString().substring(0, 8);
    }

    private String workerLabel(TaskInfo task) {
        return nz(task.workerName()) + (task.workerCode() != null ? " (" + task.workerCode() + ")" : "");
    }

    /**
     * A manager or admin assigned (or re-assigned) a task to a worker → the worker, CC zone manager(s)
     * and admin. When it was taken from another worker, that worker is told too.
     */
    public void taskAssigned(UUID taskId, UUID workerId, UUID previousWorkerId, String assignedByName) {
        TaskInfo task = loadTask(taskId, workerId);
        if (task == null || task.workerEmail() == null || task.workerEmail().isBlank()) return;
        List<String> managers = zoneManagerEmails(task.stateCode());
        String code = codeOf(task);
        Map<String, String> facts = taskFacts(task);
        if (assignedByName != null && !assignedByName.isBlank()) facts.put("Assigned by", assignedByName);
        String nonce = UUID.randomUUID().toString();

        outbox.enqueue(message(
            "TASK_ASSIGNED_WORKER",
            "task-assigned-worker:" + task.id() + ":" + workerId + ":" + nonce,
            List.of(task.workerEmail()),
            with(managers, settings.adminCc()),
            (previousWorkerId != null ? "Task re-assigned to you: " : "New task assigned to you: ") + code + " — " + task.title(),
            render("Hi " + firstName(task.workerName()) + ",",
                List.of("Your operations manager has assigned you this task. Open it in your dashboard to accept it "
                        + "and start, or decline it with a reason so it can be given to someone else.",
                    "Please respond quickly — the task stays reserved for you until you accept or decline."),
                facts, "Accept or decline", settings.appUrl() + "/tasks/" + task.id())));

        if (previousWorkerId != null && !previousWorkerId.equals(workerId)) {
            TaskInfo previous = loadTask(taskId, previousWorkerId);
            if (previous != null && previous.workerEmail() != null && !previous.workerEmail().isBlank()) {
                outbox.enqueue(message(
                    "TASK_REASSIGNED_AWAY",
                    "task-reassigned-away:" + task.id() + ":" + previousWorkerId + ":" + nonce,
                    List.of(previous.workerEmail()),
                    with(managers, settings.adminCc()),
                    "Task " + code + " has been re-assigned",
                    render("Hi " + firstName(previous.workerName()) + ",",
                        List.of("Your operations manager has re-assigned this task to another field professional. "
                                + "You no longer need to work on it, and it has been removed from your task list.",
                            "If you think this is a mistake, contact your zone operations manager."),
                        taskFacts(previous), "Open my tasks", settings.appUrl() + "/tasks")));
            }
        }
    }

    /** A worker declined a task that was assigned to them → zone manager(s) and the task creator, CC admin. */
    public void taskDeclined(UUID taskId, UUID workerId, String reason) {
        taskReleased(taskId, workerId, reason, "TASK_DECLINED", "declined",
            "declined the task that was assigned to them. It is back in the open pool for nearby workers — "
                + "assign it to someone else if it is urgent.");
    }

    /** A worker dropped a task part-way → zone manager(s) and the task creator, CC admin; confirmation to the worker. */
    public void taskDropped(UUID taskId, UUID workerId, String reason) {
        taskReleased(taskId, workerId, reason, "TASK_DROPPED", "dropped",
            "dropped this task before finishing it. It is back in the open pool for nearby workers — "
                + "please re-assign it so the customer is not delayed.");
        TaskInfo task = loadTask(taskId, workerId);
        if (task == null || task.workerEmail() == null || task.workerEmail().isBlank()) return;
        Map<String, String> facts = taskFacts(task);
        facts.put("Your reason", nz(reason));
        outbox.enqueue(message(
            "TASK_DROPPED_WORKER",
            "task-dropped-worker:" + task.id() + ":" + workerId + ":" + UUID.randomUUID(),
            List.of(task.workerEmail()),
            List.of(settings.adminCc()),
            "You dropped task " + codeOf(task),
            render("Hi " + firstName(task.workerName()) + ",",
                List.of("This confirms you have dropped the task below. It has been removed from your list and your "
                        + "operations manager has been told, with your reason.",
                    "Dropping tasks often can affect the tasks offered to you."),
                facts, "Find nearby tasks", settings.appUrl() + "/nearby")));
    }

    private void taskReleased(UUID taskId, UUID workerId, String reason, String template, String verb, String explanation) {
        TaskInfo task = loadTask(taskId, workerId);
        if (task == null) return;
        List<String> to = new ArrayList<>(zoneManagerEmails(task.stateCode()));
        String creatorEmail = jdbc.query("""
            SELECT p.email FROM tasks t JOIN app_profiles p ON p.id = t.created_by
            WHERE t.id = ? AND p.email IS NOT NULL
              AND EXISTS (SELECT 1 FROM app_role_assignments r WHERE r.user_id = p.id AND r.role IN ('ADMIN', 'MANAGER', 'OPERATIONS'))
            """, (rs, n) -> rs.getString("email"), taskId).stream().findFirst().orElse(null);
        if (creatorEmail != null && !to.contains(creatorEmail)) to.add(creatorEmail);
        List<String> cc = List.of(settings.adminCc());
        if (to.isEmpty()) {
            to = cc;
            cc = List.of();
        }
        Map<String, String> facts = taskFacts(task);
        facts.put("Field worker", workerLabel(task));
        facts.put("Reason", nz(reason));
        outbox.enqueue(message(
            template,
            template.toLowerCase(Locale.ROOT) + ":" + task.id() + ":" + workerId + ":" + UUID.randomUUID(),
            to,
            cc,
            "Task " + codeOf(task) + " " + verb + " by " + nz(task.workerName()),
            render("Hello,",
                List.of(nz(task.workerName()) + " " + explanation),
                facts, "Re-assign the task", settings.appUrl() + "/tasks/" + task.id())));
    }

    // ---------------------------------------------------------------- tickets

    /** Queue the "ticket raised" acknowledgement. Call inside the transaction that creates the ticket. */
    public void ticketRaised(UUID ticketId) {
        record TicketInfo(UUID id, String number, String subject, String category, String urgency, String stateCode,
                          UUID raiserId, String raiserName, String raiserEmail,
                          UUID workerId, String workerEmail, String taskCode) {}

        TicketInfo ticket = jdbc.query("""
            SELECT s.id, s.ticket_number, s.subject, s.category, s.urgency, s.state_code,
                   r.id AS raiser_id, COALESCE(r.company_name, r.display_name) AS raiser_name, r.email AS raiser_email,
                   w.id AS worker_id, w.email AS worker_email, t.display_id AS task_code
            FROM support_tickets s
            JOIN app_profiles r ON r.id = s.customer_id
            LEFT JOIN tasks t ON t.id = s.related_task_id
            LEFT JOIN app_profiles w ON w.id = t.assigned_to
            WHERE s.id = ?
            """,
            (rs, n) -> new TicketInfo(
                rs.getObject("id", UUID.class), rs.getString("ticket_number"), rs.getString("subject"),
                rs.getString("category"), rs.getString("urgency"), rs.getString("state_code"),
                rs.getObject("raiser_id", UUID.class), rs.getString("raiser_name"), rs.getString("raiser_email"),
                rs.getObject("worker_id", UUID.class), rs.getString("worker_email"), rs.getString("task_code")),
            ticketId).stream().findFirst().orElse(null);
        if (ticket == null) return;

        List<String> cc = new ArrayList<>();
        if (ticket.workerId() != null && !ticket.workerId().equals(ticket.raiserId())) cc.add(nz(ticket.workerEmail()));
        cc.addAll(zoneManagerEmails(ticket.stateCode()));
        cc.add(settings.adminCc());

        Map<String, String> facts = new LinkedHashMap<>();
        facts.put("Ticket", ticket.number());
        facts.put("Subject", ticket.subject());
        facts.put("Category", humanize(ticket.category()));
        facts.put("Priority", humanize(ticket.urgency()));
        if (ticket.taskCode() != null) facts.put("Related task", ticket.taskCode());

        outbox.enqueue(message(
            "TICKET_RAISED",
            "ticket-raised:" + ticket.id(),
            List.of(nz(ticket.raiserEmail())),
            cc,
            "[" + ticket.number() + "] We've received your request: " + ticket.subject(),
            render("Hello " + nz(ticket.raiserName()) + ",",
                List.of("Thank you for contacting ChaseHorse support. Your ticket has been logged and our "
                        + "operations team has been notified.",
                    "Reply in the support section of your portal to add details. Please quote "
                        + ticket.number() + " in any correspondence."),
                facts, "View ticket", settings.appUrl() + "/support")));
    }

    // ---------------------------------------------------------------- helpers

    /** Active operations managers assigned to the zone (state). */
    List<String> zoneManagerEmails(String stateCode) {
        if (stateCode == null || stateCode.isBlank()) return List.of();
        return jdbc.query("""
            SELECT DISTINCT p.email
            FROM manager_areas m
            JOIN app_profiles p ON p.id = m.manager_id
            WHERE m.state_code = ? AND p.account_status = 'ACTIVE' AND p.email IS NOT NULL
              AND EXISTS (SELECT 1 FROM app_role_assignments r
                          WHERE r.user_id = p.id AND r.role IN ('MANAGER', 'OPERATIONS'))
            """, (rs, n) -> rs.getString("email"), stateCode);
    }

    private EmailLayout.Bodies render(String greeting, List<String> paragraphs, Map<String, String> facts,
                                      String ctaLabel, String ctaUrl) {
        return EmailLayout.render(greeting, paragraphs, facts, ctaLabel, ctaUrl,
            "ChaseHorse Support · " + settings.fromAddress(),
            "This is an automated message about your ChaseHorse account.");
    }

    private EmailMessage message(String template, String key, List<String> to, List<String> cc, String subject, EmailLayout.Bodies b) {
        return new EmailMessage(template, key, to, cc, subject, b.text(), b.html());
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    private static List<String> with(List<String> first, String extra) {
        List<String> out = new ArrayList<>(first);
        out.add(extra);
        return out;
    }

    private static List<String> with(List<String> first, List<String> rest) {
        List<String> out = new ArrayList<>(first);
        out.addAll(rest);
        return out;
    }

    private static String joinNonBlank(String a, String b) {
        if (a == null || a.isBlank()) return nz(b);
        if (b == null || b.isBlank() || b.equalsIgnoreCase(a)) return a;
        return a + ", " + b;
    }

    private static String firstName(String name) {
        if (name == null || name.isBlank()) return "there";
        return name.trim().split("\\s+")[0];
    }

    private static String humanize(String value) {
        if (value == null || value.isBlank()) return "";
        String lower = value.replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private static String money(BigDecimal amount, String currency) {
        String symbol = currency == null || "INR".equalsIgnoreCase(currency) ? "₹" : currency + " ";
        return symbol + amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }
}
