package com.chasehorse.area;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.config.SecurityConfig;
import com.chasehorse.employees.EmployeeController;
import com.chasehorse.tasks.TaskController;
import com.chasehorse.tasks.TaskService;
import com.chasehorse.tickets.TicketController;
import com.chasehorse.tickets.TicketService;
import com.chasehorse.wallets.WalletController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({
    EmployeeController.class,
    TaskController.class,
    WalletController.class,
    TicketController.class,
    AreaController.class,
    AdminAreaController.class
})
@Import({SecurityConfig.class, com.chasehorse.config.MethodSecurityConfig.class})
@TestPropertySource(properties = "SUPABASE_JWT_ISSUER=https://phxybimufcrsnxfepiuz.supabase.co/auth/v1")
class AreaBasedAccessTest {

    @Autowired private MockMvc mvc;
    @MockBean private org.springframework.jdbc.core.JdbcTemplate jdbc;
    @MockBean(name = "roleAuthorization") private RoleAuthorization roleAuthorization;
    @MockBean private AreaScopeService areaScopeService;
    @MockBean private TaskService taskService;
    @MockBean private TicketService ticketService;
    @MockBean private com.chasehorse.common.AuditService auditService;
    @MockBean private JwtDecoder jwtDecoder;

    private UUID managerApId;
    private UUID workerApId;
    private UUID workerTgId;
    private UUID taskTgId;
    private UUID ticketTgId;
    private UUID adminId;

    @BeforeEach
    void setup() {
        managerApId = UUID.randomUUID();
        workerApId = UUID.randomUUID();
        workerTgId = UUID.randomUUID();
        taskTgId = UUID.randomUUID();
        ticketTgId = UUID.randomUUID();
        adminId = UUID.randomUUID();

        lenient().when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        lenient().when(roleAuthorization.hasAny(any(), any(), any())).thenReturn(true);
        lenient().when(roleAuthorization.hasAny(any(), any(), any(), any())).thenReturn(true);
        lenient().when(roleAuthorization.hasAny(any(), any(), any(), any(), any())).thenReturn(true);
        lenient().when(roleAuthorization.hasAny(any(), any(String[].class))).thenReturn(true);
    }

    @Test
    void managerDirectAccessToForeignStateEmployeeReturns404() throws Exception {
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(areaScopeService.resolveScope(any(), any()))
            .thenReturn(new AreaScope(managerApId, false, true, false, "AP"));
        doThrow(ApiException.notFound("Employee", workerTgId))
            .when(areaScopeService).assertCanAccessEmployee(any(), eq(workerTgId));

        mvc.perform(get("/api/v1/employees/" + workerTgId)
                .with(jwt().jwt(j -> j.subject(managerApId.toString()))))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.message").value("Employee not found: " + workerTgId));
    }

    @Test
    void managerDirectAccessToForeignStateTaskReturns404() throws Exception {
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(taskService.getTask(eq(taskTgId.toString()), any()))
            .thenThrow(ApiException.notFound("Task", taskTgId));

        mvc.perform(get("/api/v1/tasks/" + taskTgId)
                .with(jwt().jwt(j -> j.subject(managerApId.toString()))))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.message").value("Task not found: " + taskTgId));
    }

    @Test
    void managerDirectAccessToForeignStateWalletTransactionsReturns404() throws Exception {
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(areaScopeService.resolveScope(any(), any()))
            .thenReturn(new AreaScope(managerApId, false, true, false, "AP"));
        doThrow(ApiException.notFound("Wallet", workerTgId))
            .when(areaScopeService).assertCanAccessWallet(any(), eq(workerTgId));

        mvc.perform(get("/api/v1/wallets/" + workerTgId + "/transactions")
                .with(jwt().jwt(j -> j.subject(managerApId.toString()))))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.message").value("Wallet not found: " + workerTgId));
    }

    @Test
    void managerDirectAccessToForeignStateTicketReturns404() throws Exception {
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(ticketService.getTicket(eq(ticketTgId.toString()), any()))
            .thenThrow(ApiException.notFound("SupportTicket", ticketTgId));

        mvc.perform(get("/api/v1/tickets/" + ticketTgId)
                .with(jwt().jwt(j -> j.subject(managerApId.toString()))))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.message").value("SupportTicket not found: " + ticketTgId));
    }

    @Test
    void managerCannotAssignRoleToEmployeeRejectedWith403() throws Exception {
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(areaScopeService.resolveScope(any(), any()))
            .thenReturn(new AreaScope(managerApId, false, true, false, "AP"));

        mvc.perform(patch("/api/v1/employees/" + workerApId + "/approval")
                .with(jwt().jwt(j -> j.subject(managerApId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "status": "ACTIVE",
                      "role": "ADMIN"
                    }
                    """))
           .andExpect(status().isForbidden())
           .andExpect(jsonPath("$.message").value("Only administrators can assign or modify application roles"));
    }

    @Test
    void managerCannotAssignThemselvesArea() throws Exception {
        when(roleAuthorization.hasAny(any(), eq("ADMIN"))).thenReturn(false);
        when(roleAuthorization.hasAny(any(), any(String.class))).thenReturn(false);
        when(roleAuthorization.hasAny(any(), any(String[].class))).thenReturn(false);
        when(roleAuthorization.hasAny(any(), any())).thenReturn(false);

        mvc.perform(put("/api/v1/admin/managers/" + managerApId + "/area")
                .with(jwt().jwt(j -> j.subject(managerApId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stateCode\":\"TG\"}"))
           .andExpect(status().isForbidden());
    }

    @Test
    void adminCanAssignManagerArea() throws Exception {
        when(roleAuthorization.hasAny(any(), any(String[].class))).thenReturn(true);
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);

        when(jdbc.query(contains("FROM app_role_assignments WHERE user_id"), any(org.springframework.jdbc.core.RowMapper.class), eq(managerApId)))
            .thenReturn(List.of(1));
        when(jdbc.query(contains("FROM states WHERE code"), any(org.springframework.jdbc.core.RowMapper.class), eq("TG")))
            .thenReturn(List.of("Telangana"));

        AdminAreaController.Row mockAssignment = new AdminAreaController.Row(
            managerApId, "Chaitanya Ops", "opsdemo@chasehorse.com", "TG", "Telangana", adminId, OffsetDateTime.now()
        );

        when(jdbc.query(contains("SELECT p.id AS manager_id"), any(org.springframework.jdbc.core.RowMapper.class), eq(managerApId)))
            .thenReturn(List.of(mockAssignment));

        mvc.perform(put("/api/v1/admin/managers/" + managerApId + "/area")
                .with(jwt().jwt(j -> j.subject(adminId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stateCode\":\"TG\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.managerId").value(managerApId.toString()))
           .andExpect(jsonPath("$.stateCode").value("TG"))
           .andExpect(jsonPath("$.stateName").value("Telangana"));
    }

    @Test
    void managerStateBannerReturnsAssignedState() throws Exception {
        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(areaScopeService.resolveScope(any(), any()))
            .thenReturn(new AreaScope(managerApId, false, true, false, "AP"));
        when(jdbc.query(contains("FROM manager_areas ma JOIN states"), any(org.springframework.jdbc.core.RowMapper.class), eq(managerApId)))
            .thenReturn(List.of(new AreaController.StateView("AP", "Andhra Pradesh")));

        mvc.perform(get("/api/v1/areas/my-area")
                .with(jwt().jwt(j -> j.subject(managerApId.toString()))))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.stateCode").value("AP"))
           .andExpect(jsonPath("$.stateName").value("Andhra Pradesh"))
           .andExpect(jsonPath("$.isAssigned").value(true));
    }
}
