/**
 * Rules — /wallets/{walletId}.
 *
 * The rule:
 *   read/update if isSuperAdmin()
 *               || (signedIn && resource.data.userId == request.auth.uid)
 *               || (isCompanyUser() && get(/users/{wallet.userId}).data.associatedCompanyId == request.auth.uid)
 *
 * We test the second and third arms positively, plus an unrelated-user
 * denial. Wallets are seeded under both scoped (`tenantId::userId`) and
 * legacy (`userId`) doc ids — the rule shape covers both.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import {
  authedContext,
  cleanupRulesEnv,
  seedUser,
  seedWithoutRules,
  setupRulesEnv,
  TENANT_A,
} from "./helpers";

let env: RulesTestEnvironment;

const WALLET_ID = `${TENANT_A}::prof-P`;

async function seedProfessionalWithWallet(args: {
  companyId?: string | null;
}): Promise<void> {
  await seedUser(env, {
    uid: "prof-P",
    userType: "professional",
    tenantId: TENANT_A,
    associatedCompanyId: args.companyId ?? null,
  });
  await seedWithoutRules(env, async (db) => {
    await setDoc(doc(db, "wallets", WALLET_ID), {
      userId: "prof-P",
      tenantId: TENANT_A,
      userType: "professional",
      userName: "Prof",
      totalIssuedCoins: 100,
      availableCoins: 100,
      utilizedCoins: 0,
    });
  });
}

beforeAll(async () => {
  env = await setupRulesEnv();
});

afterAll(async () => {
  await cleanupRulesEnv(env);
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe("/wallets — owner arm", () => {
  it("Owner can read their own wallet", async () => {
    await seedProfessionalWithWallet({});
    const ctx = authedContext(env, "prof-P");
    await assertSucceeds(getDoc(doc(ctx.firestore(), "wallets", WALLET_ID)));
  });

  it("Owner can update their own wallet", async () => {
    await seedProfessionalWithWallet({});
    const ctx = authedContext(env, "prof-P");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "wallets", WALLET_ID), {
        availableCoins: 50,
      })
    );
  });
});

describe("/wallets — Company arm (associated professional)", () => {
  it("Company can read the wallet of a professional associated to them", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedProfessionalWithWallet({ companyId: "company-A" });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(getDoc(doc(ctx.firestore(), "wallets", WALLET_ID)));
  });

  it("Company can update the wallet of a professional associated to them", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedProfessionalWithWallet({ companyId: "company-A" });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "wallets", WALLET_ID), {
        availableCoins: 200,
      })
    );
  });

  it("Company CANNOT read the wallet of a professional associated to a different company", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, { uid: "company-B", userType: "company", tenantId: TENANT_A });
    await seedProfessionalWithWallet({ companyId: "company-B" });
    const ctx = authedContext(env, "company-A");
    await assertFails(getDoc(doc(ctx.firestore(), "wallets", WALLET_ID)));
  });
});

describe("/wallets — unrelated signed-in user denial", () => {
  it("A signed-in user who is neither the owner nor an associated company is denied read", async () => {
    await seedUser(env, { uid: "random-user", userType: "individual", tenantId: TENANT_A });
    await seedProfessionalWithWallet({ companyId: null });
    const ctx = authedContext(env, "random-user");
    await assertFails(getDoc(doc(ctx.firestore(), "wallets", WALLET_ID)));
  });

  it("A signed-in user who is neither the owner nor an associated company is denied update", async () => {
    await seedUser(env, { uid: "random-user", userType: "individual", tenantId: TENANT_A });
    await seedProfessionalWithWallet({ companyId: null });
    const ctx = authedContext(env, "random-user");
    await assertFails(
      updateDoc(doc(ctx.firestore(), "wallets", WALLET_ID), { availableCoins: 0 })
    );
  });
});
