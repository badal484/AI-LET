/**
 * Native store billing (StoreKit / Google Play Billing) is not integrated in this build: there is no
 * IAP library, so the app cannot obtain a real receipt. The server rejects anything that is not a
 * provider-verified receipt, so rather than fabricate one the purchase UI states that purchasing is
 * unavailable. Wire a real IAP library here and flip `isAvailable` once it can return receipts.
 */
export const StoreBilling = {
  isAvailable: false as boolean,
  unavailableMessage:
    'In-app purchases are not available in this version of the app yet. Your current plan and credits are unaffected.',
};

export class StoreBillingUnavailableError extends Error {
  constructor() {
    super(StoreBilling.unavailableMessage);
    this.name = 'StoreBillingUnavailableError';
  }
}
