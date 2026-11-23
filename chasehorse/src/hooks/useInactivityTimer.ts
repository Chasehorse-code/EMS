import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInactivityTimerOptions {
  timeoutMs?: number; // default: 30 minutes = 1,800,000ms
  warningMs?: number; // default: 1 minute before timeout = 60,000ms
  onTimeout: () => void;
  enabled?: boolean;
}

export function useInactivityTimer({
  timeoutMs = 30 * 60 * 1000,
  warningMs = 1 * 60 * 1000,
  onTimeout,
  enabled = true,
}: UseInactivityTimerOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.round(warningMs / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsRemaining(Math.round(warningMs / 1000));
  }, [warningMs]);

  useEffect(() => {
    if (!enabled) return;

    const handleUserActivity = () => {
      // If warning is not visible, user activity quietly extends the timer
      if (!showWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeLeft = timeoutMs - elapsed;

      if (timeLeft <= 0) {
        clearInterval(checkInterval);
        setShowWarning(false);
        onTimeoutRef.current();
      } else if (timeLeft <= warningMs) {
        setShowWarning(true);
        setSecondsRemaining(Math.max(1, Math.round(timeLeft / 1000)));
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    };
  }, [enabled, timeoutMs, warningMs, showWarning]);

  return {
    showWarning,
    secondsRemaining,
    resetTimer,
  };
}
