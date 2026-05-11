/**
 * Rules — isSuperAdmin() detection.
 *
 * The rule treats a caller as SuperAdmin if EITHER:
 *   • their token has `superadmin: true` as a custom claim, OR
 *   • their /users/{uid} doc has `userType == "superadmin"`.
 *
 * We probe SA-only writes (coinPackages, promotionPackages,
 * assessmentQuestions) from three identities:
 *   1. claim-based SA  → should succeed
 *   2. doc-based SA    → should succeed
 *   3. plain signed-in → should fail
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc } from "firebase/firestore";
import {
  authedContext,
  cleanupRulesEnv,
  seedUser,
  setupRulesEnv,
} from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupRulesEnv();
});

afterAll(async () => {
  await cleanupRulesEnv(env);
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe("isSuperAdmin() — two paths", () => {
  it("custom claim `superadmin:true` can write coinPackages, promotionPackages, assessmentQuestions", async () => {
    const ctx = authedContext(env, "claim-sa-uid", { superadmin: true });
    const db = ctx.firestore();

    await assertSucceeds(setDoc(doc(db, "coinPackages", "pkg-1"), { name: "X", credits: 10 }));
    await assertSucceeds(setDoc(doc(db, "promotionPackages", "pp-1"), { name: "Y", credits: 5 }));
    await assertSucceeds(setDoc(doc(db, "assessmentQuestions", "q-1"), { questionText: "?" }));
  });

  it("/users doc with userType==superadmin (no claim) also passes", async () => {
    await seedUser(env, { uid: "doc-sa-uid", userType: "superadmin" });
    const ctx = authedContext(env, "doc-sa-uid");
    const db = ctx.firestore();

    await assertSucceeds(setDoc(doc(db, "coinPackages", "pkg-2"), { name: "X", credits: 10 }));
    await assertSucceeds(setDoc(doc(db, "promotionPackages", "pp-2"), { name: "Y", credits: 5 }));
    await assertSucceeds(setDoc(doc(db, "assessmentQuestions", "q-2"), { questionText: "?" }));
  });

  it("plain signed-in user (no claim, no SA doc) is denied", async () => {
    await seedUser(env, { uid: "plain-uid", userType: "individual" });
    const ctx = authedContext(env, "plain-uid");
    const db = ctx.firestore();

    await assertFails(setDoc(doc(db, "coinPackages", "pkg-3"), { name: "X", credits: 10 }));
    await assertFails(setDoc(doc(db, "promotionPackages", "pp-3"), { name: "Y", credits: 5 }));
    await assertFails(setDoc(doc(db, "assessmentQuestions", "q-3"), { questionText: "?" }));
  });

  it("signed-in with NO /users doc at all is denied (currentUserExists guard)", async () => {
    const ctx = authedContext(env, "no-doc-uid");
    const db = ctx.firestore();

    await assertFails(setDoc(doc(db, "coinPackages", "pkg-4"), { name: "X", credits: 10 }));
  });
});
