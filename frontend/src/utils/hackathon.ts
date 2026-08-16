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
