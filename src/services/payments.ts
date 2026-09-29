/**
 * src/services/payments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Payment gateway stubs — JazzCash / EasyPaisa.
 *
 * ⚠️  NOT YET IMPLEMENTED — all functions throw a clear error if called.
 *     This file exists to give the rest of the codebase a stable import path
 *     for future payment logic. Implement each function when payments go live.
 *
 * ACTIVATION CHECKLIST (when you're ready to go live):
 *   1. Add real keys to .env:
 *        VITE_JAZZCASH_MERCHANT_ID=your_merchant_id
 *        VITE_JAZZCASH_PASSWORD=your_integration_password
 *   2. Create a Supabase Edge Function (e.g., `process-payment`) that holds
 *      the full merchant credentials server-side and calls the JazzCash/EasyPaisa
 *      REST API — never call payment APIs directly from the browser.
 *   3. Replace the `throw NOT_IMPLEMENTED` lines below with real implementations.
 *   4. Add webhook handling for async payment status callbacks.
 *
 * Usage:
 *   import { initiateJazzCashPayment, isPaymentsConfigured } from '@/services/payments';
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ENV } from '@/config/env';

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOT_IMPLEMENTED = (fn: string) =>
  new Error(
    `[Smart Radar / payments] ${fn}() is not yet implemented. ` +
    `Payments are intentionally disabled until the user base is established. ` +
    `See src/services/payments.ts for the activation checklist.`
  );

/** True if JazzCash merchant credentials are present in the environment. */
export function isPaymentsConfigured(): boolean {
  return !!(ENV.payments.jazzCashMerchantId && ENV.payments.jazzCashPassword);
}

// ── Type definitions ──────────────────────────────────────────────────────────

export interface PaymentRequest {
  /** Amount in PKR (Pakistani Rupees). */
  amountPKR: number;
  /** Your internal order / transaction reference. */
  orderId: string;
  /** Short description shown on the payment screen. */
  description: string;
  /** Customer's MSISDN (phone number) for JazzCash mobile wallet payments. */
  customerMsisdn?: string;
  /** Customer email (optional, for receipts). */
  customerEmail?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  /** Raw response from the payment gateway (for debugging). */
  raw?: unknown;
  error?: string;
}

// ── JazzCash ──────────────────────────────────────────────────────────────────

/**
 * Initiates a JazzCash payment by calling the server-side Edge Function.
 *
 * @stub  Throws "not yet implemented" until payments are activated.
 */
export async function initiateJazzCashPayment(
  _request: PaymentRequest
): Promise<PaymentResult> {
  throw NOT_IMPLEMENTED('initiateJazzCashPayment');
}

/**
 * Checks the status of an existing JazzCash transaction.
 *
 * @stub  Throws "not yet implemented" until payments are activated.
 */
export async function checkJazzCashTransactionStatus(
  _transactionId: string
): Promise<PaymentResult> {
  throw NOT_IMPLEMENTED('checkJazzCashTransactionStatus');
}

// ── EasyPaisa ─────────────────────────────────────────────────────────────────

/**
 * Initiates an EasyPaisa payment.
 *
 * @stub  Throws "not yet implemented" until payments are activated.
 */
export async function initiateEasyPaisaPayment(
  _request: PaymentRequest
): Promise<PaymentResult> {
  throw NOT_IMPLEMENTED('initiateEasyPaisaPayment');
}

/**
 * Verifies an EasyPaisa callback/webhook payload.
 *
 * @stub  Throws "not yet implemented" until payments are activated.
 */
export async function verifyEasyPaisaCallback(
  _payload: unknown
): Promise<{ valid: boolean; transactionId?: string }> {
  throw NOT_IMPLEMENTED('verifyEasyPaisaCallback');
}

// ── Generic facade ────────────────────────────────────────────────────────────

export type PaymentProvider = 'jazzcash' | 'easypaisa';

/**
 * High-level payment entry-point. Routes to the correct provider.
 *
 * @stub  Throws "not yet implemented" until payments are activated.
 */
export async function pay(
  provider: PaymentProvider,
  _request: PaymentRequest
): Promise<PaymentResult> {
  void provider; // suppress unused warning until implemented
  throw NOT_IMPLEMENTED('pay');
}
