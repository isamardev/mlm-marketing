/** Minimum USDT amount for withdrawal requests and P2P transfers. */
export const MIN_WITHDRAW_OR_P2P_USDT = 5;

/** Percentage deducted from the requested withdrawal amount before payout. */
export const WITHDRAW_FEE_PERCENT = 10;

/** Net USDT the user receives after the withdrawal fee (2 decimals). */
export function withdrawNetAfterFee(grossUSDT: number): number {
  return Number((grossUSDT * (1 - WITHDRAW_FEE_PERCENT / 100)).toFixed(2));
}
