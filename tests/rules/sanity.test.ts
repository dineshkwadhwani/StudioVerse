import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TEST_PROJECT_ID,
  EMULATOR_HOST,
  FIRESTORE_EMULATOR_PORT,
  isEmulatorReachable,
} from "../helpers/emulator";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const reachable = await isEmulatorReachable();
  if (!reachable) {
    throw new Error(
      `Firestore emulator not reachable on ${EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}. ` +
        `Run \`npm run emulator\` in another terminal first.`
    );
  }

  testEnv = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host: EMULATOR_HOST,
      port: FIRESTORE_EMULATOR_PORT,
      rules: readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe("Phase 0 sanity — Firestore rules wiring", () => {
  it("an unauthenticated user cannot read a users/{id} document (rule denies)", async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore();
    // Per firestore.rules, /users/{userId} requires isSignedIn() to read.
    await assertFails(getDoc(doc(db, "users", "no-such-user")));
  });

  it("a signed-in user can read users/{id} (rule allows isSignedIn)", async () => {
    // Seed via security-rules-bypass admin context, then read via signed-in client.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "u-test"), {
        uid: "u-test",
        userType: "individual",
        tenantId: "t-1",
      });
    });

    const ctx = testEnv.authenticatedContext("u-test");
    await assertSucceeds(getDoc(doc(ctx.firestore(), "users", "u-test")));
  });
});
