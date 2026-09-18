// ============================================
// Bangladesh Business Tycoon - Client-side API error reading
// ============================================
//
// API failures are returned as { success: false, error: { code, message } }.
// The UI used to read `body.error` directly and hand that object to toast(),
// which renders as "[object Object]" instead of the reason for the failure.

/**
 * Pull a human-readable message out of an API error body.
 * Falls back to `fallback` for any shape that does not carry one.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body;

  if (body && typeof body === 'object') {
    const { error, message } = body as { error?: unknown; message?: unknown };

    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
      const nested = (error as { message?: unknown }).message;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
    if (typeof message === 'string' && message.trim()) return message;
  }

  return fallback;
}

/** Read a failed Response and return the best available message. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    return apiErrorMessage(await res.json(), fallback);
  } catch {
    return fallback;
  }
}
