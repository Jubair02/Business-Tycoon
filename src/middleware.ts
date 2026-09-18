import { NextResponse, type NextRequest } from 'next/server';
import { checkCsrf } from '@/lib/security/csrf';

/**
 * Origin check for every state-changing API request.
 *
 * This runs ahead of the route handlers so a single place covers all of them —
 * there are 39 routes and adding the check per-handler would eventually miss
 * one. See `lib/security/csrf.ts` for the reasoning behind an origin check
 * rather than a token.
 */
export function middleware(request: NextRequest) {
  const decision = checkCsrf({
    method: request.method,
    path: request.nextUrl.pathname,
    origin: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    host: request.headers.get('host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    // Behind a reverse proxy the Host header can be the internal one, so the
    // deployment's public origin is trusted explicitly when it is configured.
    allowedOrigins: process.env.APP_URL ? [process.env.APP_URL] : [],
  });

  if (!decision.allowed) {
    console.warn(
      `[csrf] Blocked ${request.method} ${request.nextUrl.pathname}: ${decision.reason}`,
    );
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Request blocked: bad origin.' } },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  // Only the API surface mutates state; page requests are left alone so
  // navigation is not routed through the Edge runtime for no reason.
  matcher: ['/api/:path*'],
};
