/**
 * src/services/payments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * JazzCash / EasyPaisa — NOT YET ACTIVATED. Every call throws a clear error.
 *
 * ACTIVATION CHECKLIST
 *   1. Store merchant credentials as Edge Function secrets (never VITE_ vars):
 *        supabase secrets set JAZZCASH_MERCHANT_ID=... JAZZCASH_PASSWORD=... JAZZCASH_INTEGRITY_SALT=...
 *   2. Create + deploy a `process-payment` Edge Function that signs requests
 *      and calls the gateway server-side.
 *   3. Add a webhook Edge Function for async payment status callbacks that
 *      marks posts as featured (posts.is_featured) via the service role.
 *   4. Set VITE_ENABLE_PAYMENTS=true and implement the functions below by
 *      invoking the Edge Function.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ENV } from '@/config/env';

export type PaymentProvider = 'jazzcash' | 'easypaisa';

export interface PaymentRequest {
  amountPKR: number;
  orderId: string;
  description: string;
  customerMsisdn?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export function isPaymentsEnabled(): boolean {
  return ENV.features.payments;
}

const notImplemented = (fn: string) =>
  new Error(`[Be Alert / payments] ${fn}() is not implemented yet. See src/services/payments.ts for the activation checklist.`);

export async function pay(provider: PaymentProvider, request: PaymentRequest): Promise<PaymentResult> {
  void provider;
  void request;
  throw notImplemented('pay');
}

export async function checkTransactionStatus(provider: PaymentProvider, transactionId: string): Promise<PaymentResult> {
  void provider;
  void transactionId;
  throw notImplemented('checkTransactionStatus');
}
