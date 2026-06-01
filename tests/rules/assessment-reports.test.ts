import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import {
  authedContext,
  cleanupRulesEnv,
  seedUser,
  seedWithoutRules,
  setupRulesEnv,
  TENANT_A,
} from "./helpers";

let env: RulesTestEnvironment;

const ASSIGNMENT_ID = "assignment-report-1";
const REPORT_ID = "report-1";
const COACH_AUTH_UID = "coach-auth-1";
const COACH_PROFILE_DOC_ID = "coach-profile-1";
const INDIVIDUAL_AUTH_UID = "individual-auth-1";
const INDIVIDUAL_PROFILE_DOC_ID = "individual-profile-1";

beforeAll(async () => {
  env = await setupRulesEnv();
});

afterAll(async () => {
  await cleanupRulesEnv(env);
});

beforeEach(async () => {
  await env.clearFirestore();
});

async function seedAssignmentAndReport(): Promise<void> {
  await seedWithoutRules(env, async (db) => {
    await setDoc(doc(db, "users", COACH_PROFILE_DOC_ID), {
      uid: COACH_AUTH_UID,
      userId: COACH_AUTH_UID,
      userType: "professional",
      tenantId: TENANT_A,
      fullName: "Coach One",
      associatedCompanyId: null,
      associatedProfessionalId: null,
      status: "active",
    });

    await setDoc(doc(db, "users", INDIVIDUAL_PROFILE_DOC_ID), {
      uid: INDIVIDUAL_AUTH_UID,
      userId: INDIVIDUAL_AUTH_UID,
      userType: "individual",
      tenantId: TENANT_A,
      fullName: "Indi Vidual",
      associatedCompanyId: null,
      associatedProfessionalId: COACH_PROFILE_DOC_ID,
      status: "active",
    });
  });

  await seedWithoutRules(env, async (db) => {
    await setDoc(doc(db, "assignments", ASSIGNMENT_ID), {
      tenantId: TENANT_A,
      activityType: "assessment",
      activityId: "assessment-1",
      activityTitle: "Sample Assessment",
      creditsRequired: 0,
      assignerId: COACH_PROFILE_DOC_ID,
      assignerName: "Coach One",
      assigneeId: INDIVIDUAL_PROFILE_DOC_ID,
      assigneePhone: "960418726",
      assigneeEmail: "individual@example.com",
      assigneeFirstName: "Indi",
      assigneeLastName: "Vidual",
      assigneeFullName: "Indi Vidual",
      status: "completed",
      coinsDeducted: 0,
    });

    await setDoc(doc(db, "assessmentReports", REPORT_ID), {
      assessmentId: "assessment-1",
      attemptId: "attempt-1",
      tenantId: TENANT_A,
      userId: INDIVIDUAL_PROFILE_DOC_ID,
      assignmentId: ASSIGNMENT_ID,
      reportStyle: "executive",
      aiProvider: "test",
      analysisPromptUsed: "",
      aiResponseRaw: "",
      reportSummary: "Summary",
      reportStructuredData: {},
      pdfUrl: "",
    });
  });
}

async function seedLegacyAssignmentAndReport(): Promise<void> {
  await seedWithoutRules(env, async (db) => {
    await setDoc(doc(db, "users", COACH_PROFILE_DOC_ID), {
      uid: COACH_AUTH_UID,
      userId: COACH_AUTH_UID,
      userType: "professional",
      tenantId: TENANT_A,
      fullName: "Coach One",
      associatedCompanyId: null,
      associatedProfessionalId: null,
      status: "active",
    });

    await setDoc(doc(db, "users", INDIVIDUAL_PROFILE_DOC_ID), {
      uid: INDIVIDUAL_AUTH_UID,
      userId: INDIVIDUAL_AUTH_UID,
      userType: "individual",
      tenantId: TENANT_A,
      fullName: "Indi Vidual",
      associatedCompanyId: null,
      associatedProfessionalId: COACH_PROFILE_DOC_ID,
      status: "active",
    });
  });

  await seedWithoutRules(env, async (db) => {
    await setDoc(doc(db, "assignments", ASSIGNMENT_ID), {
      tenantId: TENANT_A,
      activityType: "assessment",
      activityId: "assessment-1",
      activityTitle: "Sample Assessment",
      creditsRequired: 0,
      assignedBy: COACH_PROFILE_DOC_ID,
      assignerName: "Coach One",
      assignedTo: INDIVIDUAL_PROFILE_DOC_ID,
      assigneePhone: "960418726",
      assigneeEmail: "individual@example.com",
      assigneeFirstName: "Indi",
      assigneeLastName: "Vidual",
      assigneeFullName: "Indi Vidual",
      status: "completed",
      coinsDeducted: 0,
    });

    await setDoc(doc(db, "assessmentReports", REPORT_ID), {
      assessmentId: "assessment-1",
      attemptId: "attempt-1",
      tenantId: TENANT_A,
      userId: INDIVIDUAL_PROFILE_DOC_ID,
      assignmentId: ASSIGNMENT_ID,
      reportStyle: "executive",
      aiProvider: "test",
      analysisPromptUsed: "",
      aiResponseRaw: "",
      reportSummary: "Summary",
      reportStructuredData: {},
      pdfUrl: "",
    });
  });
}

describe("/assessmentReports — assignment relationship access", () => {
  it("Assignee can read their assessment report", async () => {
    await seedAssignmentAndReport();
    const ctx = authedContext(env, INDIVIDUAL_AUTH_UID);

    await assertSucceeds(getDoc(doc(ctx.firestore(), "assessmentReports", REPORT_ID)));
  });

  it("Assigning coach can read the assignee assessment report", async () => {
    await seedAssignmentAndReport();
    const ctx = authedContext(env, COACH_AUTH_UID);

    await assertSucceeds(getDoc(doc(ctx.firestore(), "assessmentReports", REPORT_ID)));
    await assertSucceeds(
      getDocs(
        query(
          collection(ctx.firestore(), "assessmentReports"),
          where("assignmentId", "==", ASSIGNMENT_ID)
        )
      )
    );
  });

  it("Assigning coach can read reports for legacy assignments using assignedBy/assignedTo", async () => {
    await seedLegacyAssignmentAndReport();
    const ctx = authedContext(env, COACH_AUTH_UID);

    await assertSucceeds(getDoc(doc(ctx.firestore(), "assessmentReports", REPORT_ID)));
    await assertSucceeds(
      getDocs(
        query(
          collection(ctx.firestore(), "assessmentReports"),
          where("assignmentId", "==", ASSIGNMENT_ID)
        )
      )
    );
  });

  it("Unrelated signed-in user cannot read the report", async () => {
    await seedAssignmentAndReport();
    await seedUser(env, {
      uid: "random-user",
      userType: "individual",
      tenantId: TENANT_A,
    });

    const ctx = authedContext(env, "random-user");
    await assertFails(getDoc(doc(ctx.firestore(), "assessmentReports", REPORT_ID)));
  });
});