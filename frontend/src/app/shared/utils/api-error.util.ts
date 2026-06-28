import { HttpErrorResponse } from '@angular/common/http';

export function formatApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body = error.error;

  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('{')) {
    return body.trim();
  }

  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }

    if (Array.isArray(body.errors) && body.errors.length) {
      return body.errors
        .map((item: { message?: string; field?: string }) => item.message || item.field)
        .filter(Boolean)
        .join('. ');
    }
  }

  switch (error.status) {
    case 0:
      return 'Could not reach the server. Check your internet connection and try again.';
    case 400:
      return 'Please check your details and try again.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 503:
      return 'The service is temporarily unavailable. Please try again shortly.';
    default:
      return fallback;
  }
}
