package com.chasehorse.tasks;

import com.chasehorse.area.AdminAreaController;
import com.chasehorse.area.AreaScope;
import com.chasehorse.area.AreaScopeService;
import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import com.chasehorse.common.IdGeneratorService;
import com.chasehorse.mail.EmailOutbox;
import com.chasehorse.mail.MailSettings;
import com.chasehorse.mail.NotificationEmails;
import com.chasehorse.notifications.InAppNotifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Real SQL (H2, PostgreSQL mode) for multi-zone operations managers and the task lifecycle:
 * assign / re-assign within the radius, decline and drop with reasons, pop-up notifications and
 * the queued e-mails.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({
    RoleAuthorization.class, AuditService.class, AreaScopeService.class, IdGeneratorService.class,
    TaskService.class, EmailOutbox.class, NotificationEmails.class, InAppNotifier.class,
    TaskLifecycleAndZonesIntegrationTest.Beans.class
})
class TaskLifecycleAndZonesIntegrationTest {

    @TestConfiguration
    static class Beans {
        @Bean MailSettings mailSettings() {
            return new MailSettings(false, "tech.support@chasehorse.com", "ChaseHorse Support",
                "ems.admin@chasehorse.com", "https://app.example.test");
        }
        @Bean TaskRadiusSettings taskRadiusSettings() {
            return new TaskRadiusSettings(100);
        }
    }

    private static final double TENALI_LAT = 16.2598, TENALI_LNG = 80.6544;
    private static final double GUNTUR_LAT = 16.2997, GUNTUR_LNG = 80.4573;       // ~21 km from Tenali
    private static final double VIZAG_LAT = 17.6868, VIZAG_LNG = 83.2185;        // ~330 km, still AP
    private static final double HYDERABAD_LAT = 17.3850, HYDERABAD_LNG = 78.4867; // TG

    @Autowired JdbcTemplate jdbc;
    @Autowired TaskService tasks;
    @Autowired AreaScopeService areas;
    @Autowired AuditService audit;

    UUID admin, apTgManager, kaManager, worker, otherWorker, farWorker;

    @BeforeEach
    void seed() {
        admin = profile("ACTIVE", "AP", "admin@chasehorse.com", null, null, "ADMIN");
        apTgManager = profile("ACTIVE", "AP", "south.manager@chasehorse.com", null, null, "OPERATIONS");
        kaManager = profile("ACTIVE", "KA", "ka.manager@chasehorse.com", null, null, "MANAGER");
        AdminAreaController zones = new AdminAreaController(jdbc, audit);
        zones.assignManagerArea(apTgManager, new AdminAreaController.AssignAreaRequest(null, List.of("AP", "TG")), jwt(admin));
        zones.assignManagerArea(kaManager, new AdminAreaController.AssignAreaRequest("KA", null), jwt(admin));
        worker = profile("ACTIVE", "AP", "ravi@example.com", TENALI_LAT, TENALI_LNG, "EMPLOYEE", "FIELD_WORKER");
        otherWorker = profile("ACTIVE", "AP", "sita@example.com", GUNTUR_LAT, GUNTUR_LNG, "EMPLOYEE", "FIELD_WORKER");
        farWorker = profile("ACTIVE", "AP", "vizag@example.com", VIZAG_LAT, VIZAG_LNG, "EMPLOYEE", "FIELD_WORKER");
    }

    // ------------------------------------------------------------ multi-zone managers

    @Test
    @DisplayName("Admin gives a manager several zones; the manager sees tasks of all of them and nothing else")
    void multiZoneManagerSeesAllAssignedZones() {
        UUID ap = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);
        UUID tg = task("OPEN", "TG", HYDERABAD_LAT, HYDERABAD_LNG, null);
        UUID ka = task("OPEN", "KA", 12.97, 77.59, null);

        List<UUID> visible = tasks.listTasks(null, null, null, jwt(apTgManager)).stream().map(TaskService.TaskView::id).toList();
        assertThat(visible).contains(ap, tg).doesNotContain(ka);

        ApiException hidden = assertThrows(ApiException.class, () -> tasks.getTask(ka, jwt(apTgManager)));
        assertEquals(HttpStatus.NOT_FOUND, hidden.getStatus());

        List<UUID> kaView = tasks.listTasks(null, null, null, jwt(kaManager)).stream().map(TaskService.TaskView::id).toList();
        assertThat(kaView).containsExactly(ka);
    }

    @Test
    @DisplayName("Changing a manager's zones replaces the set; a manager cannot widen it with a filter")
    void zoneSetIsReplacedAndCannotBeWidened() {
        new AdminAreaController(jdbc, audit)
            .assignManagerArea(apTgManager, new AdminAreaController.AssignAreaRequest(null, List.of("TG")), jwt(admin));
        assertThat(areas.getManagerAssignedStates(apTgManager)).containsExactly("TG");

        AreaScope scope = areas.resolveScope(auth(apTgManager), "AP");
        assertThat(scope.stateCodes()).containsExactly("TG");
        assertThat(scope.coversState("AP")).isFalse();
        assertThat(scope.coversState("TG")).isTrue();
    }

    @Test
    @DisplayName("Only people with a manager role can be given zones")
    void zonesOnlyForManagers() {
        ApiException ex = assertThrows(ApiException.class, () -> new AdminAreaController(jdbc, audit)
            .assignManagerArea(worker, new AdminAreaController.AssignAreaRequest(null, List.of("AP")), jwt(admin)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    // ------------------------------------------------------------ assign / re-assign

    @Test
    @DisplayName("Assigning notifies the worker (pop-up + e-mail, CC manager and admin)")
    void assignNotifiesWorker() {
        UUID t = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);

        tasks.assignTask(t, worker, apTgManager);

        assertThat(status(t)).isEqualTo("ASSIGNED");
        assertThat(notifications(worker, "TASK_ASSIGNED")).isEqualTo(1);
        var mail = jdbc.queryForMap("SELECT * FROM email_outbox WHERE template = 'TASK_ASSIGNED_WORKER'");
        assertThat(mail.get("TO_ADDRESSES").toString()).contains("ravi@example.com");
        assertThat(mail.get("CC_ADDRESSES").toString()).contains("south.manager@chasehorse.com", "ems.admin@chasehorse.com");
    }

    @Test
    @DisplayName("A manager cannot assign a worker outside the task radius; an admin can")
    void radiusLimitsManagerAssignment() {
        UUID t = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);

        ApiException ex = assertThrows(ApiException.class, () -> tasks.assignTask(t, farWorker, apTgManager));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertThat(ex.getMessage()).contains("outside the 100 km");

        tasks.assignTask(t, farWorker, admin);
        assertThat(status(t)).isEqualTo("ASSIGNED");
    }

    @Test
    @DisplayName("A manager of another zone cannot assign the task (hidden as 404)")
    void otherZoneManagerCannotAssign() {
        UUID t = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);
        ApiException ex = assertThrows(ApiException.class, () -> tasks.assignTask(t, worker, kaManager));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    @DisplayName("Re-assigning an in-progress task tells the previous worker and records the hand-over")
    void reassignTellsPreviousWorker() {
        UUID t = task("IN_PROGRESS", "AP", GUNTUR_LAT, GUNTUR_LNG, worker);

        tasks.assignTask(t, otherWorker, apTgManager);

        assertThat(jdbc.queryForObject("SELECT assigned_to FROM tasks WHERE id = ?", UUID.class, t)).isEqualTo(otherWorker);
        assertThat(status(t)).isEqualTo("ASSIGNED");
        assertThat(notifications(worker, "TASK_REASSIGNED")).isEqualTo(1);
        assertThat(notifications(otherWorker, "TASK_ASSIGNED")).isEqualTo(1);
        assertThat(count("SELECT COUNT(*) FROM email_outbox WHERE template = 'TASK_REASSIGNED_AWAY'")).isEqualTo(1);
        assertThat(count("SELECT COUNT(*) FROM task_assignments WHERE task_id = '" + t + "' AND action = 'REVOKED'")).isEqualTo(1);
    }

    // ------------------------------------------------------------ decline / drop

    @Test
    @DisplayName("Declining an assigned task needs a reason, reopens it and tells the managers")
    void declineWithReason() {
        UUID t = task("ASSIGNED", "AP", GUNTUR_LAT, GUNTUR_LNG, worker);

        ApiException noReason = assertThrows(ApiException.class, () -> tasks.rejectOffer(t, " ", jwt(worker)));
        assertEquals(HttpStatus.BAD_REQUEST, noReason.getStatus());
        assertThat(status(t)).isEqualTo("ASSIGNED");

        tasks.rejectOffer(t, "Not available at that time", jwt(worker));

        assertThat(status(t)).isEqualTo("OPEN");
        assertThat(jdbc.queryForObject("SELECT assigned_to FROM tasks WHERE id = ?", UUID.class, t)).isNull();
        assertThat(notifications(apTgManager, "TASK_DECLINED")).isEqualTo(1);
        assertThat(notifications(kaManager, "TASK_DECLINED")).isZero();
        var mail = jdbc.queryForMap("SELECT * FROM email_outbox WHERE template = 'TASK_DECLINED'");
        assertThat(mail.get("TO_ADDRESSES").toString()).contains("south.manager@chasehorse.com");
        assertThat(mail.get("BODY_TEXT").toString()).contains("Not available at that time");

        // the task is not offered to the same worker again
        List<UUID> visible = tasks.listTasks(null, null, null, jwt(worker)).stream().map(TaskService.TaskView::id).toList();
        assertThat(visible).doesNotContain(t);
        List<UUID> others = tasks.listTasks(null, null, null, jwt(otherWorker)).stream().map(TaskService.TaskView::id).toList();
        assertThat(others).contains(t);
    }

    @Test
    @DisplayName("The assigned worker can drop a task part-way with a reason; it reopens and everyone is told")
    void dropInProgressTask() {
        UUID t = task("IN_PROGRESS", "AP", GUNTUR_LAT, GUNTUR_LNG, worker);

        ApiException notMine = assertThrows(ApiException.class, () -> tasks.dropTask(t, "Vehicle breakdown", jwt(otherWorker)));
        assertEquals(HttpStatus.FORBIDDEN, notMine.getStatus());

        tasks.dropTask(t, "Vehicle breakdown", jwt(worker));

        assertThat(status(t)).isEqualTo("OPEN");
        assertThat(count("SELECT COUNT(*) FROM task_assignments WHERE task_id = '" + t + "' AND action = 'DROPPED'")).isEqualTo(1);
        assertThat(notifications(apTgManager, "TASK_DROPPED")).isEqualTo(1);
        assertThat(notifications(admin, "TASK_DROPPED")).isEqualTo(1);
        assertThat(count("SELECT COUNT(*) FROM email_outbox WHERE template = 'TASK_DROPPED'")).isEqualTo(1);
        assertThat(count("SELECT COUNT(*) FROM email_outbox WHERE template = 'TASK_DROPPED_WORKER'")).isEqualTo(1);
    }

    @Test
    @DisplayName("A submitted task can no longer be dropped")
    void cannotDropSubmittedTask() {
        UUID t = task("SUBMITTED", "AP", GUNTUR_LAT, GUNTUR_LNG, worker);
        ApiException ex = assertThrows(ApiException.class, () -> tasks.dropTask(t, "Changed my mind", jwt(worker)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertThat(status(t)).isEqualTo("SUBMITTED");
    }

    // ------------------------------------------------------------ nearest workers

    @Test
    @DisplayName("Eligible workers are listed nearest first, with far ones flagged outside the radius")
    void eligibleWorkersNearestFirst() {
        UUID t = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);

        List<TaskService.EligibleWorker> list = tasks.eligibleWorkers(t, jwt(apTgManager));

        assertThat(list).extracting(TaskService.EligibleWorker::id).containsExactly(otherWorker, worker, farWorker);
        assertThat(list.get(0).distanceKm()).isLessThan(1.0);
        assertThat(list.get(1).withinRadius()).isTrue();
        assertThat(list.get(2).withinRadius()).isFalse();
        assertThat(list.get(0).locationSource()).isEqualTo("ZONE");
    }

    @Test
    @DisplayName("Accepting notifies the zone manager")
    void acceptNotifiesManager() {
        UUID t = task("ASSIGNED", "AP", GUNTUR_LAT, GUNTUR_LNG, worker);
        tasks.acceptTask(t, jwt(worker));
        assertThat(notifications(apTgManager, "TASK_ACCEPTED")).isEqualTo(1);
    }

    // ------------------------------------------------------------ helpers

    private UUID profile(String status, String state, String email, Double zoneLat, Double zoneLng, String... roles) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO app_profiles (id, display_name, email, state_code, account_status, zone_lat, zone_lng, email_verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, id, email.split("@")[0], email, state, status, zoneLat, zoneLng);
        for (String role : roles) {
            jdbc.update("INSERT INTO app_role_assignments (user_id, role) VALUES (?, ?)", id, role);
        }
        return id;
    }

    private UUID task(String status, String state, Double lat, Double lng, UUID assignedTo) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO tasks (id, display_id, title, status, state_code, created_by, assigned_to,
                               location_lat, location_lng, location_area, reward_amount)
            VALUES (?, ?, 'Shelf audit', ?, ?, ?, ?, ?, ?, 'Test area', ?)
            """, id, "TSK-" + id.toString().substring(0, 6).toUpperCase(), status, state, admin, assignedTo,
            lat == null ? null : BigDecimal.valueOf(lat), lng == null ? null : BigDecimal.valueOf(lng), BigDecimal.valueOf(450));
        return id;
    }

    private String status(UUID taskId) {
        return jdbc.queryForObject("SELECT status FROM tasks WHERE id = ?", String.class, taskId);
    }

    private int notifications(UUID userId, String type) {
        return count("SELECT COUNT(*) FROM notifications WHERE user_id = '" + userId + "' AND type = '" + type + "'");
    }

    private int count(String sql) {
        Integer n = jdbc.queryForObject(sql, Integer.class);
        return n == null ? 0 : n;
    }

    private static Jwt jwt(UUID subject) {
        return Jwt.withTokenValue("test").header("alg", "none").subject(subject.toString()).build();
    }

    private static JwtAuthenticationToken auth(UUID subject) {
        return new JwtAuthenticationToken(jwt(subject));
    }
}
