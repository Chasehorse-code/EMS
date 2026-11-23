package com.chasehorse.tracking;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/tracking")
public class TrackingController {
    private final TraqoClientService traqoService;
    private final JdbcTemplate jdbc;

    public TrackingController(TraqoClientService traqoService, JdbcTemplate jdbc) {
        this.traqoService = traqoService;
        this.jdbc = jdbc;
    }

    /**
     * Integration Health & Configuration status (Zero secret exposure).
     */
    @GetMapping("/status")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> getStatus() {
        return Map.of(
            "gateway", "Traqo Logistics Telemetry API v3/v4",
            "isConfigured", traqoService.isConfigured(),
            "rateLimit", "10 requests/second token-bucket",
            "cacheTtl", "60 seconds",
            "status", traqoService.isConfigured() ? "ONLINE" : "UNCONFIGURED"
        );
    }

    /**
     * List all tracked trips fetched authoritatively from PostgreSQL database.
     */
    @GetMapping("/trips")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public List<Map<String, Object>> listTrips() {
        return jdbc.query("""
            SELECT id, traqo_trip_id, invoice_number, lr_number, truck_number, driver_phone,
                   status, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng,
                   eta_timestamp, consent_status, consent_count, created_at, updated_at
            FROM tracking_trips
            ORDER BY created_at DESC
            """, (rs, rowNum) -> {
                Map<String, Object> row = new HashMap<>();
                row.put("id", rs.getObject("id"));
                row.put("traqoTripId", rs.getString("traqo_trip_id"));
                row.put("invoiceNumber", rs.getString("invoice_number"));
                row.put("lrNumber", rs.getString("lr_number"));
                row.put("truckNumber", rs.getString("truck_number"));
                row.put("driverPhone", rs.getString("driver_phone"));
                row.put("status", rs.getString("status"));
                row.put("originName", rs.getString("origin_name"));
                row.put("originLat", rs.getBigDecimal("origin_lat"));
                row.put("originLng", rs.getBigDecimal("origin_lng"));
                row.put("destinationName", rs.getString("destination_name"));
                row.put("destinationLat", rs.getBigDecimal("destination_lat"));
                row.put("destinationLng", rs.getBigDecimal("destination_lng"));
                row.put("etaTimestamp", rs.getObject("eta_timestamp"));
                row.put("consentStatus", rs.getString("consent_status"));
                row.put("consentCount", rs.getInt("consent_count"));
                row.put("createdAt", rs.getObject("created_at") != null ? rs.getObject("created_at").toString() : null);
                row.put("updatedAt", rs.getObject("updated_at") != null ? rs.getObject("updated_at").toString() : null);
                return row;
            });
    }

    /**
     * Fetch live location by trip ID, invoice number, or LR number via Traqo API.
     */
    @GetMapping("/location")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> getLocation(
        @RequestParam(required = false) String tripId,
        @RequestParam(required = false) String invoice,
        @RequestParam(required = false) String lrNumber
    ) {
        return traqoService.fetchTripLocation(tripId, invoice, lrNumber);
    }

    /**
     * Create new tracked trip (Admin & Manager) with Traqo API and persist to database.
     */
    @PostMapping("/trips")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> createTrip(@RequestBody Map<String, Object> tripData, @AuthenticationPrincipal Jwt jwt) {
        UUID actorId = jwt != null ? UUID.fromString(jwt.getSubject()) : null;
        Map<String, Object> traqoResult = traqoService.createTrip(tripData);

        UUID tripDbId = UUID.randomUUID();
        String traqoId = traqoResult.get("id") != null ? traqoResult.get("id").toString() : null;
        String truckNumber = (String) tripData.getOrDefault("truck_number", tripData.getOrDefault("truckNumber", ""));
        String driverPhone = (String) tripData.getOrDefault("tel", tripData.getOrDefault("driverPhone", ""));
        String invoice = (String) tripData.getOrDefault("invoice", tripData.getOrDefault("invoiceNumber", ""));
        String lr = (String) tripData.getOrDefault("lr_number", tripData.getOrDefault("lrNumber", ""));
        String srcName = (String) tripData.getOrDefault("srcname", tripData.getOrDefault("originName", ""));
        String destName = (String) tripData.getOrDefault("destname", tripData.getOrDefault("destinationName", ""));

        jdbc.update("""
            INSERT INTO tracking_trips (
                id, traqo_trip_id, invoice_number, lr_number, truck_number, driver_phone,
                status, origin_name, destination_name, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?)
            """,
            tripDbId, traqoId, invoice, lr, truckNumber, driverPhone,
            srcName, destName, actorId);

        Map<String, Object> resp = new HashMap<>(traqoResult);
        resp.put("databaseId", tripDbId);
        return resp;
    }

    /**
     * End tracked trip on Traqo API and update database.
     */
    @PostMapping("/trips/{id}/end")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> endTrip(@PathVariable String id) {
        Map<String, Object> endResult = traqoService.endTrip(id);
        jdbc.update("UPDATE tracking_trips SET status = 'COMPLETED', updated_at = now() WHERE traqo_trip_id = ? OR CAST(id AS VARCHAR) = ?", id, id);
        return endResult;
    }

    /**
     * Fetch route history for timeline & map visualization.
     */
    @PostMapping("/trips/{id}/route-history")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> routeHistory(@PathVariable String id) {
        return traqoService.fetchRouteHistory(id);
    }

    /**
     * Check telephone consent.
     */
    @GetMapping("/consent")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> checkConsent(@RequestParam String tel) {
        return traqoService.checkConsent(tel);
    }

    /**
     * Resend consent SMS (max 5 per number).
     */
    @PostMapping("/consent/resend")
    @PreAuthorize("@roleAuthorization.hasAny(authentication, 'ADMIN', 'OPERATIONS', 'MANAGER', 'OPERATIONAL_MANAGER')")
    public Map<String, Object> resendConsent(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        Map<String, Object> res = traqoService.resendConsentSms(phone);
        jdbc.update("UPDATE tracking_trips SET consent_count = consent_count + 1, updated_at = now() WHERE driver_phone = ?", phone);
        return res;
    }
}

