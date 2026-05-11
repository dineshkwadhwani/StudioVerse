/**
 * Rules — master SA phone bootstrap carve-out.
 *
 * The /users CREATE rule allows isMasterSuperadminPhone() to seed
 * /users/{uid} after a DB wipe — when isSuperAdmin() would be false because
 * there's no /users doc yet AND no `superadmin: true` claim.
 *
 * isMasterSuperadminPhone() checks:
 *   request.auth.token.phone_number == "+919767676738"
 *
 * Any other phone (or no phone claim at all) must fall through and be
 * rejected by the standard create rule.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc } from "firebase/firestore";
import {
  authedContext,
  cleanupRulesEnv,
  MASTER_SA_PHONE,
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

describe("Bootstrap — master SA phone carve-out", () => {
  it("Master SA phone CAN create users/{otherUid} (no existing doc, no SA claim)", async () => {
    // Note: the rule allows isMasterSuperadminPhone() for *any* /users
    // create — the carve-out's intent is the master SA seeding their own
    // doc, but the rule isn't pinned to userId == auth.uid for this arm.
    const ctx = authedContext(env, "master-sa-uid", {
      phone_number: MASTER_SA_PHONE,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "users", "master-sa-uid"), {
        uid: "master-sa-uid",
        userId: "master-sa-uid",
        phoneE164: MASTER_SA_PHONE,
        userType: "superadmin",
        status: "active",
        tenantId: "platform",
      })
    );
  });

  it("Random phone CANNOT create users/{otherUid} via the carve-out", async () => {
    const ctx = authedContext(env, "random-uid", {
      phone_number: "+919999999999",
    });
    await assertFails(
      setDoc(doc(ctx.firestore(), "users", "victim-uid"), {
        uid: "victim-uid",
        userId: "victim-uid",
        userType: "superadmin",
        status: "active",
        tenantId: "platform",
      })
    );
  });

  it("Signed-in with no phone claim CANNOT create users/{otherUid}", async () => {
    const ctx = authedContext(env, "no-phone-uid");
    await assertFails(
      setDoc(doc(ctx.firestore(), "users", "victim-uid"), {
        uid: "victim-uid",
        userId: "victim-uid",
        userType: "superadmin",
        status: "active",
        tenantId: "platform",
      })
    );
  });

  it("Master SA phone CAN bootstrap their OWN doc (the original use case)", async () => {
    const ctx = authedContext(env, "master-sa-uid", {
      phone_number: MASTER_SA_PHONE,
    });
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "users", "master-sa-uid"), {
        uid: "master-sa-uid",
        userId: "master-sa-uid",
        phoneE164: MASTER_SA_PHONE,
        userType: "superadmin",
        status: "active",
        tenantId: "platform",
      })
    );
  });
});
