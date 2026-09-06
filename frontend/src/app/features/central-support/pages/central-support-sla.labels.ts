/** Display labels mirroring backend DEFAULT_PLATFORM_SUPPORT_SLA (minutes → human). */
export const DEFAULT_PLATFORM_SUPPORT_SLA_LABELS = [
  { priority: 'Urgent (CRITICAL)', response: '1 hour', resolution: '8 hours' },
  { priority: 'High', response: '4 hours', resolution: '1 day' },
  { priority: 'Normal (MEDIUM)', response: '8 hours', resolution: '2 days' },
  { priority: 'Low', response: '24 hours', resolution: '3 days' }
] as const;
