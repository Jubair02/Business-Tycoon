// ============================================
// Bangladesh Business Tycoon - CSRF Origin Check
// ============================================
//
// Every state-changing route is a plain POST authenticated by a cookie, and
// `sameSite=lax` does not cover all of them: a top-level cross-site form
// submission still carries the session. Without this, a malicious page could
// make a signed-in player take a loan or sell a business.
//
// The defence is an origin check rather than a token: there is no form
// pipeline to thread a token through, and every mutation in this app is a
// same-origin `fetch`, which browsers always label.
//
// Kept dependency-free so it can run in the Edge middleware runtime.

/** Methods that can change server state and therefore need checking. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Routes exempt from the origin check.
 *
 * `/api/game/tick` is driven by cron or a service caller, which sends no
 * `Origin` at all; it is authenticated by a bearer secret instead.
 */
const EXEMPT_PATHS = ['/api/game/tick'];

export type CsrfDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface CsrfCheckInput {
  method: string;
  path: string;
  /** `Origin` header, if the browser sent one. */
  origin: string | null;
  /** `Sec-Fetch-Site` header — the more direct signal where it is available. */
  secFetchSite: string | null;
  /** `Host` header of the request being served. */
  host: string | null;
  /** `X-Forwarded-Proto`, so an https deployment behind a proxy compares like for like. */
  forwardedProto?: string | null;
  /** Extra origins to trust, e.g. `APP_URL` when the proxy rewrites Host. */
  allowedOrigins?: string[];
}

/** Normalise an origin to `scheme://host` in lower case, or null if unparseable. */
function normaliseOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

export function isExemptPath(path: string): boolean {
  return EXEMPT_PATHS.some((exempt) => path === exempt || path.startsWith(`${exempt}/`));
}

/**
 * Decide whether a request may change state.
 *
 * Read-only methods always pass. For the rest:
 *   1. `Sec-Fetch-Site` is trusted when present — it is set by the browser and
 *      cannot be altered by page script.
 *   2. Otherwise `Origin` must match the host being served, or one of the
 *      explicitly allowed origins.
 *   3. A mutating request with neither header is refused. Browsers always send
 *      `Origin` on `fetch`, so this only rejects non-browser callers, which
 *      should be using the exempt service routes.
 */
export function checkCsrf(input: CsrfCheckInput): CsrfDecision {
  const method = input.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) return { allowed: true };
  if (isExemptPath(input.path)) return { allowed: true };

  // 1. Fetch metadata, where the browser provides it.
  const site = input.secFetchSite?.toLowerCase() ?? null;
  if (site) {
    // `none` is a direct user action (address bar, bookmark) — not reachable
    // for a fetch POST, but harmless to allow and useful for non-browser tools.
    if (site === 'same-origin' || site === 'none') return { allowed: true };
    return { allowed: false, reason: `cross-origin request (Sec-Fetch-Site: ${site})` };
  }

  // 2. Fall back to comparing Origin against the host we are serving.
  const origin = normaliseOrigin(input.origin);
  if (!origin) {
    return { allowed: false, reason: 'missing Origin on a state-changing request' };
  }

  const allowed = new Set<string>();
  if (input.host) {
    const proto = (input.forwardedProto || 'https').split(',')[0].trim();
    allowed.add(`${proto}://${input.host}`.toLowerCase());
    // Local development is served over plain http.
    allowed.add(`http://${input.host}`.toLowerCase());
    allowed.add(`https://${input.host}`.toLowerCase());
  }
  for (const extra of input.allowedOrigins ?? []) {
    const normalised = normaliseOrigin(extra);
    if (normalised) allowed.add(normalised);
  }

  if (allowed.has(origin)) return { allowed: true };

  return { allowed: false, reason: `Origin ${origin} does not match this site` };
}
