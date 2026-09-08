// ============================================
// Bangladesh Business Tycoon - API Error Handler
// Phase 0: Consistent error → NextResponse mapping
// ============================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from './AppError';

/**
 * Handle an error in an API route handler and return an appropriate NextResponse.
 *
 * - ZodError: returns 400 with first validation issue message
 * - AppError: returns structured { success, error } JSON with correct HTTP status
 * - Generic Error: returns 500 with sanitized message (never exposes internals)
 * - Unknown: returns 500 with generic message
 *
 * Always logs the error server-side for debugging.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    console.warn('[API] Validation error:', error.issues);
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR' as const, message: firstIssue?.message || 'Validation failed' } },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    // Operational errors: expected business logic failures
    if (error.isOperational) {
      console.warn(`[API] ${error.code}: ${error.message}`);
    } else {
      // Non-operational: unexpected internal failures
      console.error(`[API] ${error.code}: ${error.message}`, error);
    }
    return NextResponse.json(error.toResponse(), { status: error.statusCode });
  }

  if (error instanceof Error) {
    // Generic Error: could be Prisma, Zod, or any other thrown error
    // Check for known Prisma error patterns and sanitize
    const msg = error.message;

    // Prisma unique constraint violation
    if (msg.includes('Unique constraint failed')) {
      console.warn('[API] Unique constraint violation:', msg);
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT' as const, message: 'This resource already exists' } },
        { status: 409 }
      );
    }

    // Log the full error server-side but return generic message to client
    console.error('[API] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR' as const, message: 'An internal error occurred' } },
      { status: 500 }
    );
  }

  // Non-Error thrown (string, number, etc.)
  console.error('[API] Unknown error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR' as const, message: 'An internal error occurred' } },
    { status: 500 }
  );
}

/**
 * Create a success response with consistent structure.
 */
export function successResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}
