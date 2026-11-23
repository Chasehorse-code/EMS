package com.chasehorse.tasks;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.common.AuditService;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FeedbackController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "SUPABASE_JWT_ISSUER=https://phxybimufcrsnxfepiuz.supabase.co/auth/v1")
class FeedbackSecurityTest {

    @Autowired private MockMvc mvc;
    @MockBean private JdbcTemplate jdbc;
    @MockBean private AuditService audit;
    @MockBean(name = "roleAuthorization") private RoleAuthorization roleAuthorization;
    @MockBean private JwtDecoder jwtDecoder;

    @Test
    void customerCannotSubmitFeedbackForUnapprovedTask() throws Exception {
        UUID customerId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.getRoles(customerId.toString())).thenReturn(List.of("CUSTOMER"));

        // Task is IN_PROGRESS, not APPROVED
        when(jdbc.query(anyString(), any(RowMapper.class), eq(taskId))).thenReturn(List.of(Map.of(
            "title", "Shelf Audit",
            "customer_id", customerId,
            "assigned_to", UUID.randomUUID(),
            "has_worker", true,
            "status", "IN_PROGRESS"
        )));

        mvc.perform(post("/api/v1/tasks/" + taskId + "/feedback")
                .with(jwt().jwt(j -> j.subject(customerId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "overallRating": 5,
                        "qualityRating": 5,
                        "punctualityRating": 5,
                        "communicationRating": 5,
                        "evidenceClarityRating": 5,
                        "comment": "Great work!"
                    }
                    """))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.message").value("Feedback can only be submitted for completed tasks with status APPROVED (current status: IN_PROGRESS)"));
    }

    @Test
    void customerCannotSubmitDuplicateFeedback() throws Exception {
        UUID customerId = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();
        UUID workerId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.getRoles(customerId.toString())).thenReturn(List.of("CUSTOMER"));

        when(jdbc.query(anyString(), any(RowMapper.class), eq(taskId))).thenReturn(List.of(Map.of(
            "title", "Shelf Audit",
            "customer_id", customerId,
            "assigned_to", workerId,
            "has_worker", true,
            "status", "APPROVED"
        )));

        // Existing count is 1 (duplicate feedback)
        when(jdbc.queryForObject(contains("COUNT(*) FROM task_feedback"), eq(Integer.class), eq(taskId)))
            .thenReturn(1);

        mvc.perform(post("/api/v1/tasks/" + taskId + "/feedback")
                .with(jwt().jwt(j -> j.subject(customerId.toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                        "overallRating": 4,
                        "comment": "Second submission attempt"
                    }
                    """))
           .andExpect(status().isConflict())
           .andExpect(jsonPath("$.message").value("Feedback has already been submitted for this task"));
    }

    @Test
    void customerCannotAccessOtherCustomersFeedback() throws Exception {
        UUID customerA = UUID.randomUUID();
        UUID customerB = UUID.randomUUID();
        UUID worker = UUID.randomUUID();
        UUID taskId = UUID.randomUUID();

        when(roleAuthorization.hasAny(any(), any())).thenReturn(true);
        when(roleAuthorization.getRoles(customerA.toString())).thenReturn(List.of("CUSTOMER"));

        FeedbackController.FeedbackView existingFb = new FeedbackController.FeedbackView(
            UUID.randomUUID(), taskId, "Store Audit", worker, "Worker Bob",
            customerB, "Customer Alice", 5, 5, 5, 5, 5, "Well done", null
        );

        when(jdbc.query(anyString(), any(RowMapper.class), eq(taskId))).thenReturn(List.of(existingFb));

        // Customer A tries to view feedback authored by Customer B
        mvc.perform(get("/api/v1/tasks/" + taskId + "/feedback")
                .with(jwt().jwt(j -> j.subject(customerA.toString()))))
           .andExpect(status().isForbidden())
           .andExpect(jsonPath("$.message").value("You do not have permission to view feedback for this task"));
    }
}
