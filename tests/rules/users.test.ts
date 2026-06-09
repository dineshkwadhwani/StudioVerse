/**
 * Rules — /users/{userId}.
 *
 * Covers each arm of the `update` rule plus delete-is-forbidden. This is the
 * rule that has bitten us repeatedly — every arm gets a positive AND a
 * matching negative check.
 *
 * Conventions:
 *   - "company-A" is a Company user whose own /users doc has
 *     userType="company", tenantId=TENANT_A. Their auth.uid is the same as
 *     their userId.
 *   - "professional-P" / "individual-I" are downstream users.
 *   - For Company-arm tests, "already owned by another company" means the
 *     target user's `associatedCompanyId` is set to a different Company's uid.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import {
  authedContext,
  cleanupRulesEnv,
  seedUser,
  seedWithoutRules,
  setupRulesEnv,
  TENANT_A,
  TENANT_B,
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

describe("/users update — own profile arm", () => {
  it("user can update their own /users doc", async () => {
    await seedUser(env, { uid: "self-1", userType: "individual" });
    const ctx = authedContext(env, "self-1");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "self-1"), { fullName: "New Name" })
    );
  });

  it("user cannot update someone else's /users doc via the own-profile arm", async () => {
    await seedUser(env, { uid: "self-1", userType: "individual" });
    await seedUser(env, { uid: "other-1", userType: "individual" });
    const ctx = authedContext(env, "self-1");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "users", "other-1"), { fullName: "Hijacked" })
    );
  });
});

describe("/users update — Company arms", () => {
  it("Company can update a user already associated to them", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "prof-already",
      userType: "professional",
      tenantId: TENANT_A,
      associatedCompanyId: "company-A",
    });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "prof-already"), { fullName: "Updated" })
    );
  });

  it("Company can associate an UNASSOCIATED professional in the same tenant", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "prof-unassoc",
      userType: "professional",
      tenantId: TENANT_A,
      associatedCompanyId: null,
    });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "prof-unassoc"), {
        associatedCompanyId: "company-A",
      })
    );
  });

  it("Company can associate an UNASSOCIATED individual in the same tenant", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "ind-unassoc",
      userType: "individual",
      tenantId: TENANT_A,
      associatedCompanyId: null,
    });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "ind-unassoc"), {
        associatedCompanyId: "company-A",
      })
    );
  });

  it("Company CANNOT reassign a professional already owned by another company", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, { uid: "company-B", userType: "company", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "prof-of-B",
      userType: "professional",
      tenantId: TENANT_A,
      associatedCompanyId: "company-B",
    });
    const ctx = authedContext(env, "company-A");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "users", "prof-of-B"), {
        associatedCompanyId: "company-A",
      })
    );
  });

  it("Company in a different tenant CANNOT claim an unassociated user", async () => {
    await seedUser(env, { uid: "company-otherTenant", userType: "company", tenantId: TENANT_B });
    await seedUser(env, {
      uid: "ind-unassoc",
      userType: "individual",
      tenantId: TENANT_A,
      associatedCompanyId: null,
    });
    const ctx = authedContext(env, "company-otherTenant");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "users", "ind-unassoc"), {
        associatedCompanyId: "company-otherTenant",
      })
    );
  });
});

describe("/users update — Professional arms", () => {
  it("Professional can update an individual already linked to them", async () => {
    await seedUser(env, { uid: "prof-P", userType: "professional", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "ind-of-P",
      userType: "individual",
      tenantId: TENANT_A,
      associatedProfessionalId: "prof-P",
    });
    const ctx = authedContext(env, "prof-P");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "ind-of-P"), { fullName: "Updated" })
    );
  });

  it("Professional can associate an UNASSOCIATED individual in the same tenant", async () => {
    await seedUser(env, { uid: "prof-P", userType: "professional", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "ind-unassoc",
      userType: "individual",
      tenantId: TENANT_A,
      associatedProfessionalId: null,
    });
    const ctx = authedContext(env, "prof-P");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "ind-unassoc"), {
        associatedProfessionalId: "prof-P",
      })
    );
  });

  it("Professional can associate an unassociated individual when their profile doc id differs from auth uid", async () => {
    await seedWithoutRules(env, async (db) => {
      await setDoc(doc(db, "users", "coach-profile-1"), {
        uid: "prof-auth-1",
        userId: "prof-auth-1",
        userType: "professional",
        tenantId: TENANT_A,
        fullName: "Coach Profile",
        associatedCompanyId: null,
        associatedProfessionalId: null,
        status: "active",
      });
      await setDoc(doc(db, "users", "ind-unassoc"), {
        uid: "ind-auth-1",
        userId: "ind-auth-1",
        userType: "individual",
        tenantId: TENANT_A,
        fullName: "Unassociated Individual",
        associatedCompanyId: null,
        associatedProfessionalId: null,
        status: "active",
      });
    });

    const ctx = authedContext(env, "prof-auth-1");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "ind-unassoc"), {
        associatedProfessionalId: "coach-profile-1",
      })
    );
  });

  it("Professional CANNOT touch another professional's /users doc", async () => {
    await seedUser(env, { uid: "prof-P", userType: "professional", tenantId: TENANT_A });
    await seedUser(env, { uid: "prof-Q", userType: "professional", tenantId: TENANT_A });
    const ctx = authedContext(env, "prof-P");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "users", "prof-Q"), { fullName: "Hijacked" })
    );
  });

  it("Professional CANNOT claim an individual already linked to a different professional", async () => {
    await seedUser(env, { uid: "prof-P", userType: "professional", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "ind-of-Q",
      userType: "individual",
      tenantId: TENANT_A,
      associatedProfessionalId: "prof-Q",
    });
    const ctx = authedContext(env, "prof-P");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "users", "ind-of-Q"), {
        associatedProfessionalId: "prof-P",
      })
    );
  });
});

describe("/users delete — forbidden for everyone", () => {
  it("SuperAdmin (claim) cannot delete a user doc", async () => {
    await seedUser(env, { uid: "target", userType: "individual" });
    const ctx = authedContext(env, "sa-uid", { superadmin: true });
    await assertFails(deleteDoc(doc(ctx.firestore(), "users", "target")));
  });

  it("Company cannot delete a user doc they own", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, {
      uid: "ind-of-A",
      userType: "individual",
      tenantId: TENANT_A,
      associatedCompanyId: "company-A",
    });
    const ctx = authedContext(env, "company-A");
    await assertFails(deleteDoc(doc(ctx.firestore(), "users", "ind-of-A")));
  });

  it("User cannot delete their own doc", async () => {
    await seedUser(env, { uid: "self-1", userType: "individual" });
    const ctx = authedContext(env, "self-1");
    await assertFails(deleteDoc(doc(ctx.firestore(), "users", "self-1")));
  });
});

// Pin the import so TS doesn't tree-shake — `expect` is used implicitly via
// assertSucceeds/assertFails throwing on the wrong outcome.
expect; // keep import live for vitest
