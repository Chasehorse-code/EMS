package com.chasehorse.evidence;

import com.chasehorse.common.ApiException;
import com.chasehorse.common.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.chasehorse.auth.RoleAuthorization;

@RestController
@RequestMapping("/api/v1/evidence")
public class EvidenceController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final RoleAuthorization roleAuth;

    public EvidenceController(JdbcTemplate jdbc, AuditService audit, RoleAuthorization roleAuth) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.roleAuth = roleAuth;
    }

    public record EvidencePhotoView(
        UUID id, String storagePath, String fileName, String caption,
        BigDecimal locationLat, BigDecimal locationLng, OffsetDateTime capturedAt
    ) {}

    public record AiVerificationView(
        String status, BigDecimal confidence, String summary
    ) {}

    public record ManagerDecisionView(
        String status, String decidedBy, OffsetDateTime decidedAt, String note
    ) {}

    public record EvidenceView(
        UUID id, UUID taskId, UUID submittedBy, OffsetDateTime submittedAt,
        List<EvidencePhotoView> photos, AiVerificationView ai, ManagerDecisionView managerDecision
    ) {}

    public record EvidencePhotoPayload(
        String caption,
        String url,
        String storagePath,
        String checklistItemId,
        BigDecimal locationLat,
        BigDecimal locationLng,
        BigDecimal locationAccuracy,
        String rawStoragePath,
        String stampedStoragePath,
        String stampMetadata
    ) {}

    public record ChecklistResultPayload(
        String itemId,
        String label,
        boolean done
    ) {}

    public record SubmitEvidenceRequest(
        @NotNull UUID taskId,
        String storagePath,
        String fileName,
        String contentType,
        Long fileSizeBytes,
        String caption,
        BigDecimal locationLat,
        BigDecimal locationLng,
        BigDecimal locationAccuracy,
        String rawStoragePath,
        String stampedStoragePath,
        String stampMetadata,
        List<EvidencePhotoPayload> photos,
        List<ChecklistResultPayload> checklist,
        Map<String, Object> ai
    ) {}

    public record ManagerDecisionRequest(
        @NotBlank String status,
        String note,
        String decidedBy
    ) {}

    private double calculateHaversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER', 'FIELD_WORKER')")
    public List<EvidenceView> listEvidence(
        @RequestParam(required = false) UUID taskId,
        @RequestParam(required = false) UUID customerId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isOpsOrAdmin = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        StringBuilder sql = new StringBuilder("""
            SELECT e.id, e.task_id, e.submitted_by, e.created_at, e.verification_status, e.verification_notes
            FROM task_evidence e
            JOIN tasks t ON e.task_id = t.id
            WHERE 1=1
            """);
        List<Object> params = new java.util.ArrayList<>();

        if (!isOpsOrAdmin && taskId != null) {
            var taskCheck = jdbc.query("SELECT customer_id, assigned_to FROM tasks WHERE id = ?",
                (rs, n) -> Map.entry(rs.getObject("customer_id", UUID.class), rs.getObject("assigned_to", UUID.class)),
                taskId
            );
            if (!taskCheck.isEmpty()) {
                var taskEntry = taskCheck.get(0);
                if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("CUSTOMER"))) {
                    if (!actorId.equals(taskEntry.getKey())) {
                        throw ApiException.forbidden("You do not own this task");
                    }
                } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("FIELD_WORKER") || r.equalsIgnoreCase("EMPLOYEE"))) {
                    if (!actorId.equals(taskEntry.getValue())) {
                        throw ApiException.forbidden("You are not assigned to this task");
                    }
                }
            }
        }

        if (!isOpsOrAdmin) {
            if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("CUSTOMER"))) {
                sql.append(" AND t.customer_id = ? ");
                params.add(actorId);
            } else if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("FIELD_WORKER") || r.equalsIgnoreCase("EMPLOYEE"))) {
                sql.append(" AND (t.assigned_to = ? OR e.submitted_by = ?) ");
                params.add(actorId);
                params.add(actorId);
            } else {
                return List.of();
            }
        }

        if (taskId != null) {
            sql.append(" AND e.task_id = ? ");
            params.add(taskId);
        }

        sql.append(" ORDER BY e.created_at DESC LIMIT 200");

        return jdbc.query(sql.toString(), (rs, n) -> {
            UUID id = rs.getObject("id", UUID.class);
            UUID tId = rs.getObject("task_id", UUID.class);
            UUID subBy = rs.getObject("submitted_by", UUID.class);
            OffsetDateTime created = rs.getObject("created_at", OffsetDateTime.class);
            String vStatus = rs.getString("verification_status");
            String vNotes = rs.getString("verification_notes");

            var photos = jdbc.query("""
                SELECT id, storage_path, file_name, caption, location_lat, location_lng, captured_at
                FROM task_evidence WHERE id = ?
                """, (prs, pn) -> new EvidencePhotoView(
                    prs.getObject("id", UUID.class),
                    prs.getString("storage_path"),
                    prs.getString("file_name"),
                    prs.getString("caption"),
                    prs.getBigDecimal("location_lat"),
                    prs.getBigDecimal("location_lng"),
                    prs.getObject("captured_at", OffsetDateTime.class)
                ), id
            );

            var aiRows = jdbc.query("""
                SELECT status, confidence, summary FROM ai_verifications WHERE evidence_id = ?
                """, (ars, an) -> new AiVerificationView(
                    ars.getString("status"),
                    ars.getBigDecimal("confidence"),
                    ars.getString("summary")
                ), id);

            AiVerificationView ai = !aiRows.isEmpty()
                ? aiRows.get(0)
                : new AiVerificationView("PENDING", null, "AI verification pending automated model execution");

            ManagerDecisionView manager = new ManagerDecisionView(
                vStatus != null ? vStatus : "PENDING",
                "Operations Reviewer",
                created,
                vNotes
            );

            return new EvidenceView(id, tId, subBy, created, photos, ai, manager);
        }, params.toArray()); // varargs: a List would be bound as one (invalid) parameter
    }

    @PostMapping
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'FIELD_WORKER', 'EMPLOYEE')")
    public EvidenceView submitEvidence(
        @Valid @RequestBody SubmitEvidenceRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        List<String> roles = roleAuth.getRoles(jwt.getSubject());
        boolean isStaff = roles.stream().anyMatch(r ->
            r.equalsIgnoreCase("ADMIN") || r.equalsIgnoreCase("MANAGER") || r.equalsIgnoreCase("OPERATIONS"));

        var taskRows = jdbc.query("""
            SELECT assigned_to, status, location_lat, location_lng, geofence_radius_meters, checklist_template_id
            FROM tasks WHERE id = ?
            """,
            (rs, n) -> Map.of(
                "assignedTo", rs.getObject("assigned_to", UUID.class) != null ? rs.getObject("assigned_to", UUID.class) : UUID.randomUUID(),
                "status", rs.getString("status") != null ? rs.getString("status") : "OPEN",
                "lat", rs.getBigDecimal("location_lat") != null ? rs.getBigDecimal("location_lat") : BigDecimal.ZERO,
                "lng", rs.getBigDecimal("location_lng") != null ? rs.getBigDecimal("location_lng") : BigDecimal.ZERO,
                "radius", rs.getObject("geofence_radius_meters") != null ? rs.getInt("geofence_radius_meters") : 200,
                "templateId", rs.getObject("checklist_template_id", UUID.class) != null ? rs.getObject("checklist_template_id", UUID.class) : UUID.randomUUID()
            ), request.taskId());

        if (taskRows.isEmpty()) {
            throw ApiException.notFound("Task", request.taskId());
        }

        var tData = taskRows.get(0);
        String currentStatus = (String) tData.get("status");
        UUID assignedTo = (UUID) tData.get("assignedTo");
        BigDecimal taskLat = (BigDecimal) tData.get("lat");
        BigDecimal taskLng = (BigDecimal) tData.get("lng");
        int allowedRadius = tData.get("radius") instanceof Integer r ? r : 200;
        UUID templateId = tData.get("templateId") instanceof UUID tid ? tid : null;

        // Worker authorization check (unassigned non-staff must receive 403 Forbidden)
        if (!isStaff && !actorId.equals(assignedTo)) {
            throw ApiException.forbidden("You are not assigned to this task");
        }

        List<String> validationErrors = new java.util.ArrayList<>();

        // 1. Task status check: must be IN_PROGRESS
        if (!"IN_PROGRESS".equalsIgnoreCase(currentStatus)) {
            validationErrors.add("Task not in progress (current status: " + currentStatus + ")");
        }

        // 3. Geofence enforcement on server
        BigDecimal subLat = request.locationLat();
        BigDecimal subLng = request.locationLng();
        if ((subLat == null || subLng == null) && request.photos() != null) {
            for (var p : request.photos()) {
                if (p.locationLat() != null && p.locationLng() != null) {
                    subLat = p.locationLat();
                    subLng = p.locationLng();
                    break;
                }
            }
        }

        if (taskLat != null && taskLng != null && !taskLat.equals(BigDecimal.ZERO) && !taskLng.equals(BigDecimal.ZERO) &&
            subLat != null && subLng != null) {
            double distanceMeters = calculateHaversineMeters(
                taskLat.doubleValue(), taskLng.doubleValue(),
                subLat.doubleValue(), subLng.doubleValue()
            );
            if (distanceMeters > allowedRadius) {
                validationErrors.add("You are " + String.format(java.util.Locale.US, "%,d", Math.round(distanceMeters)) +
                    " m from the site; move within " + allowedRadius + " m");
            }
        }

        // 4. Required photo validation for checklist items
        if (templateId != null) {
            var items = jdbc.query("""
                SELECT id, item_order, label, requires_photo
                FROM checklist_items
                WHERE template_id = ?
                ORDER BY item_order
                """, (rs, n) -> Map.of(
                    "id", rs.getObject("id", UUID.class).toString(),
                    "order", rs.getInt("item_order"),
                    "label", rs.getString("label"),
                    "requiresPhoto", rs.getBoolean("requires_photo")
                ), templateId);

            for (var item : items) {
                boolean reqPhoto = Boolean.TRUE.equals(item.get("requiresPhoto"));
                if (reqPhoto) {
                    String itemId = (String) item.get("id");
                    int order = (Integer) item.get("order");
                    boolean hasPhoto = false;

                    if (request.photos() != null) {
                        for (var p : request.photos()) {
                            if (itemId.equalsIgnoreCase(p.checklistItemId()) ||
                                (p.caption() != null && p.caption().toLowerCase().contains(item.get("label").toString().toLowerCase()))) {
                                if ((p.url() != null && !p.url().isBlank()) ||
                                    (p.storagePath() != null && !p.storagePath().isBlank()) ||
                                    (p.stampedStoragePath() != null && !p.stampedStoragePath().isBlank())) {
                                    hasPhoto = true;
                                    break;
                                }
                            }
                        }
                    } else if (request.storagePath() != null && !request.storagePath().isBlank()) {
                        hasPhoto = true;
                    }

                    if (!hasPhoto) {
                        validationErrors.add("Photo required for item " + order);
                    }
                }
            }
        }

        // 5. Stamp metadata verification
        if (request.stampMetadata() != null && !request.stampMetadata().isBlank()) {
            if (request.stampMetadata().contains("taskId") && !request.stampMetadata().contains(request.taskId().toString())) {
                validationErrors.add("Photo stamp metadata task mismatch");
            }
        }

        // If any validation errors exist, group into one message and reject
        if (!validationErrors.isEmpty()) {
            throw ApiException.badRequest(String.join(". ", validationErrors));
        }

        UUID evidenceId = UUID.randomUUID();
        String primaryStorage = request.storagePath();
        String primaryFilename = request.fileName() != null ? request.fileName() : "evidence.jpg";
        String contentType = request.contentType() != null ? request.contentType() : "image/jpeg";
        Long sizeBytes = request.fileSizeBytes() != null ? request.fileSizeBytes() : 102400L;
        String caption = request.caption() != null ? request.caption() : "Field Evidence";

        if (primaryStorage == null && request.photos() != null && !request.photos().isEmpty()) {
            var firstP = request.photos().get(0);
            primaryStorage = firstP.stampedStoragePath() != null ? firstP.stampedStoragePath() : (firstP.url() != null ? firstP.url() : firstP.storagePath());
            if (firstP.caption() != null) caption = firstP.caption();
        }
        if (primaryStorage == null) {
            primaryStorage = "evidence/" + request.taskId() + "/evidence_" + evidenceId + ".jpg";
        }

        jdbc.update("""
            INSERT INTO task_evidence (id, task_id, submitted_by, storage_path, file_name,
                                      content_type, file_size_bytes, caption, location_lat,
                                      location_lng, location_accuracy, raw_storage_path,
                                      stamped_storage_path, stamp_metadata, captured_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
            """, evidenceId, request.taskId(), actorId, primaryStorage, primaryFilename,
            contentType, sizeBytes, caption, subLat, subLng, request.locationAccuracy(),
            request.rawStoragePath(), request.stampedStoragePath(), request.stampMetadata());

        // Update task status to SUBMITTED
        jdbc.update("UPDATE tasks SET status = 'SUBMITTED', updated_at = now() WHERE id = ?", request.taskId());

        // Ensure approval queue row exists for operations review
        var existingApprovals = jdbc.query("SELECT id FROM task_approvals WHERE task_id = ?",
            (rs, n) -> rs.getObject("id", UUID.class), request.taskId());
        if (existingApprovals.isEmpty()) {
            jdbc.update("""
                INSERT INTO task_approvals (id, task_id, evidence_id, reviewer_id, stage, decision, created_at)
                VALUES (gen_random_uuid(), ?, ?, ?, 'MANAGER_REVIEW', 'PENDING', now())
                """, request.taskId(), evidenceId, actorId);
        } else {
            jdbc.update("""
                UPDATE task_approvals SET evidence_id = ?, decision = 'PENDING', stage = 'MANAGER_REVIEW'
                WHERE task_id = ?
                """, evidenceId, request.taskId());
        }

        audit.log(actorId, "EVIDENCE_SUBMITTED", "TASK_EVIDENCE", evidenceId,
            Map.of("taskId", request.taskId().toString(), "status", "SUBMITTED"));

        return listEvidence(request.taskId(), null, jwt).stream()
            .filter(e -> e.id().equals(evidenceId))
            .findFirst()
            .orElse(new EvidenceView(evidenceId, request.taskId(), actorId, OffsetDateTime.now(), List.of(),
                new AiVerificationView("PENDING", null, "Advisory check pending"),
                new ManagerDecisionView("PENDING", "Operations Reviewer", OffsetDateTime.now(), null)));
    }

    @PostMapping("/{id}/manager-decision")
    @Transactional
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public Map<String, Object> decideEvidence(
        @PathVariable UUID id,
        @Valid @RequestBody ManagerDecisionRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        int rows = jdbc.update("""
            UPDATE task_evidence SET verification_status = ?, verification_notes = ?
            WHERE id = ?
            """, request.status().toUpperCase(), request.note(), id);

        if (rows == 0) throw ApiException.notFound("Evidence", id);

        audit.log(actorId, "EVIDENCE_DECIDED", "TASK_EVIDENCE", id,
            Map.of("decision", request.status(), "note", request.note() != null ? request.note() : ""));

        return Map.of("id", id, "status", request.status(), "updated", true);
    }
}
