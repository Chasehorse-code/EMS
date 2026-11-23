package com.chasehorse.partners;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PartnerProfile(
    UUID id,
    String referenceId,
    UUID userId,
    String partnerType,
    String status,
    String contactName,
    String companyName,
    String email,
    String phone,
    String maskedGst,
    String submittedData,
    String rejectionReason,
    UUID reviewedBy,
    OffsetDateTime reviewedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}

