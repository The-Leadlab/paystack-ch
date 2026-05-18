import type { Session } from '../types';

const AUTO_TIMESTAMP_NAME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Format a date in the user's local timezone as `YYYY-MM-DD HH:mm:ss`. */
export function formatLocalDateTime(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return typeof date === 'string' ? date : '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function isAutoTimestampSessionName(name: string): boolean {
  return AUTO_TIMESTAMP_NAME.test(name.trim());
}

/** Show auto-generated session names in local time (fixes legacy UTC labels). */
export function getSessionDisplayName(session: Pick<Session, 'name' | 'created_at'>): string {
  if (isAutoTimestampSessionName(session.name) && session.created_at) {
    const local = formatLocalDateTime(session.created_at);
    if (local) return local;
  }
  return session.name;
}

export function defaultSessionName(date: Date = new Date()): string {
  return formatLocalDateTime(date);
}
