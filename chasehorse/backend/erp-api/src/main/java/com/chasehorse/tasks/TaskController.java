package com.chasehorse.tasks;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {
    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    public record CreateTaskRequest(
        @NotBlank @Size(max = 180) String title,
        @Size(max = 5000) String description,
        String category,
        String priority,
        UUID checklistTemplateId,
        String areaKey,
        String address,
        String stateCode,
        Integer geofenceRadiusMeters,
        OffsetDateTime dueAt,
        @DecimalMin("0.00") BigDecimal rewardAmount,
        @DecimalMin("-90.0") @jakarta.validation.constraints.DecimalMax("90.0") BigDecimal locationLat,
        @DecimalMin("-180.0") @jakarta.validation.constraints.DecimalMax("180.0") BigDecimal locationLng
    ) {}

    public record AssignTaskRequest(
        @NotNull UUID employeeId
    ) {}

    public record ReasonRequest(@jakarta.validation.constraints.Size(max = 500) String reason) {}

    public record UpdateStatusRequest(
        @NotBlank String status
    ) {}

    @GetMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'EMPLOYEE', 'CUSTOMER', 'FIELD_WORKER')")
    public List<TaskService.TaskView> listTasks(
        @RequestParam(required = false) UUID customerId,
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String search,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.listTasks(customerId, state, search, jwt);
    }

    @GetMapping("/{idOrDisplayId}")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'EMPLOYEE', 'CUSTOMER', 'FIELD_WORKER')")
    public TaskService.TaskView getTask(
        @PathVariable String idOrDisplayId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.getTask(idOrDisplayId, jwt);
    }

    @PostMapping
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public TaskService.TaskView createTask(
        @Valid @RequestBody CreateTaskRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        return taskService.createTask(new TaskService.CreateTaskCommand(
            request.title(),
            request.description(),
            request.category(),
            request.priority(),
            request.checklistTemplateId(),
            request.areaKey(),
            request.address(),
            request.stateCode(),
            request.geofenceRadiusMeters() != null ? request.geofenceRadiusMeters() : 200,
            request.dueAt(),
            request.rewardAmount(),
            actorId,
            null,
            request.locationLat(),
            request.locationLng()
        ), jwt);
    }

    @PostMapping("/{taskId}/assignment")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public TaskService.TaskView assignTask(
        @PathVariable UUID taskId,
        @Valid @RequestBody AssignTaskRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        UUID actorId = UUID.fromString(jwt.getSubject());
        return taskService.assignTask(taskId, request.employeeId(), actorId);
    }

    @PostMapping("/{taskId}/accept")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'FIELD_WORKER', 'EMPLOYEE')")
    public TaskService.TaskView acceptTask(
        @PathVariable UUID taskId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.acceptTask(taskId, jwt);
    }

    @PostMapping("/{taskId}/reject-offer")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'FIELD_WORKER', 'EMPLOYEE')")
    public java.util.Map<String, Object> rejectOffer(
        @PathVariable UUID taskId,
        @RequestBody(required = false) ReasonRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.rejectOffer(taskId, request != null ? request.reason() : null, jwt);
    }

    /** The assigned worker gives up a task part-way, with a reason. */
    @PostMapping("/{taskId}/drop")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'FIELD_WORKER', 'EMPLOYEE')")
    public TaskService.TaskView dropTask(
        @PathVariable UUID taskId,
        @RequestBody ReasonRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.dropTask(taskId, request != null ? request.reason() : null, jwt);
    }

    /** Workers the task can be given to, nearest first (Rapido-style radius). */
    @GetMapping("/{taskId}/eligible-workers")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS')")
    public List<TaskService.EligibleWorker> eligibleWorkers(
        @PathVariable UUID taskId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.eligibleWorkers(taskId, jwt);
    }

    @PostMapping("/{taskId}/cancel")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'CUSTOMER')")
    public TaskService.TaskView cancelTask(
        @PathVariable UUID taskId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.cancelTask(taskId, jwt);
    }

    @PatchMapping("/{taskId}/status")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'MANAGER', 'OPERATIONS', 'FIELD_WORKER', 'EMPLOYEE', 'CUSTOMER')")
    public TaskService.TaskView updateStatus(
        @PathVariable UUID taskId,
        @Valid @RequestBody UpdateStatusRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        return taskService.updateStatus(taskId, request.status(), jwt);
    }
}