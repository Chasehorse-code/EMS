package com.chasehorse.area;

import java.util.List;
import java.util.UUID;

/**
 * Who is asking and which zones (states) they may see.
 * Admins: all zones, optionally narrowed by a filter. Managers: every state the admin assigned them
 * (one or many). Workers: their own registered state.
 */
public record AreaScope(
    UUID actorId,
    boolean isAdmin,
    boolean isManager,
    boolean isEmployee,
    String stateCode,
    List<String> stateCodes
) {
    public AreaScope {
        stateCodes = stateCodes == null ? List.of() : List.copyOf(stateCodes);
    }

    /** Single-zone convenience constructor (admin filter, worker, or a one-zone manager). */
    public AreaScope(UUID actorId, boolean isAdmin, boolean isManager, boolean isEmployee, String stateCode) {
        this(actorId, isAdmin, isManager, isEmployee, stateCode,
            stateCode == null || stateCode.isBlank() || AreaScopeService.NO_AREA_SENTINEL.equals(stateCode) ? List.of() : List.of(stateCode));
    }

    public boolean isUnrestricted() {
        return isAdmin && (stateCode == null || stateCode.isBlank());
    }

    public boolean hasState() {
        return stateCode != null && !stateCode.isBlank();
    }

    /** True when this scope may see records in the given state. */
    public boolean coversState(String state) {
        if (isUnrestricted()) return true;
        if (state == null || state.isBlank()) return false;
        if (isAdmin) return state.equalsIgnoreCase(stateCode);
        return stateCodes.stream().anyMatch(s -> s.equalsIgnoreCase(state));
    }
}
