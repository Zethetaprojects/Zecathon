export type HackathonStatus = 'upcoming' | 'open' | 'ended';

export function getHackathonStatus(startDate?: string, endDate?: string): { status: HackathonStatus; label: string } {
  const now = new Date().getTime();
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;

  if (end !== null && now >= end) {
    return { status: 'ended', label: 'Ended' };
  }
  if (start !== null && now < start) {
    return { status: 'upcoming', label: 'Upcoming' };
  }
  if (start !== null && end !== null && now >= start && now < end) {
    return { status: 'open', label: 'Open' };
  }
  return { status: 'open', label: 'Open' };
}

export function formatHackathonDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return 'Date TBD';
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (start && end) {
    return `${fmt(start)} ${time(start)} → ${fmt(end)} ${time(end)}`;
  }
  if (start) return `${fmt(start)} ${time(start)}`;
  if (end) return `${fmt(end)} ${time(end)}`;
  return 'Date TBD';
}

export function getCountdownTarget(startDate?: string, endDate?: string): { target: string | undefined; label: string } {
  const { status } = getHackathonStatus(startDate, endDate);
  if (status === 'upcoming') return { target: startDate, label: 'Starts in' };
  if (status === 'open') return { target: endDate, label: 'Ends in' };
  return { target: undefined, label: '' };
}

/** True once the given ISO time has passed. */
export function isPast(iso?: string | null): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() <= Date.now();
}

/** e.g. "Fri, 20 Nov 2026, 11:30" in the viewer's own time zone. */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Not set';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** ISO timestamp → value for an <input type="datetime-local"> in the viewer's time zone. */
export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Add hours to a datetime-local value, returning a datetime-local value ('' if inputs are incomplete). */
export function addHoursToLocalValue(localValue: string, hours: number): string {
  if (!localValue || !Number.isFinite(hours) || hours <= 0) return '';
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return '';
  return toDatetimeLocalValue(new Date(d.getTime() + hours * 3600000).toISOString());
}
