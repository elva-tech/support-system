import { HttpErrorResponse } from '@angular/common/http';

export function formatApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const body = error.error;
  let message = '';

  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('{')) {
    message = body.trim();
  } else if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message.trim()) {
      message = body.message.trim();
    } else if (Array.isArray(body.errors) && body.errors.length) {
      message = body.errors
        .map((item: { message?: string; field?: string }) => item.message || item.field)
        .filter(Boolean)
        .join('. ');
    } else if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string') {
      message = body.error.message.trim();
    }
  }

  if (!message) {
    switch (error.status) {
      case 0:
        message = 'Could not reach the server. Check your internet connection and try again.';
        break;
      case 400:
        message = 'Please check your details and try again.';
        break;
      case 401:
        message = 'Your session has expired. Please sign in again.';
        break;
      case 403:
        message = 'You do not have permission to perform this action.';
        break;
      case 404:
        message = 'The requested resource was not found.';
        break;
      case 429:
        message = 'Too many attempts. Please wait a few minutes and try again.';
        break;
      case 503:
        message = 'The service is temporarily unavailable. Please try again shortly.';
        break;
      default:
        message = fallback;
    }
  }

  // Surface request correlation for unexpected/server errors (support triage).
  const requestId =
    (body && typeof body === 'object' && (body.requestId || body.error?.requestId)) ||
    error.headers?.get?.('X-Request-ID') ||
    error.headers?.get?.('x-request-id');

  if (requestId && error.status >= 500) {
    return `${message} (Reference ID: ${requestId})`;
  }

  return message;
}
