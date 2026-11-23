package com.chasehorse.partners;

import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import com.chasehorse.common.IdGeneratorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartnerServiceTest {

    @Mock private JdbcTemplate jdbc;
    @Mock private AuditService audit;
    @Mock private IdGeneratorService idGen;

    private PartnerService partnerService;

    @BeforeEach
    void setUp() {
        partnerService = new PartnerService(jdbc, audit, idGen);
    }

    @Test
    void registerThrowsExceptionWhenPartnerTypeMissing() {
        PartnerService.RegistrationRequest req = new PartnerService.RegistrationRequest(
            null, "John Doe", "Acme", "john@example.com", "9876543210", "pass123", null, null, Map.of()
        );

        assertThatThrownBy(() -> partnerService.register(req))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Partner type is required");
    }

    @Test
    void registerThrowsExceptionWhenEmailMissing() {
        PartnerService.RegistrationRequest req = new PartnerService.RegistrationRequest(
            "transporter", "John Doe", "Acme", "  ", "9876543210", "pass123", null, null, Map.of()
        );

        assertThatThrownBy(() -> partnerService.register(req))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Email is required");
    }

    @Test
    void registerSuccessSavesPendingProfileAndGeneratesReference() {
        when(idGen.nextEmployeeId()).thenReturn("EMP-9901");
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));
        doReturn(1).when(jdbc).update(anyString(), any(), any(), any(), any(), any());
        doReturn(1).when(jdbc).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());

        PartnerProfile created = new PartnerProfile(
            UUID.randomUUID(), "CH-TRA-123456", UUID.randomUUID(), "transporter", "PENDING",
            "Rajesh Varma", "Varma Express", "rajesh@example.com", "9876543210",
            "***********1234", "{}", null, null, null, OffsetDateTime.now(), OffsetDateTime.now()
        );

        doReturn(List.of(created)).when(jdbc).query(anyString(), any(RowMapper.class), any());

        PartnerService.RegistrationRequest req = new PartnerService.RegistrationRequest(
            "transporter", "Rajesh Varma", "Varma Express", "rajesh@example.com", "9876543210",
            "pass123", "***********1234", null, Map.of("fleetSize", 12)
        );

        PartnerProfile result = partnerService.register(req);

        assertThat(result).isNotNull();
        assertThat(result.status()).isEqualTo("PENDING");
        assertThat(result.email()).isEqualTo("rajesh@example.com");
        verify(audit).log(any(), eq("PARTNER_APPLICATION_SUBMITTED"), eq("PARTNER_PROFILE"), any(), any());
    }

    @Test
    void approveSetsStatusApprovedAndAssignsRole() {
        UUID partnerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();

        PartnerProfile existing = new PartnerProfile(
            partnerId, "CH-FLT-554433", userId, "fleet_owner", "PENDING",
            "Suresh Kumar", "SK Logistics", "suresh@example.com", "9876543211",
            "***********5678", "{}", null, null, null, OffsetDateTime.now(), OffsetDateTime.now()
        );

        PartnerProfile approved = new PartnerProfile(
            partnerId, "CH-FLT-554433", userId, "fleet_owner", "APPROVED",
            "Suresh Kumar", "SK Logistics", "suresh@example.com", "9876543211",
            "***********5678", "{}", null, reviewerId, OffsetDateTime.now(), OffsetDateTime.now(), OffsetDateTime.now()
        );

        doReturn(List.of(existing), List.of(approved)).when(jdbc).query(anyString(), any(RowMapper.class), any());
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));

        PartnerProfile result = partnerService.approve(partnerId, reviewerId);

        assertThat(result.status()).isEqualTo("APPROVED");
        verify(audit).log(eq(reviewerId), eq("PARTNER_APPROVED"), eq("PARTNER_PROFILE"), eq(partnerId), any());
    }

    @Test
    void rejectWithoutReasonThrowsBadRequest() {
        UUID partnerId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();

        assertThatThrownBy(() -> partnerService.reject(partnerId, "   ", reviewerId))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Mandatory rejection reason");
    }

    @Test
    void rejectWithValidReasonSetsStatusRejected() {
        UUID partnerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();

        PartnerProfile existing = new PartnerProfile(
            partnerId, "CH-DRV-112233", userId, "driver", "PENDING",
            "Ramu", null, "ramu@example.com", "9876543212",
            null, "{}", null, null, null, OffsetDateTime.now(), OffsetDateTime.now()
        );

        PartnerProfile rejected = new PartnerProfile(
            partnerId, "CH-DRV-112233", userId, "driver", "REJECTED",
            "Ramu", null, "ramu@example.com", "9876543212",
            null, "{}", "Invalid driving license number", reviewerId, OffsetDateTime.now(), OffsetDateTime.now(), OffsetDateTime.now()
        );

        doReturn(List.of(existing), List.of(rejected)).when(jdbc).query(anyString(), any(RowMapper.class), any());
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));

        PartnerProfile result = partnerService.reject(partnerId, "Invalid driving license number", reviewerId);

        assertThat(result.status()).isEqualTo("REJECTED");
        verify(audit).log(eq(reviewerId), eq("PARTNER_REJECTED"), eq("PARTNER_PROFILE"), eq(partnerId), any());
    }

    @Test
    void bulkApproveProcessesAllProvidedIds() {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();

        PartnerProfile p1 = new PartnerProfile(
            id1, "CH-TRA-101", UUID.randomUUID(), "transporter", "PENDING",
            "Partner 1", "Co 1", "p1@example.com", "9111111111", null, "{}", null, null, null, OffsetDateTime.now(), OffsetDateTime.now()
        );
        PartnerProfile p2 = new PartnerProfile(
            id2, "CH-TRA-102", UUID.randomUUID(), "transporter", "PENDING",
            "Partner 2", "Co 2", "p2@example.com", "9222222222", null, "{}", null, null, null, OffsetDateTime.now(), OffsetDateTime.now()
        );

        doReturn(List.of(p1)).doReturn(List.of(p1)).doReturn(List.of(p2)).doReturn(List.of(p2))
            .when(jdbc).query(anyString(), any(RowMapper.class), any());
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));

        List<PartnerProfile> results = partnerService.bulkApprove(List.of(id1, id2), reviewerId);

        assertThat(results).hasSize(2);
    }
}
