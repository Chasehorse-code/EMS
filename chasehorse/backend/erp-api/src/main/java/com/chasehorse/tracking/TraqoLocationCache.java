package com.chasehorse.tracking;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory location cache with 60-second TTL to conserve Traqo API quota.
 */
@Component
public class TraqoLocationCache {
    private static final long TTL_MS = 60_000L;

    private record CacheEntry(Object data, long timestamp) {
        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > TTL_MS;
        }
    }

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public Object get(String key) {
        CacheEntry entry = cache.get(key);
        if (entry != null && !entry.isExpired()) {
            return entry.data();
        }
        if (entry != null && entry.isExpired()) {
            cache.remove(key);
        }
        return null;
    }

    public void put(String key, Object data) {
        cache.put(key, new CacheEntry(data, System.currentTimeMillis()));
    }

    public void invalidate(String key) {
        cache.remove(key);
    }
}

