// ============================================
// Bangladesh Business Tycoon - Error System
// Phase 0: Barrel exports for all error utilities
// ============================================

export { AppError, validationError, unauthorized, forbidden, notFound, conflict, insufficientFunds, tickLocked, internalError } from './AppError';
export type { ErrorCode } from './AppError';
export { handleApiError, successResponse } from './handleApiError';
export { requirePlayerId, requirePlayer, getOptionalPlayerId } from './auth';
export {
  cuidSchema,
  positiveIntSchema,
  nonNegativeNumberSchema,
  positiveNumberSchema,
  registerSchema,
  createBusinessSchema,
  buyInventorySchema,
  sellInventorySchema,
  updatePriceSchema,
  hireEmployeeSchema,
  takeLoanSchema,
  repayLoanSchema,
  createCampaignSchema,
  campaignActionSchema,
  cityQuerySchema,
  leaderboardTypeSchema,
} from './validation';
