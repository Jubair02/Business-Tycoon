// ============================================
// Bangladesh Business Tycoon - Payment & Ad Providers
// ============================================
//
// Taking money and serving rewarded video both need an account with somebody
// else, and neither can be tested without one. So both sit behind an interface
// with a working sandbox implementation, and the game talks only to the
// interface.
//
// That is not a placeholder — it is the right shape regardless. The Bangladeshi
// market is served by SSLCommerz (which itself fronts bKash, Nagad and cards),
// not by the provider a codebase would default to, and a game that hardcodes
// one processor cannot follow its own market.
//
// ---- What still needs doing before real money moves ----
//
//   * Set PAYMENT_PROVIDER and the matching credentials (see .env.example).
//   * Implement `createCheckout` and `verifyCallback` for that provider — the
//     SSLCommerz adapter below documents exactly what each one has to do.
//   * Point the provider's IPN/webhook at /api/commerce/callback.
//
// Until then PAYMENT_PROVIDER stays "sandbox" and the store is fully playable
// without charging anybody.

import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

export type PaymentProviderId = 'sandbox' | 'sslcommerz' | 'stripe';

export interface CheckoutRequest {
  purchaseId: string;
  sku: string;
  priceMinor: number;
  currency: string;
  userId: string;
  /** Where the provider should send the player back to. */
  returnUrl: string;
}

export interface CheckoutSession {
  /** Where to send the player to pay. Null when it settles without one. */
  redirectUrl: string | null;
  providerRef: string;
  /** True when the payment is already complete — the sandbox's whole trick. */
  settledImmediately: boolean;
}

export interface CallbackResult {
  purchaseId: string;
  providerRef: string;
  status: 'PAID' | 'FAILED';
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Verify a callback and say what it means.
   *
   * Returning null means "not authentic" — never "unknown". An unverified
   * callback that granted an entitlement would be a way to buy things for free.
   */
  verifyCallback(payload: Record<string, unknown>, signature: string | null): Promise<CallbackResult | null>;
}

/**
 * Settles instantly, without a network call.
 *
 * This is what local development, the test suite and any deployment without
 * credentials use. It is deliberately obvious in the data: every purchase it
 * creates is stamped with provider "sandbox", so a real ledger can never be
 * confused with a fake one.
 */
class SandboxPaymentProvider implements PaymentProvider {
  readonly id = 'sandbox' as const;

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    return {
      redirectUrl: null,
      providerRef: `sandbox_${request.purchaseId}`,
      settledImmediately: true,
    };
  }

  async verifyCallback(): Promise<CallbackResult | null> {
    // Nothing calls back: the sandbox settles at checkout.
    return null;
  }
}

/**
 * SSLCommerz — the usual choice for Bangladesh, fronting bKash, Nagad and cards.
 *
 * Unimplemented on purpose: it needs a store id and password that this
 * repository does not have and should not contain. The two methods below
 * document precisely what an implementation owes, so wiring it up is a
 * contained piece of work rather than an archaeology exercise.
 */
class SslCommerzPaymentProvider implements PaymentProvider {
  readonly id = 'sslcommerz' as const;

  async createCheckout(): Promise<CheckoutSession> {
    // POST to https://securepay.sslcommerz.com/gwprocess/v4/api.php with
    // store_id, store_passwd, total_amount, currency, tran_id = purchaseId,
    // success_url / fail_url / cancel_url, and the customer fields SSLCommerz
    // requires. Return `GatewayPageURL` as redirectUrl and `sessionkey` as
    // providerRef, with settledImmediately false.
    throw new Error(
      'SSLCommerz is selected but not implemented. Set PAYMENT_PROVIDER=sandbox, ' +
        'or implement createCheckout/verifyCallback in lib/commerce/providers.ts.',
    );
  }

  async verifyCallback(): Promise<CallbackResult | null> {
    // SSLCommerz posts an IPN which must be validated by calling their
    // validation API with val_id — the POST body alone is NOT trustworthy.
    // Return PAID only when that call reports VALID or VALIDATED *and* the
    // amount and currency match the stored purchase.
    throw new Error('SSLCommerz callback verification is not implemented.');
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly id = 'stripe' as const;

  async createCheckout(): Promise<CheckoutSession> {
    // Create a Checkout Session with client_reference_id = purchaseId; return
    // its url and id.
    throw new Error(
      'Stripe is selected but not implemented. Set PAYMENT_PROVIDER=sandbox, ' +
        'or implement createCheckout/verifyCallback in lib/commerce/providers.ts.',
    );
  }

  async verifyCallback(): Promise<CallbackResult | null> {
    // Verify the Stripe-Signature header against STRIPE_WEBHOOK_SECRET before
    // reading a single field of the body.
    throw new Error('Stripe callback verification is not implemented.');
  }
}

let cachedProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider;

  switch ((process.env.PAYMENT_PROVIDER || 'sandbox').toLowerCase()) {
    case 'sslcommerz':
      cachedProvider = new SslCommerzPaymentProvider();
      break;
    case 'stripe':
      cachedProvider = new StripePaymentProvider();
      break;
    default:
      cachedProvider = new SandboxPaymentProvider();
  }

  return cachedProvider;
}

/** Exposed for tests, which switch providers between cases. */
export function resetPaymentProvider(): void {
  cachedProvider = null;
}

// ============================================
// Rewarded video
// ============================================

export interface RewardCallback {
  userId: string;
  placement: string;
  providerRef: string;
}

/**
 * Verify an ad network's server-side reward callback.
 *
 * Every rewarded-video network signs these, and every one of them must be
 * checked: an unverified reward callback is an open endpoint that hands out
 * rewards to anyone who can spell the URL.
 *
 * Returns null when the signature is absent, malformed or wrong.
 */
export function verifyAdReward(
  params: { userId: string; placement: string; providerRef: string; signature: string | null },
  secret = process.env.AD_SSV_SECRET,
): RewardCallback | null {
  if (!secret) return null;
  if (!params.signature) return null;
  if (!params.userId || !params.placement || !params.providerRef) return null;

  // The signed message includes the transaction id, so a valid signature cannot
  // be replayed for a different reward — and the id's uniqueness constraint
  // stops it being replayed for the same one.
  const message = `${params.userId}:${params.placement}:${params.providerRef}`;
  const expected = createHmac('sha256', secret).update(message).digest('hex');

  const provided = params.signature.trim().toLowerCase();
  if (provided.length !== expected.length) return null;

  try {
    if (!timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))) {
      return null;
    }
  } catch {
    return null;
  }

  return { userId: params.userId, placement: params.placement, providerRef: params.providerRef };
}

/** Sign a reward callback. Used by the tests and by the sandbox ad provider. */
export function signAdReward(
  params: { userId: string; placement: string; providerRef: string },
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${params.userId}:${params.placement}:${params.providerRef}`)
    .digest('hex');
}

/** Whether rewarded placements should be offered at all. */
export function adsEnabled(): boolean {
  const provider = (process.env.AD_PROVIDER || 'none').toLowerCase();
  return provider !== 'none' && Boolean(process.env.AD_SSV_SECRET);
}

/** A fresh idempotency key for a checkout attempt. */
export function newIdempotencyKey(): string {
  return randomUUID();
}
