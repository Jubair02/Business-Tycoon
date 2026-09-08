// ============================================
// Bangladesh Business Tycoon - Structured Error System
// Phase 0: Centralized error types for consistent API responses
// ============================================

/**
 * Standard error codes used across the application.
 * Never expose internal implementation details to the client.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_FUNDS'
  | 'GAME_TICK_LOCKED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/**
 * HTTP status codes mapped to error codes.
 */
const CODE_TO_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_FUNDS: 400,
  GAME_TICK_LOCKED: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Application-level error class.
 * Use this instead of generic Error for all API-facing errors.
 *
 * Example:
 *   throw new AppError('INSUFFICIENT_FUNDS', 'You do not have enough cash');
 *   throw new AppError('GAME_TICK_LOCKED', 'A game tick is already in progress');
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, message: string, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = CODE_TO_STATUS[code] ?? 500;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert to a client-safe JSON response payload.
   * Never includes stack traces or internal details.
   */
  toResponse(): { success: false; error: { code: ErrorCode; message: string } } {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

// ---- Convenience constructors ----

export function validationError(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message);
}

export function unauthorized(message = 'Not authenticated'): AppError {
  return new AppError('UNAUTHORIZED', message);
}

export function forbidden(message = 'You do not have access to this resource'): AppError {
  return new AppError('FORBIDDEN', message);
}

export function notFound(resource: string): AppError {
  return new AppError('NOT_FOUND', `${resource} not found`);
}

export function conflict(message: string): AppError {
  return new AppError('CONFLICT', message);
}

export function insufficientFunds(need: number, have: number): AppError {
  return new AppError(
    'INSUFFICIENT_FUNDS',
    `Insufficient cash. Need ৳${need.toLocaleString()}, have ৳${have.toLocaleString()}`
  );
}

export function tickLocked(message = 'A game tick is already in progress. Please wait.'): AppError {
  return new AppError('GAME_TICK_LOCKED', message);
}

export function internalError(message = 'An internal error occurred'): AppError {
  return new AppError('INTERNAL_ERROR', message, false);
}
