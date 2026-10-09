export type TicketUrgency = 'normal' | 'warning' | 'urgent';

// Minutes since a ticket was sent to the kitchen before it escalates.
// Named thresholds, not magic numbers — tune here if a pilot cafeteria
// wants different pacing.
export const WARNING_THRESHOLD_MINUTES = 5;
export const URGENT_THRESHOLD_MINUTES = 10;

export function ticketUrgency(elapsedMs: number): TicketUrgency {
  const minutes = elapsedMs / 60_000;
  if (minutes >= URGENT_THRESHOLD_MINUTES) return 'urgent';
  if (minutes >= WARNING_THRESHOLD_MINUTES) return 'warning';
  return 'normal';
}

export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
