// ============================================
// Bangladesh Business Tycoon - Validation Schemas
// Phase 0: Zod schemas for all mutation API routes
// ============================================

import { z } from 'zod';
import { CITIES, BUSINESS_TYPES, EMPLOYEE_ROLES } from '@/lib/game-data';

// ---- Reusable primitives ----

export const cuidSchema = z.string().min(1, 'ID is required').max(50);

export const positiveIntSchema = z
  .number({ invalid_type_error: 'Must be a number' })
  .int('Must be an integer')
  .positive('Must be positive');

export const nonNegativeNumberSchema = z
  .number({ invalid_type_error: 'Must be a number' })
  .finite('Must be a finite number')
  .nonnegative('Must be non-negative');

export const positiveNumberSchema = z
  .number({ invalid_type_error: 'Must be a number' })
  .finite('Must be a finite number')
  .positive('Must be positive');

// ---- Player ----

export const registerSchema = z.object({
  name: z.string()
    .min(1, 'Player name is required')
    .max(50, 'Player name must be 50 characters or less')
    .transform(v => v.trim()),
});

// ---- Business ----

const validCityIds = CITIES.map(c => c.id);
const validBusinessTypeIds = BUSINESS_TYPES.map(b => b.id);

export const createBusinessSchema = z.object({
  type: z.string().refine(v => validBusinessTypeIds.includes(v), {
    message: `Invalid business type. Must be one of: ${validBusinessTypeIds.join(', ')}`,
  }),
  city: z.string().refine(v => validCityIds.includes(v), {
    message: `Invalid city. Must be one of: ${validCityIds.join(', ')}`,
  }),
  name: z.string()
    .min(1, 'Business name is required')
    .max(50, 'Business name must be 50 characters or less')
    .transform(v => v.trim()),
});

// ---- Inventory ----

export const buyInventorySchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  category: z.string().min(1, 'Category is required'),
  quantity: positiveIntSchema.max(10000, 'Quantity cannot exceed 10,000'),
});

export const sellInventorySchema = z.object({
  inventoryId: z.string().min(1, 'Inventory ID is required'),
  quantity: positiveIntSchema,
});

export const updatePriceSchema = z.object({
  sellPrice: nonNegativeNumberSchema,
});

// ---- Employee ----

const validRoleIds = EMPLOYEE_ROLES.map(r => r.role);

export const hireEmployeeSchema = z.object({
  role: z.string().refine(v => validRoleIds.includes(v), {
    message: `Invalid employee role. Must be one of: ${validRoleIds.join(', ')}`,
  }),
});

// ---- Loan ----

const LOAN_DURATION_OPTIONS = [10, 20, 30] as const;

export const takeLoanSchema = z.object({
  amount: positiveNumberSchema.min(50000, 'Minimum loan amount is ৳50,000'),
  days: z.number().refine(v => LOAN_DURATION_OPTIONS.includes(v as any), {
    message: `Loan duration must be one of: ${LOAN_DURATION_OPTIONS.join(', ')} days`,
  }),
});

export const repayLoanSchema = z.object({
  amount: positiveNumberSchema,
});

// ---- Game State ----

export const cityQuerySchema = z.object({
  city: z.string().min(1, 'City query parameter is required'),
});

export const leaderboardTypeSchema = z.enum(['networth', 'profit', 'reputation', 'businesses']);
