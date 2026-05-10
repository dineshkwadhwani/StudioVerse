/**
 * Auth helpers for tests — sign in as each role using Firebase Auth emulator.
 *
 * Phase 0: skeleton only. Real implementations land in Phase 1 when the
 * first authenticated tests need them. The emulator allows arbitrary uid
 * tokens, so we will mint test tokens directly rather than going through
 * the phone-OTP UI.
 */

export type Role = "superadmin" | "company" | "professional" | "individual";

export interface TestSignInArgs {
  uid: string;
  role: Role;
  tenantId: string;
  email?: string;
}

export async function signInAs(_args: TestSignInArgs): Promise<{ idToken: string }> {
  throw new Error("signInAs: not yet implemented (Phase 1)");
}
