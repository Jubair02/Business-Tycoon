// ============================================
// CSRF origin check
// ============================================

import { describe, it, expect } from 'vitest';
import { checkCsrf, isExemptPath } from '@/lib/security/csrf';

const base = {
  path: '/api/loans',
  origin: 'https://tycoon.example.com',
  secFetchSite: null as string | null,
  host: 'tycoon.example.com',
  forwardedProto: 'https',
};

describe('read-only methods', () => {
  it('are never blocked', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(
        checkCsrf({ ...base, method, origin: 'https://evil.example', secFetchSite: 'cross-site' }),
      ).toEqual({ allowed: true });
    }
  });
});

describe('Sec-Fetch-Site', () => {
  it('allows same-origin', () => {
    expect(checkCsrf({ ...base, method: 'POST', secFetchSite: 'same-origin' }).allowed).toBe(true);
  });

  it('allows none (direct user action)', () => {
    expect(checkCsrf({ ...base, method: 'POST', secFetchSite: 'none' }).allowed).toBe(true);
  });

  it('blocks cross-site even when Origin looks right', () => {
    const result = checkCsrf({ ...base, method: 'POST', secFetchSite: 'cross-site' });
    expect(result.allowed).toBe(false);
  });

  it('blocks same-site — a sibling subdomain is still not us', () => {
    expect(checkCsrf({ ...base, method: 'POST', secFetchSite: 'same-site' }).allowed).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(checkCsrf({ ...base, method: 'post', secFetchSite: 'SAME-ORIGIN' }).allowed).toBe(true);
  });
});

describe('Origin fallback', () => {
  it('allows an Origin matching the served host', () => {
    expect(checkCsrf({ ...base, method: 'POST' }).allowed).toBe(true);
  });

  it('allows http and https forms of the same host', () => {
    expect(
      checkCsrf({
        ...base,
        method: 'POST',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        forwardedProto: null,
      }).allowed,
    ).toBe(true);
  });

  it('blocks an attacker origin', () => {
    const result = checkCsrf({ ...base, method: 'POST', origin: 'https://evil.example' });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain('evil.example');
  });

  it('blocks a look-alike host', () => {
    expect(
      checkCsrf({ ...base, method: 'POST', origin: 'https://tycoon.example.com.evil.test' }).allowed,
    ).toBe(false);
  });

  it('blocks a state-changing request with no Origin at all', () => {
    const result = checkCsrf({ ...base, method: 'POST', origin: null });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain('missing Origin');
  });

  it('blocks an unparseable Origin', () => {
    expect(checkCsrf({ ...base, method: 'POST', origin: 'not-a-url' }).allowed).toBe(false);
  });

  it('trusts an explicitly allowed origin when Host is the proxy internal name', () => {
    expect(
      checkCsrf({
        ...base,
        method: 'POST',
        host: 'localhost:3000',
        origin: 'https://tycoon.example.com',
        allowedOrigins: ['https://tycoon.example.com'],
      }).allowed,
    ).toBe(true);
  });

  it('ignores a malformed entry in allowedOrigins', () => {
    expect(
      checkCsrf({
        ...base,
        method: 'POST',
        host: 'internal',
        origin: 'https://evil.example',
        allowedOrigins: ['', 'nonsense'],
      }).allowed,
    ).toBe(false);
  });
});

describe('every mutating method is covered', () => {
  it('blocks PUT, PATCH and DELETE from a foreign origin', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect(
        checkCsrf({ ...base, method, origin: 'https://evil.example' }).allowed,
      ).toBe(false);
    }
  });
});

describe('service endpoint exemption', () => {
  it('exempts the tick route, which cron calls without an Origin', () => {
    expect(isExemptPath('/api/game/tick')).toBe(true);
    expect(
      checkCsrf({ ...base, method: 'POST', path: '/api/game/tick', origin: null }).allowed,
    ).toBe(true);
  });

  it('does not exempt look-alike paths', () => {
    expect(isExemptPath('/api/game/ticket')).toBe(false);
    expect(isExemptPath('/api/game')).toBe(false);
    expect(
      checkCsrf({ ...base, method: 'POST', path: '/api/game/reset', origin: null }).allowed,
    ).toBe(false);
  });
});

describe('the routes this was added to protect', () => {
  const moneyRoutes = [
    '/api/loans',
    '/api/businesses',
    '/api/businesses/abc123/sell',
    '/api/businesses/abc123/upgrade',
    '/api/businesses/abc123/inventory/buy',
    '/api/game/reset',
  ];

  it('blocks a cross-site POST to each of them', () => {
    for (const path of moneyRoutes) {
      expect(
        checkCsrf({ ...base, method: 'POST', path, origin: 'https://evil.example' }).allowed,
      ).toBe(false);
    }
  });

  it('allows the app’s own same-origin POST to each of them', () => {
    for (const path of moneyRoutes) {
      expect(
        checkCsrf({ ...base, method: 'POST', path, secFetchSite: 'same-origin' }).allowed,
      ).toBe(true);
    }
  });
});
