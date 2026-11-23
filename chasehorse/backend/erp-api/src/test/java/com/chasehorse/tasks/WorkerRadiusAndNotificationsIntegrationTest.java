package com.chasehorse.tasks;

import com.chasehorse.area.AreaScopeService;
import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import com.chasehorse.common.IdGeneratorService;
import com.chasehorse.mail.EmailOutbox;
import com.chasehorse.mail.MailSettings;
import com.chasehorse.mail.NotificationEmails;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Runs the real SQL (H2, PostgreSQL mode) for the account-status gate, the 100 km worker radius,
 * safe task acceptance, and the queued notification e-mails.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE) // use the PostgreSQL-mode H2 from application.yml
@Import({
    RoleAuthorization.class, AuditService.class, AreaScopeService.class, IdGeneratorService.class,
    TaskService.class, EmailOutbox.class, NotificationEmails.class,
    WorkerRadiusAndNotificationsIntegrationTest.Beans.class
})
class WorkerRadiusAndNotificationsIntegrationTest {

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

    // Tenali (Guntur district, AP) and nearby / far-away points
    private static final double TENALI_LAT = 16.2598, TENALI_LNG = 80.6544;
    private static final double GUNTUR_LAT = 16.2997, GUNTUR_LNG = 80.4573;      // ~21 km
    private static final double HYDERABAD_LAT = 17.3850, HYDERABAD_LNG = 78.4867; // ~260 km

    @Autowired JdbcTemplate jdbc;
    @Autowired TaskService tasks;
    @Autowired RoleAuthorization roleAuth;

    UUID admin, manager, worker, otherWorker, customer;

    @BeforeEach
    void seed() {
        admin = profile("ACTIVE", "AP", "admin@chasehorse.com", null, null, "ADMIN");
        manager = profile("ACTIVE", "AP", "ap.manager@chasehorse.com", null, null, "OPERATIONS");
        jdbc.update("INSERT INTO manager_areas (manager_id, state_code, assigned_by) VALUES (?, 'AP', ?)", manager, admin);
        worker = profile("ACTIVE", "AP", "ravi.worker@example.com", TENALI_LAT, TENALI_LNG, "EMPLOYEE", "FIELD_WORKER");
        otherWorker = profile("ACTIVE", "AP", "other.worker@example.com", TENALI_LAT, TENALI_LNG, "EMPLOYEE", "FIELD_WORKER");
        customer = profile("ACTIVE", "AP", "ops@apexretail.example.com", null, null, "CUSTOMER");
    }

    // ------------------------------------------------------------ account status gate

    @Test
    @DisplayName("Only ACTIVE accounts pass role checks; pending, suspended and blocked do not")
    void nonActiveAccountsHaveNoRoleAccess() {
        assertThat(roleAuth.hasAny(auth(worker), "FIELD_WORKER")).isTrue();
        for (String status : List.of("PENDING", "SUSPENDED", "BLOCKED", "REJECTED")) {
            jdbc.update("UPDATE app_profiles SET account_status = ? WHERE id = ?", status, worker);
            assertThat(roleAuth.hasAny(auth(worker), "FIELD_WORKER")).as(status).isFalse();
        }
    }

    // ------------------------------------------------------------ 100 km radius

    @Test
    @DisplayName("Worker sees open tasks within 100 km of their zone, plus their own tasks anywhere")
    void workerTaskListRespectsRadius() {
        UUID near = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);
        UUID far = task("OPEN", "TG", HYDERABAD_LAT, HYDERABAD_LNG, null);
        UUID mineFar = task("ASSIGNED", "TG", HYDERABAD_LAT, HYDERABAD_LNG, worker);
        UUID legacySameState = task("OPEN", "AP", null, null, null);
        UUID legacyOtherState = task("OPEN", "TG", null, null, null);

        List<UUID> visible = tasks.listTasks(null, null, null, jwt(worker)).stream().map(TaskService.TaskView::id).toList();

        assertThat(visible).contains(near, mineFar, legacySameState).doesNotContain(far, legacyOtherState);
    }

    @Test
    @DisplayName("A fresh live location takes precedence over the registered zone")
    void liveLocationOverridesZone() {
        jdbc.update("UPDATE app_profiles SET current_lat = ?, current_lng = ?, location_updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            HYDERABAD_LAT, HYDERABAD_LNG, worker);
        UUID hyderabad = task("OPEN", "TG", HYDERABAD_LAT, HYDERABAD_LNG, null);
        UUID guntur = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);

        List<UUID> visible = tasks.listTasks(null, null, null, jwt(worker)).stream().map(TaskService.TaskView::id).toList();

        assertThat(visible).contains(hyderabad).doesNotContain(guntur);
    }

    @Test
    @DisplayName("Worker without zone or state sees no open tasks")
    void workerWithoutZoneSeesNoOpenTasks() {
        jdbc.update("UPDATE app_profiles SET zone_lat = NULL, zone_lng = NULL, state_code = NULL WHERE id = ?", worker);
        task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);

        assertThat(tasks.listTasks(null, null, null, jwt(worker))).isEmpty();
    }

    @Test
    @DisplayName("Accepting an open task more than 100 km away is refused")
    void acceptFarTaskForbidden() {
        UUID far = task("OPEN", "TG", HYDERABAD_LAT, HYDERABAD_LNG, null);

        ApiException ex = assertThrows(ApiException.class, () -> tasks.acceptTask(far, jwt(worker)));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertThat(ex.getMessage()).contains("within 100 km");
        assertThat(status(far)).isEqualTo("OPEN");
    }

    @Test
    @DisplayName("A task a manager assigned to this worker can be accepted even if far away")
    void acceptAssignedTaskAnywhere() {
        UUID assignedToMe = task("ASSIGNED", "TG", HYDERABAD_LAT, HYDERABAD_LNG, worker);

        tasks.acceptTask(assignedToMe, jwt(worker));

        assertThat(status(assignedToMe)).isEqualTo("IN_PROGRESS");
    }

    @Test
    @DisplayName("A worker cannot take over a task assigned to someone else")
    void cannotAcceptOtherWorkersTask() {
        UUID theirs = task("ASSIGNED", "AP", GUNTUR_LAT, GUNTUR_LNG, otherWorker);

        ApiException ex = assertThrows(ApiException.class, () -> tasks.acceptTask(theirs, jwt(worker)));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertThat(jdbc.queryForObject("SELECT assigned_to FROM tasks WHERE id = ?", UUID.class, theirs)).isEqualTo(otherWorker);
    }

    @Test
    @DisplayName("A pending (unapproved) worker cannot accept tasks")
    void pendingWorkerCannotAccept() {
        jdbc.update("UPDATE app_profiles SET account_status = 'PENDING' WHERE id = ?", worker);
        UUID near = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);

        ApiException ex = assertThrows(ApiException.class, () -> tasks.acceptTask(near, jwt(worker)));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    // ------------------------------------------------------------ e-mails

    @Test
    @DisplayName("Accepting a task queues the worker and customer e-mails with the right CCs, once")
    void acceptQueuesNotificationEmails() {
        UUID near = task("OPEN", "AP", GUNTUR_LAT, GUNTUR_LNG, null);
        jdbc.update("UPDATE tasks SET customer_id = ?, title = ? WHERE id = ?", customer, "Shelf audit <b>Aisle 4</b>", near);

        tasks.acceptTask(near, jwt(worker));

        Map<String, Object> toWorker = outbox("TASK_ACCEPTED_WORKER");
        assertThat(toWorker.get("TO_ADDRESSES")).isEqualTo("ravi.worker@example.com");
        assertThat((String) toWorker.get("CC_ADDRESSES")).contains("ap.manager@chasehorse.com", "ems.admin@chasehorse.com");
        assertThat(toWorker.get("FROM_ADDRESS")).isEqualTo("tech.support@chasehorse.com");
        // User-entered text is escaped in HTML
        assertThat((String) toWorker.get("BODY_HTML")).contains("&lt;b&gt;Aisle 4&lt;/b&gt;").doesNotContain("<b>Aisle 4</b>");

        Map<String, Object> toCustomer = outbox("TASK_ASSIGNED_CUSTOMER");
        assertThat(toCustomer.get("TO_ADDRESSES")).isEqualTo("ops@apexretail.example.com");
        assertThat((String) toCustomer.get("CC_ADDRESSES")).contains("ems.admin@chasehorse.com", "ap.manager@chasehorse.com");
        // The customer never receives the worker's personal e-mail address
        assertThat((String) toCustomer.get("BODY_TEXT")).doesNotContain("ravi.worker@example.com");

        // Re-queuing the same notification is a no-op
        new NotificationEmails(jdbc, new EmailOutbox(jdbc, new Beans().mailSettings()), new Beans().mailSettings()).taskAccepted(near);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM email_outbox", Integer.class)).isEqualTo(2);
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

    private Map<String, Object> outbox(String template) {
        return jdbc.queryForMap("SELECT * FROM email_outbox WHERE template = ?", template);
    }

    private static Jwt jwt(UUID subject) {
        return Jwt.withTokenValue("test").header("alg", "none").subject(subject.toString()).build();
    }

    private static JwtAuthenticationToken auth(UUID subject) {
        return new JwtAuthenticationToken(jwt(subject));
    }

}
