package com.chasehorse.tracking;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Token-bucket rate limiter for Traqo API.
 * Strict quota: At most 10 requests per second.
 */
@Component
public class TraqoRateLimiter {
    private static final int MAX_PER_SECOND = 10;
    private final AtomicInteger tokens = new AtomicInteger(MAX_PER_SECOND);
    private final AtomicLong lastRefillTimestamp = new AtomicLong(System.currentTimeMillis());

    public synchronized boolean tryAcquire() {
        refill();
        if (tokens.get() > 0) {
            tokens.decrementAndGet();
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.currentTimeMillis();
        long last = lastRefillTimestamp.get();
        if (now - last >= 1000) {
            tokens.set(MAX_PER_SECOND);
            lastRefillTimestamp.set(now);
        }
    }
}

