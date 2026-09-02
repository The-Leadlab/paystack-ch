/**
 * Roll up `users/{uid}.analytics.daily` buckets for admin dashboards.
 */
export type UserAnalyticsDailyBucket = {
  logins?: number;
  sessionMinutes?: number;
  errors?: number;
  uploads?: number;
};

export type UserAnalyticsRollup = {
  logins30d: number;
  sessionMinutes30d: number;
  errors30d: number;
  uploads30d: number;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
};

export function aggregateUserAnalytics(
  analytics: Record<string, unknown> | undefined | null
): UserAnalyticsRollup {
  const daily =
    analytics && typeof analytics.daily === 'object' && analytics.daily !== null
      ? (analytics.daily as Record<string, UserAnalyticsDailyBucket>)
      : {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  let logins30d = 0;
  let sessionMinutes30d = 0;
  let errors30d = 0;
  let uploads30d = 0;

  for (const [day, bucket] of Object.entries(daily)) {
    if (day < cutoffKey) continue;
    logins30d += bucket.logins ?? 0;
    sessionMinutes30d += bucket.sessionMinutes ?? 0;
    errors30d += bucket.errors ?? 0;
    uploads30d += bucket.uploads ?? 0;
  }

  const lastLoginAt =
    typeof analytics?.lastLoginAt === 'string' ? analytics.lastLoginAt : null;
  const lastActiveAt =
    typeof analytics?.lastActiveAt === 'string'
      ? analytics.lastActiveAt
      : lastLoginAt;

  return {
    logins30d,
    sessionMinutes30d,
    errors30d,
    uploads30d,
    lastLoginAt,
    lastActiveAt,
  };
}

export function googleDriveConnectedFromBilling(
  billing: Record<string, unknown> | null | undefined
): boolean {
  const gd = billing?.googleDrive;
  if (!gd || typeof gd !== 'object') return false;
  const refresh = (gd as { refreshToken?: unknown }).refreshToken;
  return typeof refresh === 'string' && refresh.length > 0;
}
