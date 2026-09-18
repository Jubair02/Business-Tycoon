// ============================================
// Bangladesh Business Tycoon - Validation Schemas
// Phase 0: Zod schemas for all mutation API routes
// ============================================

import { z } from 'zod';
import { CITIES, BUSINESS_TYPES, EMPLOYEE_ROLES } from '@/lib/game-data';
// Imported from the config module rather than the barrel: this only needs the
// location table, and the barrel would drag the formulas in with it.
import { LOCATIONS, getLocation } from '@/lib/game/expansion/expansion-config';

// ---- Reusable primitives ----

export const cuidSchema = z.string().min(1, 'ID is required').max(50);

export const positiveIntSchema = z
  .number({ error: 'Must be a number' })
  .int('Must be an integer')
  .positive('Must be positive');

export const nonNegativeNumberSchema = z
  .number({ error: 'Must be a number' })
  .finite('Must be a finite number')
  .nonnegative('Must be non-negative');

export const positiveNumberSchema = z
  .number({ error: 'Must be a number' })
  .finite('Must be a finite number')
  .positive('Must be positive');

// ---- Accounts ----

const displayNameSchema = z.string()
  .transform(v => v.trim())
  .pipe(
    z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(30, 'Name must be 30 characters or less')
  );

const emailSchema = z.string()
  .transform(v => v.trim().toLowerCase())
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'));

// Length does more for password strength than character-class rules, so the
// bar is a floor on length rather than a symbol checklist.
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be 200 characters or less');

export const signupSchema = z.object({
  name: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

// ---- Business ----

const validCityIds = CITIES.map(c => c.id);
const validBusinessTypeIds = BUSINESS_TYPES.map(b => b.id);
const validLocationIds = LOCATIONS.map(l => l.id);

export const createBusinessSchema = z.object({
  type: z.string().refine(v => validBusinessTypeIds.includes(v), {
    message: `Invalid business type. Must be one of: ${validBusinessTypeIds.join(', ')}`,
  }),
  city: z.string().refine(v => validCityIds.includes(v), {
    message: `Invalid city. Must be one of: ${validCityIds.join(', ')}`,
  }),
  name: z.string()
    .transform(v => v.trim())
    .pipe(
      z.string()
        .min(1, 'Business name is required')
        .max(50, 'Business name must be 50 characters or less')
    ),
  /**
   * Optional: a business with no location falls back to city-level modifiers.
   * When present it must be a real location id — an unknown string used to be
   * accepted and persisted, because the route read this field through an
   * untyped cast rather than the schema.
   */
  location: z.string()
    .refine(v => validLocationIds.includes(v), { message: 'Unknown location' })
    .optional(),
}).refine(
  // A location supersedes its city for both demand and rent
  // (`calculateLocationDemandModifier` / `calculateLocationRentModifier`), so a
  // mismatched pair is not cosmetic: it lets a player take one city's market
  // prices while sitting on another city's footfall, and it makes the city
  // spread, the city leaderboard filter and the multi-city achievement lie.
  data => !data.location || getLocation(data.location)?.cityId === data.city,
  { message: 'That location is not in the selected city', path: ['location'] },
);

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

// ---- Standing restock order ----
//
// The bounds mirror RESTOCK_LIMITS so a save can never hold an order that the
// planner would have to silently clamp. Threshold below target is enforced as
// a whole-object rule: an order that refills to less than it triggers at would
// buy stock every single tick and never settle.
export const restockSettingsSchema = z
  .object({
    autoRestock: z.boolean(),
    autoRestockThreshold: z.number().finite().min(0.05).max(0.9),
    autoRestockTarget: z.number().finite().min(0.1).max(1),
    autoRestockBudget: z.number().finite().nonnegative().max(1_000_000_000).nullable(),
  })
  .refine(v => v.autoRestockTarget > v.autoRestockThreshold, {
    message: 'Refill level must be above the trigger level',
    path: ['autoRestockTarget'],
  });

export const manualRestockSchema = z.object({
  /** Refill every product to this share of its shelf space. */
  target: z.number().finite().min(0.1).max(1).default(1),
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

// ---- Marketing / Campaigns ----

const VALID_CHANNELS = ['SOCIAL_MEDIA', 'FACEBOOK_ADS', 'LOCAL_ADS', 'INFLUENCER', 'BILLBOARD', 'TV_MEDIA'] as const;
const VALID_SEGMENTS = ['BUDGET', 'REGULAR', 'PREMIUM', 'TOURIST'] as const;

export const createCampaignSchema = z.object({
  name: z.string()
    .transform(v => v.trim())
    .pipe(
      z.string()
        .min(1, 'Campaign name is required')
        .max(50, 'Campaign name must be 50 characters or less')
    ),
  channel: z.enum(VALID_CHANNELS, {
    message: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`,
  }),
  targetSegment: z.enum(VALID_SEGMENTS, {
    message: `Invalid segment. Must be one of: ${VALID_SEGMENTS.join(', ')}`,
  }).nullable().optional(),
  dailyBudget: positiveNumberSchema.min(250, 'Daily budget must be at least ৳250'),
  duration: positiveIntSchema.min(3, 'Duration must be at least 3 days').max(30, 'Duration cannot exceed 30 days'),
});

export const campaignActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel'], {
    message: 'Action must be one of: pause, resume, cancel',
  }),
});

// ---- Game State ----

export const cityQuerySchema = z.object({
  city: z.string().min(1, 'City query parameter is required'),
});

export const leaderboardTypeSchema = z.enum(['networth', 'profit', 'reputation', 'businesses', 'revenue', 'marketshare']);
