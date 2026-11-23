package com.chasehorse.tickets;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tickets")
public class TicketController {
    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    public record CreateTicketRequest(
        @NotBlank @Size(max = 255) String subject,
        String category,
        String urgency,
        @NotBlank String message,
        UUID relatedTaskId,
        String region,
        String attachments
    ) {}

    public record AddCommentRequest(
        @NotBlank String message,
        boolean isInternal,
        String attachments
    ) {}

    public record UpdateStatusRequest(
        @NotBlank String status,
        String notes
    ) {}

    public record AssignTicketRequest(
        @NotNull UUID staffId
    ) {}

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public List<TicketService.TicketView> listTickets(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String urgency,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String state,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ticketService.listTickets(jwt, status, urgency, search, state);
    }

    @PostMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public TicketService.TicketView createTicket(
        @Valid @RequestBody CreateTicketRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ticketService.createTicket(new TicketService.CreateTicketCommand(
            request.subject(),
            request.category(),
            request.urgency(),
            request.message(),
            request.relatedTaskId(),
            request.region(),
            request.attachments()
        ), jwt);
    }

    @GetMapping("/{idOrDisplayId}")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public TicketService.TicketView getTicket(
        @PathVariable String idOrDisplayId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ticketService.getTicket(idOrDisplayId, jwt);
    }

    @PostMapping("/{id}/comments")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public TicketService.TicketCommentView addComment(
        @PathVariable UUID id,
        @Valid @RequestBody AddCommentRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ticketService.addComment(id, new TicketService.AddCommentCommand(
            request.message(),
            request.isInternal(),
            request.attachments()
        ), jwt);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public TicketService.TicketView updateStatus(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateStatusRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ticketService.updateTicketStatus(id, request.status(), request.notes(), jwt);
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public TicketService.TicketView assignTicket(
        @PathVariable UUID id,
        @Valid @RequestBody AssignTicketRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return ticketService.assignTicket(id, request.staffId(), jwt);
    }
}
