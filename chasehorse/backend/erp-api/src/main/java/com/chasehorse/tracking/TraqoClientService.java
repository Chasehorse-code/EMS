package com.chasehorse.tracking;

import com.chasehorse.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Service
public class TraqoClientService {
    private static final Logger log = LoggerFactory.getLogger(TraqoClientService.class);

    private final String baseUrl;
    private final String username;
    private final String password;
    private final TraqoRateLimiter rateLimiter;
    private final TraqoLocationCache cache;
    private final RestTemplate restTemplate;

    public TraqoClientService(
        @Value("${TRAQO_BASE_URL:https://dashboard.traqo.in}") String baseUrl,
        @Value("${TRAQO_USERNAME:}") String username,
        @Value("${TRAQO_PASSWORD:}") String password,
        TraqoRateLimiter rateLimiter,
        TraqoLocationCache cache,
        RestTemplateBuilder restTemplateBuilder
    ) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.username = username;
        this.password = password;
        this.rateLimiter = rateLimiter;
        this.cache = cache;
        this.restTemplate = restTemplateBuilder
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(10))
            .build();
    }

    public boolean isConfigured() {
        return username != null && !username.isBlank() && password != null && !password.isBlank();
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.setContentType(MediaType.APPLICATION_JSON);

        if (isConfigured()) {
            String auth = username + ":" + password;
            byte[] encodedAuth = Base64.getEncoder().encode(auth.getBytes(StandardCharsets.UTF_8));
            headers.set("Authorization", "Basic " + new String(encodedAuth, StandardCharsets.UTF_8));
        }
        return headers;
    }

    /**
     * Executes Traqo request with token-bucket rate limiting and retry backoff.
     */
    private <T> T executeWithRateLimit(String path, HttpMethod method, Object requestBody, Class<T> responseType) {
        if (!rateLimiter.tryAcquire()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Too many tracking requests. Rate limit is 10 req/s. Retrying shortly.");
        }

        String url = baseUrl + (path.startsWith("/") ? path : "/" + path);
        HttpEntity<?> entity = new HttpEntity<>(requestBody, buildHeaders());

        int maxAttempts = 3;
        long backoffMs = 500L;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ResponseEntity<T> response = restTemplate.exchange(url, method, entity, responseType);
                return response.getBody();
            } catch (HttpClientErrorException e) {
                // Check for low balance
                String responseBody = e.getResponseBodyAsString();
                if (e.getStatusCode() == HttpStatus.FORBIDDEN && responseBody.contains("low_balance")) {
                    log.warn("Traqo API account balance is low: {}", responseBody);
                    throw new ApiException(HttpStatus.FORBIDDEN, "TRAQO_LOW_BALANCE");
                }
                if (responseBody.contains("Invalid username/password")) {
                    log.error("Traqo credentials configuration error: {}", e.getMessage());
                    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Tracking service temporarily unavailable (configuration error).");
                }
                throw new ApiException(HttpStatus.valueOf(e.getStatusCode().value()), "Traqo API error: " + e.getMessage());
            } catch (HttpServerErrorException e) {
                if (attempt == maxAttempts) {
                    log.error("Traqo server error after {} attempts: {}", maxAttempts, e.getMessage());
                    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Traqo tracking gateway error. Please try again.");
                }
                try {
                    Thread.sleep(backoffMs * attempt);
                } catch (InterruptedException ignored) {}
            } catch (Exception e) {
                log.warn("Traqo request failed (attempt {}): {}", attempt, e.getMessage());
                if (attempt == maxAttempts) {
                    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Tracking connection failed: " + e.getMessage());
                }
                try {
                    Thread.sleep(backoffMs * attempt);
                } catch (InterruptedException ignored) {}
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to complete tracking request.");
    }

    /**
     * Fetch live location with 60-second caching.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchTripLocation(String tripId, String invoice, String lrNumber) {
        String cacheKey = "loc_" + (tripId != null ? tripId : "") + "_" + (invoice != null ? invoice : "");
        Object cached = cache.get(cacheKey);
        if (cached instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }

        if (!isConfigured()) {
            throw ApiException.badRequest("Traqo API credentials are not configured in backend environment. Please set TRAQO_USERNAME and TRAQO_PASSWORD.");
        }

        String path = "/api/v3/trip/location/?id=" + (tripId != null ? tripId : "")
            + "&invoice=" + (invoice != null ? invoice : "")
            + "&lr_number=" + (lrNumber != null ? lrNumber : "");

        Map<String, Object> result = executeWithRateLimit(path, HttpMethod.GET, null, Map.class);
        if (result != null) {
            cache.put(cacheKey, result);
        }
        return result != null ? result : Map.of();
    }

    /**
     * Create trip on Traqo.
     */
    public Map<String, Object> createTrip(Map<String, Object> tripData) {
        if (!isConfigured()) {
            throw ApiException.badRequest("Traqo API credentials are not configured in backend environment. Please set TRAQO_USERNAME and TRAQO_PASSWORD.");
        }
        return executeWithRateLimit("/api/v3/trip/create/", HttpMethod.POST, tripData, Map.class);
    }

    /**
     * End trip on Traqo.
     */
    public Map<String, Object> endTrip(String tripId) {
        if (!isConfigured()) {
            throw ApiException.badRequest("Traqo API credentials are not configured in backend environment. Please set TRAQO_USERNAME and TRAQO_PASSWORD.");
        }
        return executeWithRateLimit("/api/v3/trip/end/", HttpMethod.POST, Map.of("id", tripId), Map.class);
    }

    /**
     * Check consent for phone numbers.
     */
    public Map<String, Object> checkConsent(String tel) {
        if (!isConfigured()) {
            throw ApiException.badRequest("Traqo API credentials are not configured in backend environment. Please set TRAQO_USERNAME and TRAQO_PASSWORD.");
        }
        return executeWithRateLimit("/api/v3/check_consent/?tel=" + tel, HttpMethod.GET, null, Map.class);
    }

    /**
     * Resend consent SMS (max 5 per number).
     */
    public Map<String, Object> resendConsentSms(String phone) {
        if (!isConfigured()) {
            throw ApiException.badRequest("Traqo API credentials are not configured in backend environment. Please set TRAQO_USERNAME and TRAQO_PASSWORD.");
        }
        return executeWithRateLimit("/api/v2/resend_consent_sms/", HttpMethod.POST, Map.of("phone_number", phone), Map.class);
    }

    /**
     * Fetch route history for timeline & map visualization.
     */
    public Map<String, Object> fetchRouteHistory(String tripId) {
        if (!isConfigured()) {
            throw ApiException.badRequest("Traqo API credentials are not configured in backend environment. Please set TRAQO_USERNAME and TRAQO_PASSWORD.");
        }
        return executeWithRateLimit("/api/v4/trip/fetch_route_history/", HttpMethod.POST, Map.of("id", tripId), Map.class);
    }
}
