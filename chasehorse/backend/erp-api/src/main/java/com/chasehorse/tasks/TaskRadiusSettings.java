package com.chasehorse.tasks;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * {@code chasehorse.tasks.worker-radius-km}: field workers only see and accept open tasks within
 * this distance (km) of their live location, or of their registered operational zone.
 */
@ConfigurationProperties(prefix = "chasehorse.tasks")
public record TaskRadiusSettings(double workerRadiusKm) {
    public static final double DEFAULT_RADIUS_KM = 100;

    public TaskRadiusSettings {
        if (workerRadiusKm <= 0) workerRadiusKm = DEFAULT_RADIUS_KM;
    }

    public static TaskRadiusSettings defaults() {
        return new TaskRadiusSettings(DEFAULT_RADIUS_KM);
    }

    @Configuration
    @EnableConfigurationProperties(TaskRadiusSettings.class)
    static class Registration {}
}
