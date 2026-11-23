package com.chasehorse.tasks;

import java.util.List;

/** Great-circle distance helpers for the field-worker task radius. */
final class GeoDistance {
    static final double EARTH_RADIUS_KM = 6371.0;

    private GeoDistance() {}

    record Point(double lat, double lng) {}

    /** Haversine distance in kilometres. */
    static double km(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    /** Rough mainland + islands bounding box; rejects swapped or garbage coordinates. */
    static boolean isInIndia(double lat, double lng) {
        return lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
    }

    /**
     * SQL predicate: task {@code t} lies within {@code radiusKm} of a point. A bounding box runs
     * first so the trigonometry only applies to nearby rows. Portable across PostgreSQL and H2.
     * Bind the parameters returned by {@link #withinRadiusParams} in order.
     */
    static String withinRadiusSql() {
        return """
            (t.location_lat IS NOT NULL AND t.location_lng IS NOT NULL
             AND t.location_lat BETWEEN ? AND ? AND t.location_lng BETWEEN ? AND ?
             AND 2 * 6371.0 * ASIN(SQRT(
                   POWER(SIN(RADIANS(t.location_lat - ?) / 2), 2)
                 + COS(RADIANS(?)) * COS(RADIANS(t.location_lat)) * POWER(SIN(RADIANS(t.location_lng - ?) / 2), 2)
             )) <= ?)
            """;
    }

    static List<Object> withinRadiusParams(Point centre, double radiusKm) {
        double dLat = radiusKm / 111.0;
        double dLng = radiusKm / (111.32 * Math.max(0.2, Math.cos(Math.toRadians(centre.lat()))));
        return List.of(
            centre.lat() - dLat, centre.lat() + dLat,
            centre.lng() - dLng, centre.lng() + dLng,
            centre.lat(), centre.lat(), centre.lng(),
            radiusKm
        );
    }
}
