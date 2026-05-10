/**
 * Canonical test phone numbers for the StudioVerse automation suite.
 *
 * These six phones are pre-provisioned in Firebase Auth (test phone numbers
 * with fixed OTP). Two SuperAdmin accounts already exist; the remaining four
 * are deliberately not pre-created so registration tests can self-create them.
 *
 * The local Firebase Auth emulator accepts any phone + any 6-digit OTP, so the
 * same numbers also work against the emulator transparently.
 *
 * Tests must never hard-code phone numbers — always reference these constants.
 */

export const TEST_OTP = "000000";

export interface TestPhone {
  /** E.164-style local 10-digit Indian number used during dev. */
  number: string;
  /** Role the test should treat this phone as. */
  role: "superadmin" | "company" | "professional" | "individual";
  /** Whether the user account already exists in Firebase. */
  preCreated: boolean;
  /**
   * Optional sub-classification for tests that need to distinguish between
   * variants of the same role (e.g., company-associated vs independent coach).
   */
  variant?: "primary" | "secondary" | "company-associated" | "independent";
}

export const TEST_PHONES = {
  superAdminPrimary: {
    number: "9767676738",
    role: "superadmin",
    preCreated: true,
    variant: "primary",
  },
  superAdminSecondary: {
    number: "8623972504",
    role: "superadmin",
    preCreated: true,
    variant: "secondary",
  },
  // Self-registers via the public auth flow (phone → role → details).
  companySelfRegister: {
    number: "9604188725",
    role: "company",
    preCreated: false,
  },
  coachAssociated: {
    number: "9604188726",
    role: "professional",
    preCreated: false,
    variant: "company-associated",
  },
  individual: {
    number: "9167676738",
    role: "individual",
    preCreated: false,
  },
  // Provisioned by SA from the SuperAdmin portal (skips the public auth flow).
  companyByAdmin: {
    number: "9168676738",
    role: "company",
    preCreated: false,
  },
} as const satisfies Record<string, TestPhone>;

export type TestPhoneKey = keyof typeof TEST_PHONES;

/** Phone numbers as a flat list, useful for "all phones" assertions. */
export const ALL_TEST_PHONES: readonly TestPhone[] = Object.values(TEST_PHONES);
