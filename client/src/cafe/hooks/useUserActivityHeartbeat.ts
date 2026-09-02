import { useEffect, useRef } from 'react';
import { logUserActivity } from '../lib/userActivity';

const HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * Records session heartbeats while the dashboard tab is focused (5 min cadence).
 */
export function useUserActivityHeartbeat(uid: string | undefined | null): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!uid) return;

    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      void logUserActivity(uid, 'session_heartbeat');
    };

    const start = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(ping, HEARTBEAT_MS);
    };

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') {
      start();
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [uid]);
}
