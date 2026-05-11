/**
 * Rules — exact write operations that saveCohort issues from the client.
 *
 * `saveCohort()` (src/services/cohorts.service.ts) issues a writeBatch with
 * up to four kinds of writes:
 *
 *   1. cohorts/{id}          — create the cohort doc
 *   2. cohortMembers/{id}    — create one per member
 *   3. invitations/{id}      — create one per new (not-yet-registered) member
 *   4. users/{individualId}  — merge-update with associatedProfessionalId /
 *                              associatedCompanyId
 *
 * Each must pass rules independently. We test from a Company actor here;
 * Professional cohort creation is covered indirectly by the /users.test.ts
 * Professional arm tests.
 */

import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, updateDoc } from "firebase/firestore";
import {
  authedContext,
  cleanupRulesEnv,
  seedUser,
  setupRulesEnv,
  TENANT_A,
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

describe("Cohort creation batch — Company actor", () => {
  it("Company can create a cohorts/{id} doc", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "cohorts", "cohort-1"), {
        tenantId: TENANT_A,
        companyId: "company-A",
        professionalId: null,
        name: "Test Cohort",
        memberCount: 0,
        status: "inactive",
        createdByUserId: "company-A",
        createdByRole: "company",
      })
    );
  });

  it("Company can create a cohortMembers/{id} doc", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "cohortMembers", "member-1"), {
        cohortId: "cohort-1",
        individualUserId: "some-individual",
        addedByUserId: "company-A",
      })
    );
  });

  it("Company can create an invitations/{id} doc for a new member", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), "invitations", "invite-1"), {
        tenantId: TENANT_A,
        phoneE164: "+919000000001",
        email: "newbie@example.com",
        userType: "individual",
        status: "pending",
        createdByUserId: "company-A",
        createdByRole: "company",
      })
    );
  });

  it("Company can merge-update users/{individualId} (associatedCompanyId == self) to set associatedProfessionalId", async () => {
    await seedUser(env, { uid: "company-A", userType: "company", tenantId: TENANT_A });
    await seedUser(env, { uid: "prof-of-A", userType: "professional", tenantId: TENANT_A, associatedCompanyId: "company-A" });
    await seedUser(env, {
      uid: "ind-of-A",
      userType: "individual",
      tenantId: TENANT_A,
      associatedCompanyId: "company-A",
    });

    const ctx = authedContext(env, "company-A");
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), "users", "ind-of-A"), {
        associatedProfessionalId: "prof-of-A",
      })
    );
  });
});
