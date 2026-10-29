/** Local wall-clock helpers. Plans store a local "HH:MM" start; no dates or time zones. */

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHHMM(text: string): number {
  if (!HHMM.test(text)) throw new Error(`Bad time ${text}`);
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "4:05 PM" style display. */
export function formatClock(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

/** Now, rounded up to the next 5 minutes, as HH:MM. */
export function nextStart(now = new Date()): string {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return toHHMM(Math.ceil(minutes / 5) * 5);
}
