/**
 * Pure helpers for tenant portal bootstrap completion.
 * Ensures hostname branding lookup always ends in a terminal state.
 */

export type TenantBootstrapTerminalState = 'ready' | 'not-found' | 'error';

export interface TenantBootstrapErrorInfo {
  status?: number | null;
  code?: string | null;
  message?: string | null;
}

/** HTTP / API codes that mean the workspace host is not a real tenant. */
const NOT_FOUND_CODES = new Set([
  'TENANT_NOT_FOUND',
  'INVALID_TENANT_HOST',
  'INVALID_TENANT_SLUG',
  'RESERVED_TENANT_SLUG',
  'TENANT_CONTEXT_REQUIRED'
]);

/**
 * Classify a branding/bootstrap HTTP failure into a terminal bootstrap state.
 * Never returns 'loading'.
 */
export const classifyTenantBootstrapFailure = (
  info: TenantBootstrapErrorInfo
): { state: Exclude<TenantBootstrapTerminalState, 'ready'>; message: string } => {
  const status = Number(info.status) || 0;
  const code = String(info.code || '').trim();

  if (status === 404 || NOT_FOUND_CODES.has(code)) {
    return {
      state: 'not-found',
      message: 'This workspace may no longer exist or the address may be incorrect.'
    };
  }

  // Status 0 = network/CORS/aborted — treat as error, not infinite loading
  if (status === 0) {
    return {
      state: 'error',
      message: info.message || 'Unable to reach the workspace service. Please try again.'
    };
  }

  return {
    state: 'error',
    message: info.message || 'Failed to load workspace branding'
  };
};

export const extractBootstrapErrorInfo = (err: unknown): TenantBootstrapErrorInfo => {
  const anyErr = err as {
    status?: number;
    message?: string;
    error?: { message?: string; code?: string; errors?: { code?: string } };
  } | null;

  return {
    status: anyErr?.status ?? null,
    code: anyErr?.error?.errors?.code || anyErr?.error?.code || null,
    message: anyErr?.error?.message || anyErr?.message || null
  };
};
