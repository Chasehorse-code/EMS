package com.chasehorse.enquiries;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Enquiry Management dashboard API — enquiry managers (the contact@ account) and admins only. */
@RestController
@RequestMapping("/api/v1/enquiries")
@PreAuthorize("@roleAuthorization.hasAny(authentication, 'ENQUIRY_MANAGER', 'ADMIN')")
public class EnquiryController {
    private final EnquiryService service;

    public EnquiryController(EnquiryService service) {
        this.service = service;
    }

    public record StatusRequest(@NotBlank String status, @Size(max = 2000) String note) {}

    public record AssignRequest(UUID assigneeId) {}

    public record NoteRequest(@NotBlank @Size(max = 2000) String note) {}

    @GetMapping
    public EnquiryService.Page list(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String formType,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return service.list(new EnquiryService.Filters(status, formType, q, from, to), page, size);
    }

    @GetMapping("/summary")
    public EnquiryService.Summary summary() {
        return service.summary();
    }

    /** Live updates: enquiries created after {@code since}. Polled every few seconds by the dashboard. */
    @GetMapping("/updates")
    public List<EnquiryService.EnquiryRow> updates(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime since
    ) {
        return service.createdSince(since);
    }

    @GetMapping("/staff")
    public List<EnquiryService.Staff> staff() {
        return service.assignableStaff();
    }

    @GetMapping("/form-types")
    public List<java.util.Map<String, String>> formTypes() {
        return java.util.Arrays.stream(EnquiryFormType.values())
            .map(t -> java.util.Map.of("value", t.name(), "label", t.label())).toList();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String formType,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to
    ) {
        String csv = service.exportCsv(new EnquiryService.Filters(status, formType, q, from, to));
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"chasehorse-enquiries-" + LocalDate.now() + ".csv\"")
            .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
            .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/{id}")
    public EnquiryService.EnquiryDetail get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PatchMapping("/{id}/status")
    public EnquiryService.EnquiryDetail status(@PathVariable UUID id, @Valid @RequestBody StatusRequest body,
                                               @AuthenticationPrincipal Jwt jwt) {
        return service.updateStatus(id, body.status(), body.note(), UUID.fromString(jwt.getSubject()));
    }

    @PatchMapping("/{id}/assignee")
    public EnquiryService.EnquiryDetail assign(@PathVariable UUID id, @RequestBody AssignRequest body,
                                               @AuthenticationPrincipal Jwt jwt) {
        return service.assign(id, body.assigneeId(), UUID.fromString(jwt.getSubject()));
    }

    @PostMapping("/{id}/notes")
    public EnquiryService.EnquiryDetail note(@PathVariable UUID id, @Valid @RequestBody NoteRequest body,
                                             @AuthenticationPrincipal Jwt jwt) {
        return service.addNote(id, body.note(), UUID.fromString(jwt.getSubject()));
    }
}
