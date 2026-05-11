/**
 * Shared helpers for the Firestore Rules unit test suite.
 *
 * Tests run against the local Firestore emulator with the project's actual
 * `firestore.rules`. Each test file should call `setupRulesEnv()` in
 * `beforeAll` and `cleanupRulesEnv()` in `afterAll`. Between tests, call
 * `testEnv.clearFirestore()` so docs from one test don't leak into another.
 *
 * Token claims (custom claims like `superadmin: true` or
 * `phone_number: "+91..."`) are passed via the second arg to
 * `authenticatedContext`. The rules engine sees them under
 * `request.auth.token.*`.
 */

import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import path from "node:path";
import { setDoc, doc, type Firestore } from "firebase/firestore";
import {
  TEST_PROJECT_ID,
  EMULATOR_HOST,
  FIRESTORE_EMULATOR_PORT,
  isEmulatorReachable,
} from "../helpers/emulator";

export const MASTER_SA_PHONE = "+919767676738";
export const TENANT_A = "coaching-studio";
export const TENANT_B = "training-studio";

export interface TestUserSeed {
  /** Doc id (== uid in our convention). */
  uid: string;
  userType: "superadmin" | "company" | "professional" | "individual";
  tenantId?: string;
  associatedCompanyId?: string | null;
  associatedProfessionalId?: string | null;
  fullName?: string;
}

/**
 * Initialise the rules-unit-testing environment with the project's actual
 * rules. Throws if the emulator isn't reachable.
 */
export async function setupRulesEnv(): Promise<RulesTestEnvironment> {
  const reachable = await isEmulatorReachable();
  if (!reachable) {
    throw new Error(
      `Firestore emulator not reachable on ${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}. ` +
        `Run \`npm run emulator\` in another terminal first.`
    );
  }

  return initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: FIRESTORE_EMULATOR_PORT,
      rules: readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
}

export async function cleanupRulesEnv(env: RulesTestEnvironment | null): Promise<void> {
  await env?.cleanup();
}

/**
 * Run a setup block with security rules disabled so we can seed fixture
 * docs. Use this in `beforeEach` of each test.
 */
export async function seedWithoutRules(
  env: RulesTestEnvironment,
  fn: (db: Firestore) => Promise<void>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

/**
 * Seed a /users doc with the given role + association fields. Returns the
 * uid for chaining.
 */
export async function seedUser(env: RulesTestEnvironment, user: TestUserSeed): Promise<string> {
  await seedWithoutRules(env, async (db) => {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      userId: user.uid,
      userType: user.userType,
      tenantId: user.tenantId ?? TENANT_A,
      fullName: user.fullName ?? user.uid,
      associatedCompanyId: user.associatedCompanyId ?? null,
      associatedProfessionalId: user.associatedProfessionalId ?? null,
      status: "active",
    });
  });
  return user.uid;
}

/**
 * Authenticated context that the rules engine treats as a signed-in user.
 * Pass `claims` to set token claims like `{ superadmin: true }` or
 * `{ phone_number: "+91..." }`.
 */
export function authedContext(
  env: RulesTestEnvironment,
  uid: string,
  claims?: Record<string, unknown>
): RulesTestContext {
  return env.authenticatedContext(uid, claims);
}

export function anonymousContext(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext();
}
