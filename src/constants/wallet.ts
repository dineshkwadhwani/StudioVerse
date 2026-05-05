/**
 * Wallet transaction source types and redeemability rules.
 * 
 * Non-redeemable sources: Credits that can be used in the platform but cannot be cashed out.
 * Redeemable sources: Credits that can be used in the platform and converted to cash via cashout.
 */

export type WalletTransactionSource =
  | "registration"           // Non-redeemable: registration bonus
  | "profile-completion"     // Non-redeemable: profile completion reward
  | "referral"               // Non-redeemable: referral reward bonus
  | "bot-hero-incentive"     // Non-redeemable: bot hero incentive
  | "admin-allocation"       // Non-redeemable: manual admin allocation for onboarding/goodwill
  | "earned"                 // Redeemable: earned through activities
  | "purchased"              // Redeemable: purchased by user
  | "creator-earnings"       // Redeemable: earned as content creator
  | "assignment-return"      // Redeemable: returned from denied/cancelled assignment
  | "promotion-return"       // Redeemable: returned from denied promotion
  | "cashout"                // Redeemable: debit for cashout request (reverse transaction on refund)
  | "manual_offline_allocation"; // Non-redeemable: manual offline allocation

export const NON_REDEEMABLE_SOURCES: WalletTransactionSource[] = [
  "registration",
  "profile-completion",
  "referral",
  "bot-hero-incentive",
  "admin-allocation",
  "manual_offline_allocation",
];

export const PROFILE_COMPLETION_REWARD_COINS = 5;

export const REDEEMABLE_SOURCES: WalletTransactionSource[] = [
  "earned",
  "purchased",
  "creator-earnings",
  "assignment-return",
  "promotion-return",
  "cashout", // Only credit transactions (refunds) are redeemable; debit is used for cashout submission
];

export function isRedeemableSource(source: unknown): boolean {
  return REDEEMABLE_SOURCES.includes(source as WalletTransactionSource);
}

export function isNonRedeemableSource(source: unknown): boolean {
  return NON_REDEEMABLE_SOURCES.includes(source as WalletTransactionSource);
}
