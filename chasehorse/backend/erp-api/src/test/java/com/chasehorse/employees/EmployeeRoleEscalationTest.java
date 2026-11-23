package com.chasehorse.employees;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmployeeController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "SUPABASE_JWT_ISSUER=https://phxybimufcrsnxfepiuz.supabase.co/auth/v1")
class EmployeeRoleEscalationTest {

    @Autowired private MockMvc mvc;
    @MockBean private JdbcTemplate jdbc;
    @MockBean(name = "roleAuthorization") private RoleAuthorization roleAuthorization;
    @MockBean private JwtDecoder jwtDecoder;

    @Test
    void nonAdminCannotEscalateRoleToAdmin() throws Exception {
        UUID actorId = UUID.randomUUID();
        UUID targetEmployeeId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.hasRole(actorId.toString(), "ADMIN")).thenReturn(false);

        mvc.perform(patch("/api/v1/employees/" + targetEmployeeId + "/approval")
                .with(jwt().jwt(j -> j.subject(actorId.toString())))
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
    void adminCanAssignManagerRoleSuccessfully() throws Exception {
        UUID adminId = UUID.randomUUID();
        UUID targetEmployeeId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.hasRole(adminId.toString(), "ADMIN")).thenReturn(true);

        EmployeeController.EmployeeView updatedView = new EmployeeController.EmployeeView(
            targetEmployeeId, "Ravi Shankar", "ravi@chasehorse.com", "+91 99999 88888",
            "Vijayawada", "ACTIVE", List.of("MANAGER"), OffsetDateTime.now()
        );

        when(jdbc.query(contains("SELECT id, account_status"), any(RowMapper.class), eq(targetEmployeeId)))
            .thenReturn(List.of("PENDING"));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(jdbc.update(anyString(), any(), any())).thenReturn(1);
        when(jdbc.update(anyString(), any(), any(), any())).thenReturn(1);
        when(jdbc.query(contains("display_name FROM app_profiles"), any(RowMapper.class), any()))
            .thenReturn(List.of("Admin"));
        when(jdbc.query(contains("state_code FROM app_profiles"), any(RowMapper.class), any()))
            .thenReturn(List.of("AP"));
        when(jdbc.query(contains("LEFT JOIN states"), any(RowMapper.class), any()))
            .thenReturn(List.of(updatedView));

        mvc.perform(patch("/api/v1/employees/" + targetEmployeeId + "/approval")
                .with(jwt().jwt(j -> j.subject(adminId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "status": "ACTIVE",
                      "role": "MANAGER"
                    }
                    """))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.id").value(targetEmployeeId.toString()))
           .andExpect(jsonPath("$.accountStatus").value("ACTIVE"))
           .andExpect(jsonPath("$.roles[0]").value("MANAGER"));
    }
}
