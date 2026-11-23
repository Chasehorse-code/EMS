package com.chasehorse.tickets;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.ApiException;
import com.chasehorse.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TicketController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "SUPABASE_JWT_ISSUER=https://phxybimufcrsnxfepiuz.supabase.co/auth/v1")
class TicketSecurityTest {

    @Autowired private MockMvc mvc;
    @MockBean private TicketService ticketService;
    @MockBean(name = "roleAuthorization") private RoleAuthorization roleAuthorization;
    @MockBean private JwtDecoder jwtDecoder;

    @Test
    void customerCannotViewAnotherCustomersTicket() throws Exception {
        UUID customerA = UUID.randomUUID();
        UUID ticketId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.getRoles(customerA.toString())).thenReturn(List.of("CUSTOMER"));
        when(ticketService.getTicket(eq(ticketId.toString()), any()))
            .thenThrow(ApiException.forbidden("You do not have permission to view this ticket"));

        mvc.perform(get("/api/v1/tickets/" + ticketId)
                .with(jwt().jwt(j -> j.subject(customerA.toString()))))
           .andExpect(status().isForbidden())
           .andExpect(jsonPath("$.message").value("You do not have permission to view this ticket"));
    }

    @Test
    void customerCanCreateTicketSuccessfully() throws Exception {
        UUID customerA = UUID.randomUUID();
        UUID ticketId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.getRoles(customerA.toString())).thenReturn(List.of("CUSTOMER"));

        TicketService.TicketView created = new TicketService.TicketView(
            ticketId, "TKT-1001", customerA, "Acme Corp", null, null, null,
            "Geofence expansion issue", "OPERATIONS", "HIGH", "OPEN", "Vijayawada",
            OffsetDateTime.now(), OffsetDateTime.now(), null, List.of(), List.of()
        );

        when(ticketService.createTicket(any(), any())).thenReturn(created);

        mvc.perform(post("/api/v1/tickets")
                .with(jwt().jwt(j -> j.subject(customerA.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "subject": "Geofence expansion issue",
                      "category": "OPERATIONS",
                      "urgency": "HIGH",
                      "message": "Store perimeter requires 50m expansion for accurate worker check-ins."
                    }
                    """))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.id").value(ticketId.toString()))
           .andExpect(jsonPath("$.ticketNumber").value("TKT-1001"))
           .andExpect(jsonPath("$.status").value("OPEN"))
           .andExpect(jsonPath("$.urgency").value("HIGH"));
    }

    @Test
    void staffCanAssignTicket() throws Exception {
        UUID managerId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        UUID ticketId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.getRoles(managerId.toString())).thenReturn(List.of("MANAGER"));

        TicketService.TicketView assigned = new TicketService.TicketView(
            ticketId, "TKT-1001", UUID.randomUUID(), "Acme Corp", staffId, "Operations Specialist", null,
            "Geofence expansion issue", "OPERATIONS", "HIGH", "ASSIGNED", "Vijayawada",
            OffsetDateTime.now(), OffsetDateTime.now(), null, List.of(), List.of()
        );

        when(ticketService.assignTicket(eq(ticketId), eq(staffId), any())).thenReturn(assigned);

        mvc.perform(post("/api/v1/tickets/" + ticketId + "/assign")
                .with(jwt().jwt(j -> j.subject(managerId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"staffId\":\"" + staffId + "\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.assignedTo").value(staffId.toString()))
           .andExpect(jsonPath("$.status").value("ASSIGNED"));
    }
}
