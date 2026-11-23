package com.chasehorse.tasks;

import com.chasehorse.area.AreaScopeService;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.chasehorse.auth.RoleAuthorization;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.chasehorse.common.IdGeneratorService;
import com.chasehorse.mail.NotificationEmails;
import com.chasehorse.notifications.InAppNotifier;

import java.time.Duration;
import java.time.ZoneOffset;

@Service
public class TaskService {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RoleAuthorization roleAuth;
    private final AreaScopeService areaScopeService;
    private final IdGeneratorService idGenerator;
    private final TaskRadiusSettings radius;
    private final NotificationEmails notificationEmails;
    private final InAppNotifier notifier;

    /** Reasons for declining or dropping a task: required, so managers know what happened. */
    private static final int MIN_REASON = 5;
    private static final int MAX_REASON = 500;

    /** A live location older than this is ignored and the worker's registered zone is used instead. */
    private static final Duration LIVE_LOCATION_MAX_AGE = Duration.ofHours(12);

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "OPEN", Set.of("ASSIGNED", "CANCELLED"),
        "ASSIGNED", Set.of("IN_PROGRESS", "OPEN", "CANCELLED"),
        "IN_PROGRESS", Set.of("SUBMITTED", "ASSIGNED", "CANCELLED"),
        "SUBMITTED", Set.of("IN_REVIEW", "APPROVED", "REJECTED"),
        "IN_REVIEW", Set.of("APPROVED", "REJECTED"),
        "REJECTED", Set.of("OPEN", "ASSIGNED"),
        "APPROVED", Set.of(),
        "CANCELLED", Set.of()
    );

    public TaskService(JdbcTemplate jdbc, AuditService audit, RoleAuthorization roleAuth) {
        this(jdbc, audit, roleAuth, null, null, null, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public TaskService(
        JdbcTemplate jdbc,
        AuditService audit,
        RoleAuthorization roleAuth,
        @org.springframework.beans.factory.annotation.Autowired(required = false) AreaScopeService areaScopeService,
        @org.springframework.beans.factory.annotation.Autowired(required = false) IdGeneratorService idGenerator,
        @org.springframework.beans.factory.annotation.Autowired(required = false) TaskRadiusSettings radius,
        @org.springframework.beans.factory.annotation.Autowired(required = false) NotificationEmails notificationEmails,
        @org.springframework.beans.factory.annotation.Autowired(required = false) InAppNotifier notifier
    ) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.roleAuth = roleAuth;
        this.areaScopeService = areaScopeService != null ? areaScopeService : new AreaScopeService(jdbc, roleAuth);
        this.idGenerator = idGenerator != null ? idGenerator : new IdGeneratorService(jdbc);
        this.radius = radius != null ? radius : TaskRadiusSettings.defaults();
        this.notificationEmails = notificationEmails;
        this.notifier = notifier != null ? notifier : new InAppNotifier(jdbc);
    }

    public record TaskView(
        UUID id, String displayId, String title, String description, String category, String status,
        String priority, UUID createdBy, String createdByName, String createdByRole, UUID assignedTo, UUID customerId,
        UUID checklistTemplateId, BigDecimal locationLat, BigDecimal locationLng,
        String locationArea, String locationAddress, String stateCode, Integer geofenceRadiusMeters, OffsetDateTime dueAt,
        BigDecimal rewardAmount, String currency, OffsetDateTime createdAt, OffsetDateTime updatedAt
    ) {
        public TaskView(
            UUID id, String title, String description, String category, String status,
            String priority, UUID createdBy, UUID assignedTo, UUID customerId,
            UUID checklistTemplateId, BigDecimal locationLat, BigDecimal locationLng,
            String locationArea, String locationAddress, String stateCode, OffsetDateTime dueAt,
            BigDecimal rewardAmount, String currency, OffsetDateTime createdAt, OffsetDateTime updatedAt
        ) {
            this(id, null, title, description, category, status, priority, createdBy, null, "ADMIN", assignedTo, customerId, checklistTemplateId, locationLat, locationLng, locationArea, locationAddress, stateCode, 200, dueAt, rewardAmount, currency, createdAt, updatedAt);
        }

        public TaskView(
            UUID id, String title, String description, String category, String status,
            String priority, UUID createdBy, UUID assignedTo, UUID customerId,
            UUID checklistTemplateId, BigDecimal locationLat, BigDecimal locationLng,
            String locationArea, String locationAddress, OffsetDateTime dueAt,
            BigDecimal rewardAmount, String currency, OffsetDateTime createdAt, OffsetDateTime updatedAt
        ) {
            this(id, null, title, description, category, status, priority, createdBy, null, "ADMIN", assignedTo, customerId, checklistTemplateId, locationLat, locationLng, locationArea, locationAddress, null, 200, dueAt, rewardAmount, currency, createdAt, updatedAt);
        }
    }

    public record CreateTaskCommand(
        String title, String description, String category, String priority,
        UUID checklistTemplateId, String locationArea, String locationAddress, String stateCode,
        Integer geofenceRadiusMeters, OffsetDateTime dueAt, BigDecimal rewardAmount, UUID actorId, UUID targetCustomerId,
        BigDecimal locationLat, BigDecimal locationLng
    ) {
        public CreateTaskCommand(
            String title, String description, String category, String priority,
            UUID checklistTemplateId, String locationArea, String locationAddress, String stateCode,
            Integer geofenceRadiusMeters, OffsetDateTime dueAt, BigDecimal rewardAmount, UUID actorId, UUID targetCustomerId
        ) {
            this(title, description, category, priority, checklistTemplateId, locationArea, locationAddress, stateCode,
                 geofenceRadiusMeters, dueAt, rewardAmount, actorId, targetCustomerId, null, null);
        }

        public CreateTaskCommand(
            String title, String description, String category, String priority,
            UUID checklistTemplateId, String locationArea, String locationAddress, String stateCode,
            OffsetDateTime dueAt, BigDecimal rewardAmount, UUID actorId, UUID targetCustomerId
        ) {
            this(title, description, category, priority, checklistTemplateId, locationArea, locationAddress, stateCode, 200, dueAt, rewardAmount, actorId, targetCustomerId);
        }

        public CreateTaskCommand(
            String title, String description, String category, String priority,
            UUID checklistTemplateId, String locationArea, String locationAddress,
            OffsetDateTime dueAt, BigDecimal rewardAmount, UUID actorId
        ) {
            this(title, description, category, priority, checklistTemplateId,
                 locationArea, locationAddress, null, 200, dueAt, rewardAmount, actorId, null);
        }
    }

    public List<TaskView> listTasks(UUID customerId) {
        return listTasks(customerId, null, null, null);
    }

    public List<TaskView> listTasks(UUID requestedCustomerId, Jwt jwt) {
        return listTasks(requestedCustomerId, null, null, jwt);
    }

    public List<TaskView> listTasks(UUID requestedCustomerId, String stateFilter, Jwt jwt) {
        return listTasks(requestedCustomerId, stateFilter, null, jwt);
    }

    public List<TaskView> listTasks(UUID requestedCustomerId, String stateFilter, String search, Jwt jwt) {
        StringBuilder sql = new StringBuilder("""
            SELECT t.id, t.display_id, t.title, t.description, t.category, t.status, t.priority, t.created_by,
                   p_creator.display_name AS created_by_name, t.created_by_role,
                   t.assigned_to, t.customer_id, t.checklist_template_id, t.location_lat,
                   t.location_lng, t.location_area, t.location_address, t.state_code, t.geofence_radius_meters, t.due_at,
                   t.reward_amount, t.currency, t.created_at, t.updated_at
            FROM tasks t
            LEFT JOIN app_profiles p_creator ON p_creator.id = t.created_by
            WHERE 1=1
            """);
        List<Object> params = new ArrayList<>();

        if (jwt != null) {
            UUID actorId = UUID.fromString(jwt.getSubject());
            List<String> roles = roleAuth.getRoles(jwt.getSubject());
            boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
            boolean isManager = roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

            if (isManager && !isAdmin) {
                sql.append(" AND t.state_code IN " + AreaScopeService.MANAGER_STATES_SUBQUERY + " ");
                params.add(actorId);
                if (stateFilter != null && !stateFilter.isBlank()) {
                    sql.append(" AND t.state_code = ? ");
                    params.add(stateFilter.trim().toUpperCase());
                }
            } else if (isAdmin) {
                if (stateFilter != null && !stateFilter.isBlank()) {
                    sql.append(" AND t.state_code = ? ");
                    params.add(stateFilter.trim().toUpperCase());
                }
            } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("CUSTOMER"))) {
                sql.append(" AND t.customer_id = ? ");
                params.add(actorId);
            } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("FIELD_WORKER") || r.equalsIgnoreCase("EMPLOYEE"))) {
                // Own tasks always; open tasks only within the worker radius (default 100 km).
                WorkerLocation worker = loadWorkerLocation(actorId);
                sql.append(" AND (t.assigned_to = ? OR (t.status = 'OPEN' AND ");
                params.add(actorId);
                appendOpenTaskReach(sql, params, worker);
                // Tasks this worker already declined or dropped are not offered to them again.
                sql.append(" AND NOT EXISTS (SELECT 1 FROM task_assignments x WHERE x.task_id = t.id AND x.employee_id = ?"
                    + " AND x.action IN ('REJECTED', 'DROPPED'))");
                params.add(actorId);
                sql.append(")) ");
            } else {
                return List.of();
            }

            if (requestedCustomerId != null) {
                sql.append(" AND t.customer_id = ? ");
                params.add(requestedCustomerId);
            }
        } else if (requestedCustomerId != null) {
            sql.append(" AND t.customer_id = ? ");
            params.add(requestedCustomerId);
        }

        if (search != null && !search.isBlank()) {
            String term = "%" + search.trim() + "%";
            sql.append(" AND (t.display_id ILIKE ? OR t.title ILIKE ? OR t.id::text ILIKE ?) ");
            params.add(term);
            params.add(term);
            params.add(term);
        }

        sql.append(" ORDER BY t.created_at DESC LIMIT 500");
        return jdbc.query(sql.toString(), (rs, n) -> mapRow(rs), params.toArray());
    }

    public TaskView getTask(UUID id) {
        return getTask(id.toString(), null);
    }

    public TaskView getTask(UUID id, Jwt jwt) {
        return getTask(id.toString(), jwt);
    }

    public TaskView getTask(String idOrDisplayId) {
        return getTask(idOrDisplayId, null);
    }

    public TaskView getTask(String idOrDisplayId, Jwt jwt) {
        if (idOrDisplayId == null || idOrDisplayId.isBlank()) {
            throw ApiException.badRequest("Task ID or display ID is required");
        }

        boolean isUuid = idOrDisplayId.trim().matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
        String sql = """
            SELECT t.id, t.display_id, t.title, t.description, t.category, t.status, t.priority, t.created_by,
                   p_creator.display_name AS created_by_name, t.created_by_role,
                   t.assigned_to, t.customer_id, t.checklist_template_id, t.location_lat,
                   t.location_lng, t.location_area, t.location_address, t.state_code, t.geofence_radius_meters, t.due_at,
                   t.reward_amount, t.currency, t.created_at, t.updated_at
            FROM tasks t
            LEFT JOIN app_profiles p_creator ON p_creator.id = t.created_by
            WHERE """ + (isUuid ? " t.id = ?" : " (t.display_id = ? OR t.display_id ILIKE ? OR (? ILIKE 'CH-%' AND t.display_id ILIKE ?))");

        List<TaskView> results;
        if (isUuid) {
            results = jdbc.query(sql, (rs, n) -> mapRow(rs), UUID.fromString(idOrDisplayId.trim()));
        } else {
            String trimmed = idOrDisplayId.trim().toUpperCase();
            String legacyMapped = "%" + trimmed.replace("CH-", "").replaceFirst("^0+", "") + "%";
            results = jdbc.query(sql, (rs, n) -> mapRow(rs), trimmed, trimmed, trimmed, legacyMapped);
        }

        if (results.isEmpty()) throw ApiException.notFound("Task", idOrDisplayId);
        TaskView task = results.get(0);

        if (jwt != null) {
            UUID actorId = UUID.fromString(jwt.getSubject());
            List<String> roles = roleAuth.getRoles(jwt.getSubject());
            boolean isAdmin = roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
            boolean isManager = roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

            if (isManager && !isAdmin) {
                if (!areaScopeService.managerCovers(actorId, task.stateCode())) {
                    // Foreign state returns 404 (not 403) so existence is not revealed
                    throw ApiException.notFound("Task", idOrDisplayId);
                }
            } else if (!isAdmin && !isManager) {
                if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("CUSTOMER"))) {
                    if (!actorId.equals(task.customerId())) {
                        throw ApiException.forbidden("You do not own this task");
                    }
                } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("FIELD_WORKER") || r.equalsIgnoreCase("EMPLOYEE"))) {
                    if (!actorId.equals(task.assignedTo()) && !"OPEN".equalsIgnoreCase(task.status())) {
                        throw ApiException.forbidden("You are not assigned to this task");
                    }
                }
            }
        }

        return task;
    }

    @Transactional
    public TaskView createTask(CreateTaskCommand cmd, Jwt jwt) {
        BigDecimal reward = cmd.rewardAmount() != null ? cmd.rewardAmount() : BigDecimal.ZERO;
        String category = cmd.category() != null ? cmd.category() : "Shelf audit";
        String priority = cmd.priority() != null ? cmd.priority().toUpperCase() : "NORMAL";

        UUID customerId = cmd.actorId();
        String creatorRole = "ADMIN";
        if (jwt != null) {
            List<String> roles = roleAuth.getRoles(jwt.getSubject());
            if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"))) {
                creatorRole = "ADMIN";
            } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("OPERATIONS"))) {
                creatorRole = "OPERATIONS";
            } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER"))) {
                creatorRole = "MANAGER";
            } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("CUSTOMER"))) {
                creatorRole = "CUSTOMER";
            }

            boolean isOpsOrAdmin = roles.stream().anyMatch(r ->
                r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));
            if (isOpsOrAdmin && cmd.targetCustomerId() != null) {
                var custCheck = jdbc.query("SELECT id FROM app_profiles WHERE id = ?",
                    (rs, n) -> rs.getObject("id", UUID.class), cmd.targetCustomerId());
                if (!custCheck.isEmpty()) {
                    customerId = cmd.targetCustomerId();
                }
            }
        }

        // State code resolution and verification
        String state = cmd.stateCode();
        if (state == null || state.isBlank()) {
            state = deriveStateFromLocation(cmd.locationArea(), cmd.locationAddress());
        } else {
            state = state.trim().toUpperCase();
            var exists = jdbc.query("SELECT code FROM states WHERE code = ?", (rs, n) -> rs.getString("code"), state);
            if (exists.isEmpty()) {
                throw ApiException.badRequest("Invalid state code: " + state + ". Must be a recognized Indian state/UT.");
            }
        }
        if (state == null || state.isBlank()) {
            throw ApiException.badRequest("Task location must belong to a verified Indian state (e.g. AP, TG, KA, MH). Tasks outside recognized states are rejected.");
        }

        // Coordinates drive the worker radius and the on-site geofence: both or neither, inside India.
        BigDecimal lat = cmd.locationLat();
        BigDecimal lng = cmd.locationLng();
        if ((lat == null) != (lng == null)) {
            throw ApiException.badRequest("Provide both latitude and longitude for the task location, or neither");
        }
        if (lat != null && !GeoDistance.isInIndia(lat.doubleValue(), lng.doubleValue())) {
            throw ApiException.badRequest("Task coordinates must be inside India");
        }

        UUID taskId = UUID.randomUUID();
        String displayId = idGenerator.nextTaskId(creatorRole);
        int geofenceRadius = cmd.geofenceRadiusMeters() != null ? cmd.geofenceRadiusMeters() : 200;

        jdbc.update("""
            INSERT INTO tasks (id, display_id, title, description, category, status, priority, created_by,
                               created_by_role, customer_id, checklist_template_id, location_area, location_address,
                               location_lat, location_lng, state_code, geofence_radius_meters, due_at, reward_amount, currency)
            VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR')
            """,
            taskId, displayId, cmd.title().trim(), cmd.description(), category, priority, cmd.actorId(),
            creatorRole, customerId, cmd.checklistTemplateId(), cmd.locationArea(), cmd.locationAddress(),
            lat, lng, state, geofenceRadius, cmd.dueAt() != null ? cmd.dueAt() : OffsetDateTime.now().plusDays(1), reward);

        audit.log(cmd.actorId(), "TASK_CREATED", "TASK", taskId,
            Map.of("displayId", displayId, "title", cmd.title(), "reward", reward.toString(), "state_code", state));

        // Zone managers see new work straight away (pop-up + bell); nearby workers find it in Nearby.
        Set<UUID> staff = new java.util.LinkedHashSet<>(notifier.zoneManagers(state));
        staff.remove(cmd.actorId());
        notifier.notifyAll(staff, "New task in your zone: " + displayId,
            cmd.title().trim() + (cmd.locationArea() != null ? " · " + cmd.locationArea() : "")
                + " · reward ₹" + reward.toPlainString() + ". Assign it to a nearby worker.",
            "TASK_CREATED", "TASK", taskId);

        return getTask(taskId);
    }

    @Transactional
    public TaskView createTask(CreateTaskCommand cmd) {
        return createTask(cmd, null);
    }

    private String deriveStateFromLocation(String area, String address) {
        String combined = ((area != null ? area : "") + " " + (address != null ? address : "")).toLowerCase();
        if (combined.contains("andhra") || combined.contains("ap") || combined.contains("tenali") ||
            combined.contains("guntur") || combined.contains("vijayawada") || combined.contains("amaravati")) {
            return "AP";
        }
        if (combined.contains("telangana") || combined.contains("tg") || combined.contains("hyderabad") || combined.contains("secunderabad")) {
            return "TG";
        }
        if (combined.contains("karnataka") || combined.contains("ka") || combined.contains("bengaluru") || combined.contains("bangalore")) {
            return "KA";
        }
        if (combined.contains("tamil") || combined.contains("tn") || combined.contains("chennai")) {
            return "TN";
        }
        if (combined.contains("maharashtra") || combined.contains("mh") || combined.contains("mumbai") || combined.contains("pune")) {
            return "MH";
        }
        if (combined.contains("delhi") || combined.contains("dl")) {
            return "DL";
        }
        // Fallback default for existing test fixtures
        return "AP";
    }

    @Transactional
    public TaskView assignTask(UUID taskId, UUID employeeId, UUID actorId) {
        TaskView task = getTask(taskId);
        if ("APPROVED".equalsIgnoreCase(task.status()) || "CANCELLED".equalsIgnoreCase(task.status())) {
            throw ApiException.badRequest("Cannot assign task in terminal state: " + task.status());
        }

        List<String> actorRoles = roleAuth.getRoles(actorId.toString());
        boolean isAdmin = actorRoles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"));
        boolean isManager = actorRoles.stream().anyMatch(r -> r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        if (isManager && !isAdmin) {
            if (!areaScopeService.managerCovers(actorId, task.stateCode())) {
                throw ApiException.notFound("Task", taskId);
            }
        }

        // Validate target employee eligibility: must exist, be ACTIVE, have employee role, and have matching state_code
        var employeeProfiles = jdbc.query("""
            SELECT p.id, p.account_status, p.state_code,
                   EXISTS(
                       SELECT 1 FROM app_role_assignments r
                       WHERE r.user_id = p.id
                         AND r.role IN ('EMPLOYEE', 'FIELD_WORKER', 'DRIVER', 'WAREHOUSE_STAFF')
                   ) as is_worker
            FROM app_profiles p
            WHERE p.id = ?
            """,
            (rs, n) -> new Object[] {
                rs.getString("account_status"),
                rs.getBoolean("is_worker"),
                rs.getString("state_code")
            },
            employeeId
        );

        if (employeeProfiles.isEmpty()) {
            throw ApiException.badRequest("Target employee not found");
        }
        Object rawRow = employeeProfiles.get(0);
        String empStatus = null;
        boolean isWorker = true;
        String empState = null;
        if (rawRow instanceof Object[] arr) {
            empStatus = arr.length > 0 && arr[0] instanceof String s ? s : null;
            isWorker = arr.length > 1 && arr[1] instanceof Boolean b ? b : false;
            empState = arr.length > 2 && arr[2] instanceof String s ? s : null;
        } else if (rawRow instanceof Map.Entry<?, ?> entry) {
            empStatus = entry.getKey() != null ? entry.getKey().toString() : null;
            isWorker = Boolean.TRUE.equals(entry.getValue());
        }

        if (!"ACTIVE".equalsIgnoreCase(empStatus)) {
            throw ApiException.badRequest("Target employee is not active (status: " + empStatus + ")");
        }
        if (!isWorker) {
            throw ApiException.badRequest("Target user does not have an eligible employee/field worker role");
        }

        // Strict state match: task state and worker state must match unless assigned by Admin
        if (!isAdmin && task.stateCode() != null && empState != null && !task.stateCode().equalsIgnoreCase(empState)) {
            throw ApiException.badRequest("Cross-state assignment forbidden: Task state (" + task.stateCode() + ") does not match worker state (" + empState + ")");
        }

        // Rapido-style: managers can only hand a task to a worker within the radius of the task
        // (live location if fresh, else their registered zone). Admins may override.
        if (!isAdmin) {
            WorkerLocation location = loadWorkerLocation(employeeId);
            if (location.stateCode() == null && empState != null) {
                location = new WorkerLocation(empState, location.reference());
            }
            try {
                assertTaskWithinReach(task, location);
            } catch (ApiException e) {
                throw ApiException.badRequest("This worker is outside the " + (int) radius.workerRadiusKm()
                    + " km task radius. Pick a nearer worker from the list.");
            }
        }

        UUID previousWorker = task.assignedTo();
        if (employeeId.equals(previousWorker) && "ASSIGNED".equalsIgnoreCase(task.status())) {
            throw ApiException.badRequest("The task is already assigned to this worker and waiting for them to accept");
        }

        // A task already being worked on can be re-assigned too; it waits for the new worker to accept.
        int rows = jdbc.update("""
            UPDATE tasks SET assigned_to = ?, status = 'ASSIGNED', updated_at = now()
            WHERE id = ? AND status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED')
            """, employeeId, taskId);

        if (rows == 0) {
            throw ApiException.badRequest("Cannot assign a task that is " + task.status().toLowerCase(Locale.ROOT).replace('_', ' '));
        }

        boolean reassigned = previousWorker != null && !previousWorker.equals(employeeId);
        if (reassigned) {
            jdbc.update("""
                INSERT INTO task_assignments (task_id, employee_id, action, reason)
                VALUES (?, ?, 'REVOKED', 'Re-assigned by manager')
                """, taskId, previousWorker);
        }
        jdbc.update("""
            INSERT INTO task_assignments (task_id, employee_id, action)
            VALUES (?, ?, 'OFFERED')
            """, taskId, employeeId);

        audit.log(actorId, reassigned ? "TASK_REASSIGNED" : "TASK_ASSIGNED", "TASK", taskId,
            Map.of("assigned_to", employeeId.toString(),
                "previous", previousWorker != null ? previousWorker.toString() : "",
                "task_state", task.stateCode() != null ? task.stateCode() : ""));

        String actorName = displayName(actorId);
        String code = codeOf(task);
        notifier.notify(employeeId, "New task assigned: " + code,
            task.title() + " — assigned by " + actorName + ". Open it to accept or decline.",
            "TASK_ASSIGNED", "TASK", taskId);
        if (reassigned) {
            notifier.notify(previousWorker, "Task re-assigned: " + code,
                task.title() + " was re-assigned to another worker by " + actorName + ". You no longer need to work on it.",
                "TASK_REASSIGNED", "TASK", taskId);
        }
        if (notificationEmails != null) {
            notificationEmails.taskAssigned(taskId, employeeId, reassigned ? previousWorker : null, actorName);
        }

        return getTask(taskId);
    }

    @Transactional
    public TaskView acceptTask(UUID taskId, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        TaskView task = getTask(taskId);

        // Verify worker active status and employee role
        var workerProfile = jdbc.query("""
            SELECT p.account_status, p.state_code,
                   EXISTS(SELECT 1 FROM app_role_assignments r WHERE r.user_id = p.id AND r.role IN ('EMPLOYEE', 'FIELD_WORKER')) as is_worker
            FROM app_profiles p WHERE p.id = ?
            """,
            (rs, n) -> new Object[] { rs.getString("account_status"), rs.getBoolean("is_worker"), rs.getString("state_code") },
            actorId
        );
        String status = null;
        boolean isWorker = true;
        String workerState = null;
        if (!workerProfile.isEmpty()) {
            Object raw = workerProfile.get(0);
            if (raw instanceof Object[] arr) {
                status = arr.length > 0 && arr[0] instanceof String s ? s : null;
                isWorker = arr.length > 1 && arr[1] instanceof Boolean b ? b : false;
                workerState = arr.length > 2 && arr[2] instanceof String s ? s : null;
            } else if (raw instanceof Map.Entry<?, ?> entry) {
                status = entry.getKey() != null ? entry.getKey().toString() : null;
                isWorker = Boolean.TRUE.equals(entry.getValue());
            }
        }
        if (!"ACTIVE".equalsIgnoreCase(status) || !isWorker) {
            throw ApiException.forbidden("Only active field workers may accept tasks");
        }

        // A task a manager assigned to this worker can be accepted wherever it is (the manager
        // decided). An open task must be within the worker radius of their location / zone.
        boolean offeredToMe = "ASSIGNED".equalsIgnoreCase(task.status()) && actorId.equals(task.assignedTo());
        if (!offeredToMe) {
            WorkerLocation location = loadWorkerLocation(actorId);
            if (location.stateCode() == null && workerState != null) {
                location = new WorkerLocation(workerState, location.reference());
            }
            assertTaskWithinReach(task, location);
        }

        // Atomic claim: an OPEN task, or an ASSIGNED task offered to *this* worker — never a task
        // assigned to someone else.
        int updated = jdbc.update("""
            UPDATE tasks
            SET assigned_to = ?, status = 'IN_PROGRESS', updated_at = now()
            WHERE id = ? AND (status = 'OPEN' OR (status = 'ASSIGNED' AND assigned_to = ?))
            """, actorId, taskId, actorId);

        if (updated == 0) {
            throw ApiException.conflict("This task is no longer available: it has already been accepted or assigned to another worker");
        }

        jdbc.update("""
            INSERT INTO task_assignments (task_id, employee_id, action)
            VALUES (?, ?, 'ACCEPTED')
            """, taskId, actorId);

        audit.log(actorId, "TASK_ACCEPTED", "TASK", taskId,
            Map.of("worker", actorId.toString()));

        // Queued in this transaction: sent only if the acceptance commits.
        if (notificationEmails != null) {
            notificationEmails.taskAccepted(taskId);
        }
        Set<UUID> watchers = new java.util.LinkedHashSet<>(notifier.zoneManagers(task.stateCode()));
        if (task.createdBy() != null) watchers.add(task.createdBy());
        if (task.customerId() != null) watchers.add(task.customerId());
        watchers.remove(actorId);
        notifier.notifyAll(watchers, "Task accepted: " + codeOf(task),
            displayName(actorId) + " accepted '" + task.title() + "' and is now working on it.",
            "TASK_ACCEPTED", "TASK", taskId);

        return getTask(taskId);
    }

    @Transactional
    public Map<String, Object> rejectOffer(UUID taskId, Jwt jwt) {
        return rejectOffer(taskId, null, jwt);
    }

    /**
     * A worker declines a task. If it was assigned to them it goes back to the open pool and the
     * zone managers, creator and admin are told (e-mail + pop-up) with the reason.
     */
    @Transactional
    public Map<String, Object> rejectOffer(UUID taskId, String reason, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        TaskView task = getTask(taskId);
        boolean assignedToMe = "ASSIGNED".equalsIgnoreCase(task.status()) && actorId.equals(task.assignedTo());
        String cleanReason = assignedToMe ? requireReason(reason, "declining") : trimToNull(reason);

        if (assignedToMe) {
            int rows = jdbc.update("""
                UPDATE tasks SET assigned_to = NULL, status = 'OPEN', updated_at = now()
                WHERE id = ? AND status = 'ASSIGNED' AND assigned_to = ?
                """, taskId, actorId);
            if (rows == 0) {
                throw ApiException.conflict("This task changed while you were declining it. Refresh and try again.");
            }
        }

        jdbc.update("""
            INSERT INTO task_assignments (task_id, employee_id, action, reason)
            VALUES (?, ?, 'REJECTED', ?)
            """, taskId, actorId, cleanReason);

        audit.log(actorId, "TASK_OFFER_REJECTED", "TASK", taskId,
            Map.of("worker", actorId.toString(), "was_assigned", assignedToMe, "reason", cleanReason != null ? cleanReason : ""));

        if (assignedToMe) {
            notifier.notifyAll(notifier.staffFor(task.stateCode(), actorId, task.createdBy()),
                "Task declined: " + codeOf(task),
                displayName(actorId) + " declined '" + task.title() + "'. Reason: " + cleanReason + ". It is open again: re-assign it.",
                "TASK_DECLINED", "TASK", taskId);
            if (notificationEmails != null) {
                notificationEmails.taskDeclined(taskId, actorId, cleanReason);
            }
        }

        return Map.of("taskId", taskId, "status", assignedToMe ? "DECLINED" : "OFFER_REJECTED", "workerId", actorId);
    }

    /**
     * The assigned worker drops a task part-way (accepted or in progress). A reason is required; the
     * task returns to the open pool and managers, the creator and admin are told.
     */
    @Transactional
    public TaskView dropTask(UUID taskId, String reason, Jwt jwt) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        TaskView task = getTask(taskId);
        if (!actorId.equals(task.assignedTo())) {
            throw ApiException.forbidden("You can only drop a task that is assigned to you");
        }
        String status = task.status().toUpperCase(Locale.ROOT);
        if (!Set.of("ASSIGNED", "IN_PROGRESS", "REJECTED").contains(status)) {
            throw ApiException.badRequest("A task that is " + status.toLowerCase(Locale.ROOT).replace('_', ' ')
                + " can no longer be dropped. Contact your operations manager.");
        }
        String cleanReason = requireReason(reason, "dropping");

        int rows = jdbc.update("""
            UPDATE tasks SET assigned_to = NULL, status = 'OPEN', updated_at = now()
            WHERE id = ? AND assigned_to = ? AND status IN ('ASSIGNED', 'IN_PROGRESS', 'REJECTED')
            """, taskId, actorId);
        if (rows == 0) {
            throw ApiException.conflict("This task changed while you were dropping it. Refresh and try again.");
        }

        jdbc.update("""
            INSERT INTO task_assignments (task_id, employee_id, action, reason)
            VALUES (?, ?, 'DROPPED', ?)
            """, taskId, actorId, cleanReason);

        audit.log(actorId, "TASK_DROPPED", "TASK", taskId,
            Map.of("worker", actorId.toString(), "previous_status", status, "reason", cleanReason));

        notifier.notifyAll(notifier.staffFor(task.stateCode(), actorId, task.createdBy()),
            "Task dropped: " + codeOf(task),
            displayName(actorId) + " dropped '" + task.title() + "'. Reason: " + cleanReason + ". It is open again: re-assign it.",
            "TASK_DROPPED", "TASK", taskId);
        if (notificationEmails != null) {
            notificationEmails.taskDropped(taskId, actorId, cleanReason);
        }

        return getTask(taskId);
    }

    /** A worker the task could be given to, nearest first. */
    public record EligibleWorker(UUID id, String displayId, String name, String zone, Double distanceKm,
                                 String locationSource, boolean withinRadius, int activeTasks) {}

    /**
     * Active field workers of the task's zone with their distance to the task (live location if
     * shared in the last 12 h, else registered zone), nearest first. Managers only for their zones.
     */
    public List<EligibleWorker> eligibleWorkers(UUID taskId, Jwt jwt) {
        TaskView task = getTask(taskId, jwt);
        GeoDistance.Point taskPoint = task.locationLat() != null && task.locationLng() != null
            ? new GeoDistance.Point(task.locationLat().doubleValue(), task.locationLng().doubleValue()) : null;
        double maxKm = radius.workerRadiusKm();
        OffsetDateTime freshAfter = OffsetDateTime.now(ZoneOffset.UTC).minus(LIVE_LOCATION_MAX_AGE);

        List<EligibleWorker> out = new ArrayList<>(jdbc.query("""
            SELECT p.id, p.display_id, p.display_name, p.zone_place, p.zone_district,
                   p.current_lat, p.current_lng, p.location_updated_at, p.zone_lat, p.zone_lng,
                   (SELECT COUNT(*) FROM tasks a WHERE a.assigned_to = p.id AND a.status IN ('ASSIGNED', 'IN_PROGRESS')) AS active_tasks
            FROM app_profiles p
            WHERE p.account_status = 'ACTIVE' AND p.state_code = ?
              AND EXISTS (SELECT 1 FROM app_role_assignments r WHERE r.user_id = p.id AND r.role IN ('EMPLOYEE', 'FIELD_WORKER'))
              AND NOT EXISTS (SELECT 1 FROM app_role_assignments r WHERE r.user_id = p.id AND r.role IN ('ADMIN', 'MANAGER', 'OPERATIONS'))
            """, (rs, n) -> {
                GeoDistance.Point point = null;
                String source = "NONE";
                BigDecimal curLat = rs.getBigDecimal("current_lat");
                BigDecimal curLng = rs.getBigDecimal("current_lng");
                OffsetDateTime seen = rs.getObject("location_updated_at", OffsetDateTime.class);
                BigDecimal zoneLat = rs.getBigDecimal("zone_lat");
                BigDecimal zoneLng = rs.getBigDecimal("zone_lng");
                if (curLat != null && curLng != null && seen != null && seen.isAfter(freshAfter)) {
                    point = new GeoDistance.Point(curLat.doubleValue(), curLng.doubleValue());
                    source = "LIVE";
                } else if (zoneLat != null && zoneLng != null) {
                    point = new GeoDistance.Point(zoneLat.doubleValue(), zoneLng.doubleValue());
                    source = "ZONE";
                }
                Double km = point != null && taskPoint != null
                    ? Math.round(GeoDistance.km(point.lat(), point.lng(), taskPoint.lat(), taskPoint.lng()) * 10) / 10.0 : null;
                // Without coordinates on either side the same-zone rule applies, so the worker is eligible.
                boolean within = km == null || km <= maxKm;
                return new EligibleWorker(rs.getObject("id", UUID.class), rs.getString("display_id"),
                    rs.getString("display_name"), joinZone(rs.getString("zone_place"), rs.getString("zone_district")),
                    km, source, within, rs.getInt("active_tasks"));
            }, task.stateCode()));
        out.sort(java.util.Comparator.comparing((EligibleWorker w) -> !w.withinRadius())
            .thenComparing(w -> w.distanceKm() == null ? Double.MAX_VALUE : w.distanceKm()));
        return out;
    }

    private static String codeOf(TaskView task) {
        return task.displayId() != null ? task.displayId() : task.id().toString().substring(0, 8);
    }

    private static String joinZone(String place, String district) {
        if (place == null || place.isBlank()) return district;
        if (district == null || district.isBlank()) return place;
        return place + ", " + district;
    }

    private String displayName(UUID userId) {
        if (userId == null) return "System";
        return jdbc.query("SELECT COALESCE(display_name, email) AS n FROM app_profiles WHERE id = ?",
                (rs, n) -> rs.getString("n"), userId)
            .stream().filter(v -> v != null && !v.isBlank()).findFirst().orElse("A team member");
    }

    private static String requireReason(String reason, String verb) {
        String clean = trimToNull(reason);
        if (clean == null || clean.length() < MIN_REASON) {
            throw ApiException.badRequest("Please give a reason for " + verb + " the task (at least " + MIN_REASON + " characters)");
        }
        if (clean.length() > MAX_REASON) {
            throw ApiException.badRequest("Keep the reason under " + MAX_REASON + " characters");
        }
        return clean;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim().replaceAll("\\s+", " ");
        return t.isEmpty() ? null : t;
    }

    @Transactional
    public TaskView cancelTask(UUID taskId, Jwt jwt) {
        TaskView task = getTask(taskId, jwt);
        UUID actorId = UUID.fromString(jwt.getSubject());

        if ("APPROVED".equalsIgnoreCase(task.status()) || "CANCELLED".equalsIgnoreCase(task.status())) {
            throw ApiException.badRequest("Cannot cancel task in terminal state: " + task.status());
        }

        jdbc.update("UPDATE tasks SET status = 'CANCELLED', updated_at = now() WHERE id = ?", taskId);

        audit.log(actorId, "TASK_CANCELLED", "TASK", taskId,
            Map.of("previous_status", task.status()));

        return getTask(taskId);
    }

    @Transactional
    public TaskView updateStatus(UUID taskId, String targetStatus, Jwt jwt) {
        String target = targetStatus.toUpperCase();
        TaskView task = getTask(taskId, jwt);
        String currentStatus = task.status().toUpperCase();

        if (jwt != null) {
            List<String> roles = roleAuth.getRoles(jwt.getSubject());
            if ("APPROVED".equals(target) && roles.stream().noneMatch(r ->
                    r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"))) {
                throw ApiException.forbidden("Only managers or administrators may approve tasks");
            }
        }

        Set<String> allowed = ALLOWED_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(target)) {
            throw ApiException.badRequest("Invalid state transition from " + currentStatus + " to " + target);
        }

        int updated = jdbc.update(
            "UPDATE tasks SET status = ?, updated_at = now() WHERE id = ? AND status = ?",
            target, taskId, currentStatus
        );
        if (updated == 0) {
            throw ApiException.conflict("Task status was concurrently modified by another process (expected " + currentStatus + ")");
        }

        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : task.createdBy();
        audit.log(actorId, "TASK_STATUS_CHANGED", "TASK", taskId,
            Map.of("old_status", currentStatus, "new_status", target));

        return getTask(taskId);
    }

    // ---------------------------------------------------------------- worker radius

    /** A worker's zone state and the point their task radius is measured from (null if unknown). */
    record WorkerLocation(String stateCode, GeoDistance.Point reference) {}

    /** Live location if fresh, otherwise the registered operational-zone point. */
    WorkerLocation loadWorkerLocation(UUID workerId) {
        return jdbc.query("""
            SELECT state_code, current_lat, current_lng, location_updated_at, zone_lat, zone_lng
            FROM app_profiles WHERE id = ?
            """,
            (rs, n) -> {
                GeoDistance.Point point = null;
                BigDecimal curLat = rs.getBigDecimal("current_lat");
                BigDecimal curLng = rs.getBigDecimal("current_lng");
                OffsetDateTime updated = rs.getObject("location_updated_at", OffsetDateTime.class);
                boolean fresh = updated != null
                    && updated.isAfter(OffsetDateTime.now(ZoneOffset.UTC).minus(LIVE_LOCATION_MAX_AGE));
                if (curLat != null && curLng != null && fresh) {
                    point = new GeoDistance.Point(curLat.doubleValue(), curLng.doubleValue());
                } else {
                    BigDecimal zoneLat = rs.getBigDecimal("zone_lat");
                    BigDecimal zoneLng = rs.getBigDecimal("zone_lng");
                    if (zoneLat != null && zoneLng != null) {
                        point = new GeoDistance.Point(zoneLat.doubleValue(), zoneLng.doubleValue());
                    }
                }
                return new WorkerLocation(rs.getString("state_code"), point);
            },
            workerId).stream().findFirst().orElse(new WorkerLocation(null, null));
    }

    /**
     * Appends the condition for an OPEN task to be within a worker's reach.
     * With a reference point: tasks within the radius; legacy tasks without coordinates fall back
     * to the worker's state. Without a point: same state only. With neither: nothing.
     */
    private void appendOpenTaskReach(StringBuilder sql, List<Object> params, WorkerLocation worker) {
        if (worker.reference() != null) {
            sql.append("(").append(GeoDistance.withinRadiusSql());
            params.addAll(GeoDistance.withinRadiusParams(worker.reference(), radius.workerRadiusKm()));
            if (worker.stateCode() != null) {
                sql.append(" OR ((t.location_lat IS NULL OR t.location_lng IS NULL) AND t.state_code = ?)");
                params.add(worker.stateCode());
            }
            sql.append(")");
        } else if (worker.stateCode() != null) {
            sql.append("t.state_code = ?");
            params.add(worker.stateCode());
        } else {
            sql.append("1 = 0");
        }
    }

    /** Same rule as {@link #appendOpenTaskReach}, for a single task, with a clear error. */
    private void assertTaskWithinReach(TaskView task, WorkerLocation worker) {
        double maxKm = radius.workerRadiusKm();
        if (task.locationLat() != null && task.locationLng() != null && worker.reference() != null) {
            double km = GeoDistance.km(worker.reference().lat(), worker.reference().lng(),
                task.locationLat().doubleValue(), task.locationLng().doubleValue());
            if (km > maxKm) {
                throw ApiException.forbidden(String.format(Locale.ROOT,
                    "This task is %.0f km away. You can only accept tasks within %.0f km of your location or operational zone.",
                    km, maxKm));
            }
            return;
        }
        if (worker.stateCode() == null || task.stateCode() == null || !worker.stateCode().equalsIgnoreCase(task.stateCode())) {
            throw ApiException.forbidden("You can only accept tasks in your registered operational zone");
        }
    }

    private TaskView mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        String createdByRole = null;
        try { createdByRole = rs.getString("created_by_role"); } catch (Exception ignored) {}
        String createdByName = null;
        try { createdByName = rs.getString("created_by_name"); } catch (Exception ignored) {}
        String displayId = null;
        try { displayId = rs.getString("display_id"); } catch (Exception ignored) {}
        Integer geofenceRadius = 200;
        try {
            int g = rs.getInt("geofence_radius_meters");
            if (!rs.wasNull()) geofenceRadius = g;
        } catch (Exception ignored) {}

        return new TaskView(
            rs.getObject("id", UUID.class),
            displayId,
            rs.getString("title"),
            rs.getString("description"),
            rs.getString("category"),
            rs.getString("status"),
            rs.getString("priority"),
            rs.getObject("created_by", UUID.class),
            createdByName,
            createdByRole != null ? createdByRole : "ADMIN",
            rs.getObject("assigned_to", UUID.class),
            rs.getObject("customer_id", UUID.class),
            rs.getObject("checklist_template_id", UUID.class),
            rs.getBigDecimal("location_lat"),
            rs.getBigDecimal("location_lng"),
            rs.getString("location_area"),
            rs.getString("location_address"),
            rs.getString("state_code"),
            geofenceRadius,
            rs.getObject("due_at", OffsetDateTime.class),
            rs.getBigDecimal("reward_amount"),
            rs.getString("currency") != null ? rs.getString("currency").trim() : "INR",
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
