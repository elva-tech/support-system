/**
 * Helpers for platform provisioning failure display.
 */

export interface ProvisioningStepErrorView {
  message: string;
  code: string | null;
  technicalDetails: string | null;
  failedAt: string | null;
  retryable: boolean;
}

export function normalizeStepError(error: unknown): ProvisioningStepErrorView | null {
  if (error == null || error === '') return null;
  if (typeof error === 'string') {
    return {
      message: error,
      code: null,
      technicalDetails: null,
      failedAt: null,
      retryable: true
    };
  }
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      message: String(e['message'] || 'Step failed'),
      code: e['code'] != null ? String(e['code']) : null,
      technicalDetails: e['technicalDetails'] != null ? String(e['technicalDetails']) : null,
      failedAt: e['failedAt'] != null ? String(e['failedAt']) : null,
      retryable: e['retryable'] !== false
    };
  }
  return { message: String(error), code: null, technicalDetails: null, failedAt: null, retryable: true };
}

export function suggestedActionForCode(code: string | null | undefined, message: string): string {
  const c = (code || '').toUpperCase();
  const m = (message || '').toLowerCase();
  if (c === 'TENANT_ADMIN_EMAIL_EXISTS' || m.includes('already exists')) {
    return 'Use another email address or remove the existing conflicting user.';
  }
  if (c === 'UNIQUE_CONSTRAINT_VIOLATION' || c === '11000') {
    return 'A unique value conflict occurred (often email or slug). Change the conflicting field and retry.';
  }
  if (c.includes('SLUG') || m.includes('slug')) {
    return 'Choose a different tenant slug and run availability check again.';
  }
  if (c.includes('EMAIL') || m.includes('email')) {
    return 'Verify the email address and mail provider configuration, then retry.';
  }
  return 'Review the reason above, correct the input if needed, then retry the failed step.';
}
