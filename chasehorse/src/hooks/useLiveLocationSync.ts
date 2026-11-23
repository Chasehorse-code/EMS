import { useEffect } from 'react';
import { api } from '@/api';
import { haversineKm } from '@/utils/geo';

/** Send at most once a minute, or sooner after moving this far. */
const MIN_INTERVAL_MS = 60_000;
const MIN_MOVE_KM = 0.2;
/** Fixes worse than this are not good enough for the task radius. */
const MAX_ACCURACY_M = 500;

let last: { lat: number; lng: number; at: number } | null = null;
let inFlight = false;

/**
 * Sends the worker's position to the server so their task radius ("tasks near me", who managers
 * can assign) follows where they really are. Throttled; safe to call on every GPS fix.
 */
export function syncWorkerLocation(lat: number, lng: number, accuracy?: number): void {
  if (inFlight || (accuracy != null && accuracy > MAX_ACCURACY_M)) return;
  const now = Date.now();
  if (last) {
    const moved = haversineKm({ lat, lng }, { lat: last.lat, lng: last.lng });
    if (now - last.at < MIN_INTERVAL_MS && moved < MIN_MOVE_KM) return;
  }
  inFlight = true;
  api
    .updateWorkerLocation({ lat, lng, accuracy })
    .then(() => {
      last = { lat, lng, at: now };
    })
    .catch(() => {
      // Consent withdrawn or offline: try again after the interval, not on every fix.
      last = { lat, lng, at: now };
    })
    .finally(() => {
      inFlight = false;
    });
}

/** Forget the last sent position (after consent is given again, send immediately). */
export function resetLocationSync(): void {
  last = null;
}

/**
 * For field workers who agreed to share their location: keeps the server position fresh while
 * the portal is open on any page.
 */
export function useLiveLocationSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => syncWorkerLocation(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy)),
      () => {
        /* permission denied or unavailable: the registered zone is used instead */
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
}
