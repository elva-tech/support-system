/**
 * Shared SLA duration conversion / formatting (canonical storage = minutes).
 */

export type SlaDurationUnit = 'minutes' | 'hours' | 'days';

export interface SlaDurationParts {
  value: number;
  unit: SlaDurationUnit;
}

const UNIT_TO_MINUTES: Record<SlaDurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440
};

export function convertSlaDuration(value: number, unit: SlaDurationUnit): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * UNIT_TO_MINUTES[unit]);
}

/** Pick the most readable unit for a minute total. */
export function minutesToParts(totalMinutes: number): SlaDurationParts {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (m === 0) return { value: 0, unit: 'minutes' };
  if (m % 1440 === 0) return { value: m / 1440, unit: 'days' };
  if (m % 60 === 0) return { value: m / 60, unit: 'hours' };
  return { value: m, unit: 'minutes' };
}

export function formatSlaDuration(totalMinutes: number): string {
  const { value, unit } = minutesToParts(totalMinutes);
  if (unit === 'days') return value === 1 ? '1 day' : `${value} days`;
  if (unit === 'hours') return value === 1 ? '1 hour' : `${value} hours`;
  return value === 1 ? '1 minute' : `${value} minutes`;
}

export const SLA_DURATION_UNITS: { value: SlaDurationUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' }
];
