package com.chasehorse.enquiries;

import com.chasehorse.auth.RoleAuthorization;
import com.chasehorse.config.MethodSecurityConfig;
import com.chasehorse.config.SecurityConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({PublicEnquiryController.class, EnquiryController.class})
@Import({SecurityConfig.class, MethodSecurityConfig.class})
@TestPropertySource(properties = "SUPABASE_JWT_ISSUER=https://phxybimufcrsnxfepiuz.supabase.co/auth/v1")
class EnquiryEndpointSecurityTest {

    @Autowired MockMvc mvc;
    @MockBean EmailVerificationService verification;
    @MockBean EnquiryService enquiries;
    @MockBean(name = "roleAuthorization") RoleAuthorization roleAuthorization;
    @MockBean JwtDecoder jwtDecoder;

    @Test
    @DisplayName("Website visitors can request a code without logging in")
    void publicCodeEndpointIsOpen() throws Exception {
        when(verification.requestCode(any(), any())).thenReturn(new EmailVerificationService.CodeSent("a@b.co", 10, 60));
        mvc.perform(post("/api/v1/public/enquiries/email-code").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"a@b.co\"}"))
           .andExpect(status().isOk());
    }

    @Test
    @DisplayName("The dashboard API rejects anonymous requests")
    void dashboardNeedsLogin() throws Exception {
        mvc.perform(get("/api/v1/enquiries")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Signed-in users without the enquiry role are forbidden")
    void dashboardNeedsEnquiryRole() throws Exception {
        UUID worker = UUID.randomUUID();
        when(roleAuthorization.hasAny(any(), eq("ENQUIRY_MANAGER"), eq("ADMIN"))).thenReturn(false);
        mvc.perform(get("/api/v1/enquiries").with(jwt().jwt(j -> j.subject(worker.toString()))))
           .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Enquiry managers can list enquiries")
    void enquiryManagerCanList() throws Exception {
        when(roleAuthorization.hasAny(any(), eq("ENQUIRY_MANAGER"), eq("ADMIN"))).thenReturn(true);
        when(enquiries.list(any(), eq(0), eq(25))).thenReturn(new EnquiryService.Page(List.of(), 0, 0, 25));
        mvc.perform(get("/api/v1/enquiries").with(jwt().jwt(j -> j.subject(UUID.randomUUID().toString()))))
           .andExpect(status().isOk());
    }
}
