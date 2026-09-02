import { useAuth } from '../context/AuthContext';
import { useUserActivityHeartbeat } from '../hooks/useUserActivityHeartbeat';

/** Invisible telemetry — session heartbeats for beta usage analytics. */
export function UserActivityTracker() {
  const { user } = useAuth();
  useUserActivityHeartbeat(user?.uid);
  return null;
}
