package com.chasehorse.partners;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partners")
public class PartnerController {
    private final PartnerService partnerService;

    public PartnerController(PartnerService partnerService) {
        this.partnerService = partnerService;
    }

    /**
     * Public Registration endpoint for the 7 partner types.
     */
    @PostMapping("/register")
    public PartnerProfile register(@RequestBody PartnerService.RegistrationRequest req) {
        return partnerService.register(req);
    }

    /**
     * Public Status lookup by reference ID.
     */
    @GetMapping("/status/{referenceId}")
    public PartnerProfile getStatusByReference(@PathVariable String referenceId) {
        return partnerService.findByReference(referenceId);
    }

    /**
     * Admin & Manager Approvals Queue list with filtering.
     */
    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public List<PartnerProfile> list(
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "100") int limit
    ) {
        return partnerService.list(type, status, limit);
    }

    /**
     * Live metrics and partner distribution computed from database.
     */
    @GetMapping("/stats")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public java.util.Map<String, Object> getStats() {
        return partnerService.getStats();
    }

    /**
     * Get specific partner details (unmasked for reviewers).
     */
    @GetMapping("/{id}")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public PartnerProfile getById(@PathVariable UUID id) {
        return partnerService.findById(id);
    }

    /**
     * Approve partner application.
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public PartnerProfile approve(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : UUID.randomUUID();
        return partnerService.approve(id, actorId);
    }

    /**
     * Reject partner application with mandatory reason.
     */
    @PostMapping("/{id}/reject")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public PartnerProfile reject(
        @PathVariable UUID id,
        @RequestBody PartnerService.DecisionRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : UUID.randomUUID();
        return partnerService.reject(id, req.reason(), actorId);
    }

    /**
     * Request more information from applicant.
     */
    @PostMapping("/{id}/request-info")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public PartnerProfile requestMoreInfo(
        @PathVariable UUID id,
        @RequestBody PartnerService.DecisionRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : UUID.randomUUID();
        return partnerService.requestMoreInfo(id, req.reason(), actorId);
    }

    /**
     * Bulk approve partner applications.
     */
    @PostMapping("/bulk-approve")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public List<PartnerProfile> bulkApprove(
        @RequestBody PartnerService.BulkApproveRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : UUID.randomUUID();
        return partnerService.bulkApprove(req.partnerIds(), actorId);
    }
}

