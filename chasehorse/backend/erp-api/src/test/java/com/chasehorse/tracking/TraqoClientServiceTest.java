package com.chasehorse.tracking;

import com.chasehorse.common.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpStatus;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TraqoClientServiceTest {

    private TraqoRateLimiter rateLimiter;
    private TraqoLocationCache cache;
    private RestTemplateBuilder restTemplateBuilder;

    @BeforeEach
    void setUp() {
        rateLimiter = new TraqoRateLimiter();
        cache = new TraqoLocationCache();
        restTemplateBuilder = new RestTemplateBuilder();
    }

    @Test
    void rateLimiterPermitsUpTo10RequestsPerSecond() {
        for (int i = 0; i < 10; i++) {
            assertThat(rateLimiter.tryAcquire()).isTrue();
        }
        // 11th token in the same second should be throttled
        assertThat(rateLimiter.tryAcquire()).isFalse();
    }

    @Test
    void locationCacheStoresAndRetrievesData() {
        cache.put("trip-123", Map.of("lat", 16.5062, "lng", 80.6480));
        Object cached = cache.get("trip-123");
        assertThat(cached).isNotNull();

        cache.invalidate("trip-123");
        assertThat(cache.get("trip-123")).isNull();
    }

    @Test
    void unconfiguredClientThrowsBadRequestWhenInvoked() {
        TraqoClientService service = new TraqoClientService(
            "https://dashboard.traqo.in",
            "",
            "",
            rateLimiter,
            cache,
            restTemplateBuilder
        );

        assertThat(service.isConfigured()).isFalse();

        // Calling fetchTripLocation should throw ApiException because no demo/simulated data is allowed
        assertThatThrownBy(() -> service.fetchTripLocation("TRIP-001", null, null))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Traqo API credentials are not configured");

        // Calling checkConsent should also throw ApiException
        assertThatThrownBy(() -> service.checkConsent("9876543210"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Traqo API credentials are not configured");
    }

    @Test
    void clientThrows503WhenRateLimited() {
        // Exhaust tokens
        for (int i = 0; i < 10; i++) {
            rateLimiter.tryAcquire();
        }

        TraqoClientService service = new TraqoClientService(
            "https://dashboard.traqo.in",
            "testuser",
            "testpass",
            rateLimiter,
            cache,
            restTemplateBuilder
        );

        assertThatThrownBy(() -> service.fetchTripLocation("TRIP-999", null, null))
            .isInstanceOf(ApiException.class)
            .satisfies(e -> {
                ApiException apiEx = (ApiException) e;
                assertThat(apiEx.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                assertThat(apiEx.getMessage()).contains("Too many tracking requests");
            });
    }
}
