/**
 * Canonical test phone numbers for the StudioVerse automation suite.
 *
 * These six phones are pre-provisioned in Firebase Auth (test phone numbers
 * with fixed OTP `000000`). The full set already exists in `studioverse-test`
 * Firestore (users + wallets) with the names below.
 *
 * The local Firebase Auth emulator accepts any phone + any 6-digit OTP, so the
 * same numbers also work against the emulator transparently.
 *
 * Tests must never hard-code phone numbers — always reference these constants.
 */

export const TEST_OTP = "000000";

export interface TestPhone {
  /** 10-digit local Indian number used during dev (no country code). */
  number: string;
  /** Internal role used by Firestore rules. */
  role: "superadmin" | "company" | "professional" | "individual";
  /** Display name of the user record in Firestore. */
  fullName: string;
  /** Whether the user record already exists in studioverse-test. */
  preCreated: boolean;
  /**
   * Optional sub-classification for tests that need to distinguish between
   * variants of the same role (e.g., company-associated vs independent coach).
   */
  variant?: "independent" | "company-associated";
}

export const TEST_PHONES = {
  superAdmin: {
    number: "9767676738",
    role: "superadmin",
    fullName: "StudioVerse Admin",
    preCreated: true,
  },
  company: {
    number: "9168676738",
    role: "company",
    fullName: "Narendra Chouhan",
    preCreated: true,
  },
  coachIndependent: {
    number: "9604188725",
    role: "professional",
    fullName: "Dinesh Wadhwani",
    preCreated: true,
    variant: "independent",
  },
  individualIndependent: {
    number: "9604188726",
    role: "individual",
    fullName: "Kartik Wagdeo",
    preCreated: true,
    variant: "independent",
  },
  coachAssociated: {
    number: "8623972504",
    role: "professional",
    fullName: "Shilpa Shegaonkar",
    preCreated: true,
    variant: "company-associated",
  },
  individualAssociated: {
    number: "9167676738",
    role: "individual",
    fullName: "Kiran Wadhwani",
    preCreated: true,
    variant: "company-associated",
  },
} as const satisfies Record<string, TestPhone>;

export type TestPhoneKey = keyof typeof TEST_PHONES;

/** Phone numbers as a flat list, useful for "all phones" assertions. */
export const ALL_TEST_PHONES: readonly TestPhone[] = Object.values(TEST_PHONES);
