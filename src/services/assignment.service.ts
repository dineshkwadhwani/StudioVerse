import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import type { WithFieldValue } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { AssignmentRecord, UserSearchResult, ActivityType } from "@/types/assignment";
import type { AssignmentStatus } from "@/types/assignment";
import { createWalletForUser, getTenantRegistrationFreeCoins, getWalletForUserContext } from "@/services/wallet.service";
import { getCohortAssignmentPayload } from "@/services/cohorts.service";
import type { CohortCreatorRole } from "@/types/cohort";

type AssignmentWriteData = WithFieldValue<Omit<AssignmentRecord, "id">>;

/**
 * Search for users by phone or email
 * @param searchTerm phone or email to search for
 * @param tenantId tenant context
 * @returns matching user profiles
 */
export async function searchUsersByPhoneOrEmail(
  searchTerm: string,
  tenantId: string
): Promise<UserSearchResult[]> {
  if (!searchTerm.trim()) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const normalizedPhone = normalizePhone(searchTerm);
  const phoneCandidates = new Set(buildPhoneSearchCandidates(searchTerm));
  if (normalizedPhone) {
    phoneCandidates.add(normalizedPhone);
  }

  try {
    const tenantUsersQuery = query(
      collection(db, "users"),
      where("tenantId", "==", tenantId)
    );

    const tenantUsersSnap = await getDocs(tenantUsersQuery);
    const resultsMap = new Map<string, UserSearchResult>();

    tenantUsersSnap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const profile = mapUserToSearchResult(doc.id, data);
      if (!profile) {
        return;
      }

      const profileEmail = normalizeEmail(profile.email);
      const profilePhoneCandidates = new Set(buildPhoneSearchCandidates(profile.phone));
      const profileNormalizedPhone = normalizePhone(profile.phone);
      if (profileNormalizedPhone) {
        profilePhoneCandidates.add(profileNormalizedPhone);
      }

      const emailMatches = Boolean(profileEmail) && profileEmail === normalizedSearch;
      const phoneMatches = Array.from(profilePhoneCandidates).some((candidate) => phoneCandidates.has(candidate));

      if (emailMatches || phoneMatches) {
        resultsMap.set(profile.id, profile);
      }
    });

    return Array.from(resultsMap.values());
  } catch (error) {
    console.error("[searchUsersByPhoneOrEmail] error:", error);
    return [];
  }
}

/**
 * Map user document to search result
 */
function mapUserToSearchResult(
  id: string,
  data: Record<string, unknown>
): UserSearchResult | null {
  const fullName = String(data.fullName ?? data.name ?? "");
  const phone = String(data.phoneE164 ?? data.phone ?? "");
  const email = String(data.email ?? "");

  if (!phone && !email) {
    return null;
  }

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") ?? "";

  return {
    id,
    userId: String(data.uid ?? data.userId ?? id),
    fullName,
    firstName,
    lastName,
    phone,
    email,
    userType: String(data.userType ?? "individual"),
    tenantId: String(data.tenantId ?? ""),
  };
}

function isSyntheticNotFoundAssigneeId(assigneeId: string): boolean {
  return assigneeId.startsWith("notfound-");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (raw.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function buildPhoneSearchCandidates(value: string): string[] {
  const raw = value.trim();
  if (!raw || raw.includes("@")) {
    return [];
  }

  const digits = raw.replace(/\D/g, "");
  const candidates = new Set<string>();

  candidates.add(raw);

  if (digits) {
    candidates.add(digits);
  }

  const normalized = normalizePhone(raw);
  if (normalized) {
    candidates.add(normalized);
  }

  if (digits.length === 10) {
    candidates.add(`0${digits}`);
    candidates.add(`91${digits}`);
  }

  return Array.from(candidates).filter(Boolean);
}

async function provisionAssigneeIfNeeded(args: {
  tenantId: string;
  assigneeId: string;
  assigneePhone: string;
  assigneeEmail: string;
  assigneeFullName: string;
  assignerId: string;
}): Promise<{ assigneeId: string; assigneePhone: string; assigneeEmail: string; assigneeFullName: string }> {
  const assigneePhone = normalizePhone(args.assigneePhone);
  const assigneeEmail = normalizeEmail(args.assigneeEmail);
  const assigneeFullName = args.assigneeFullName.trim();

  if (!isSyntheticNotFoundAssigneeId(args.assigneeId)) {
    return {
      assigneeId: args.assigneeId,
      assigneePhone,
      assigneeEmail,
      assigneeFullName,
    };
  }

  const userRef = doc(collection(db, "users"));
  const newAssigneeId = userRef.id;

  await setDoc(
    userRef,
    {
      userId: newAssigneeId,
      tenantId: args.tenantId,
      userType: "individual",
      profileType: "individual",
      fullName: assigneeFullName,
      name: assigneeFullName,
      email: assigneeEmail,
      phone: assigneePhone,
      phoneE164: assigneePhone,
      status: "active",
      assignmentEligible: true,
      mandatoryProfileCompleted: true,
      profileCompletionPercent: 100,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const registrationCoins = await getTenantRegistrationFreeCoins(args.tenantId);
  await createWalletForUser({
    userId: newAssigneeId,
    tenantId: args.tenantId,
    userType: "individual",
    userName: assigneeFullName,
    createdBy: args.assignerId,
    initialCoins: registrationCoins,
    reason: "Registration bonus",
  });

  return {
    assigneeId: newAssigneeId,
    assigneePhone,
    assigneeEmail,
    assigneeFullName,
  };
}

/**
 * Create an assignment with wallet validation
 * Validates that assignor has enough coins, deducts from assignor wallet, creates transaction
 */
export async function createAssignment(args: {
  tenantId: string;
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  creditsRequired: number;
  cost?: number;
  assigneeId: string;
  assigneePhone: string;
  assigneeEmail: string;
  assigneeFirstName: string;
  assigneeLastName: string;
  assigneeFullName: string;
  assignerId: string;
  assignerName: string;
  assignerLookupIds?: string[];
  status?: AssignmentStatus;
}): Promise<{ success: boolean; message: string; assignmentId?: string }> {
  try {
    const provisionedAssignee = await provisionAssigneeIfNeeded({
      tenantId: args.tenantId,
      assigneeId: args.assigneeId,
      assigneePhone: args.assigneePhone,
      assigneeEmail: args.assigneeEmail,
      assigneeFullName: args.assigneeFullName,
      assignerId: args.assignerId,
    });

    const effectiveAssigneeId = provisionedAssignee.assigneeId;
    const effectiveAssigneePhone = provisionedAssignee.assigneePhone;
    const effectiveAssigneeEmail = provisionedAssignee.assigneeEmail;
    const effectiveAssigneeFullName = provisionedAssignee.assigneeFullName;

    if (args.creditsRequired <= 0) {
      const assignmentRef = doc(collection(db, "assignments"));
      const assignmentData: AssignmentWriteData = {
        tenantId: args.tenantId,
        activityType: args.activityType,
        activityId: args.activityId,
        activityTitle: args.activityTitle,
        creditsRequired: args.creditsRequired,
        ...(args.cost !== undefined && { cost: args.cost }),
        assignerId: args.assignerId,
        assignerName: args.assignerName,
        assigneeId: effectiveAssigneeId,
        assigneePhone: effectiveAssigneePhone,
        assigneeEmail: effectiveAssigneeEmail,
        assigneeFirstName: args.assigneeFirstName,
        assigneeLastName: args.assigneeLastName,
        assigneeFullName: effectiveAssigneeFullName,
        status: args.status ?? "assigned",
        coinsDeducted: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(assignmentRef, assignmentData);

      return {
        success: true,
        message: "Assignment created successfully. 0 coins deducted from wallet.",
        assignmentId: assignmentRef.id,
      };
    }

    // Get assignor wallet. The assignor spends coins when assigning to another user.
    const wallet = await getWalletForUserContext(
      [
        ...(args.assignerLookupIds ?? []),
        args.assignerId,
      ],
      args.tenantId,
    );
    
    if (!wallet) {
      return {
        success: false,
        message: "Assignor wallet not found. Please ensure your wallet has been set up.",
      };
    }

    // Check if enough coins are available
    if (wallet.availableCoins < args.creditsRequired) {
      return {
        success: false,
        message: `Not enough coins. Required: ${args.creditsRequired}, Available: ${wallet.availableCoins}. Please get more coins.`,
      };
    }

    // Create assignment and update wallet in a transaction
    const result = await runTransaction(db, async (transaction) => {
      // Create assignment document
      const assignmentRef = doc(collection(db, "assignments"));
      const assignmentData: AssignmentWriteData = {
        tenantId: args.tenantId,
        activityType: args.activityType,
        activityId: args.activityId,
        activityTitle: args.activityTitle,
        creditsRequired: args.creditsRequired,
        ...(args.cost !== undefined && { cost: args.cost }),
        assignerId: args.assignerId,
        assignerName: args.assignerName,
        assigneeId: effectiveAssigneeId,
        assigneePhone: effectiveAssigneePhone,
        assigneeEmail: effectiveAssigneeEmail,
        assigneeFirstName: args.assigneeFirstName,
        assigneeLastName: args.assigneeLastName,
        assigneeFullName: effectiveAssigneeFullName,
        status: args.status ?? "assigned",
        coinsDeducted: args.creditsRequired,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      transaction.set(assignmentRef, assignmentData);

      // Update wallet - deduct coins and mark as utilized
      const walletRef = doc(db, "wallets", wallet.id);
      const newAvailableCoins = wallet.availableCoins - args.creditsRequired;
      const newUtilizedCoins = wallet.utilizedCoins + args.creditsRequired;

      transaction.update(walletRef, {
        availableCoins: newAvailableCoins,
        utilizedCoins: newUtilizedCoins,
        updatedBy: args.assignerId,
        updatedAt: serverTimestamp(),
      });

      // Create wallet transaction record
      const transactionRef = doc(collection(db, "walletTransactions"));
      const transactionData = {
        walletId: wallet.id,
        userId: wallet.userId,
        tenantId: args.tenantId,
        userType: wallet.userType,
        userName: wallet.userName || args.assignerName,
        transactionType: "debit",
        source: "assignment",
        reason: `Assignment: ${args.activityTitle}`,
        coins: args.creditsRequired,
        assignmentId: assignmentRef.id,
        activityType: args.activityType,
        activityId: args.activityId,
        createdBy: args.assignerId,
        createdAt: serverTimestamp(),
      };

      transaction.set(transactionRef, transactionData);

      return assignmentRef.id;
    });

    return {
      success: true,
      message: `Assignment created successfully. ${args.creditsRequired} coins deducted from wallet.`,
      assignmentId: result,
    };
  } catch (error) {
    console.error("[createAssignment] error:", error);
    return {
      success: false,
      message: "Error creating assignment. Please try again.",
    };
  }
}

export async function createCohortAssignment(args: {
  tenantId: string;
  cohortId: string;
  assignerRole: CohortCreatorRole;
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  creditsRequired: number;
  cost?: number;
  assignerId: string;
  assignerName: string;
  assignerLookupIds?: string[];
  status?: AssignmentStatus;
}): Promise<{ success: boolean; message: string; assignmentCount?: number; cohortAssignmentId?: string }> {
  try {
    const payload = await getCohortAssignmentPayload({
      tenantId: args.tenantId,
      cohortId: args.cohortId,
      role: args.assignerRole,
      actorUserId: args.assignerId,
    });

    if (payload.members.length < 2) {
      return {
        success: false,
        message: "A cohort must include at least two Individuals.",
      };
    }

    const perMemberCost = Math.max(0, args.creditsRequired);
    const totalCost = perMemberCost * payload.members.length;

    const wallet = await getWalletForUserContext(
      [
        ...(args.assignerLookupIds ?? []),
        args.assignerId,
      ],
      args.tenantId,
    );

    if (!wallet) {
      return {
        success: false,
        message: "Assignor wallet not found. Please ensure your wallet has been set up.",
      };
    }

    if (wallet.availableCoins < totalCost) {
      return {
        success: false,
        message: `Not enough coins. Required: ${totalCost}, Available: ${wallet.availableCoins}.`,
      };
    }

    const result = await runTransaction(db, async (transaction) => {
      const cohortAssignmentRef = doc(collection(db, "cohortAssignments"));

      transaction.set(cohortAssignmentRef, {
        tenantId: args.tenantId,
        cohortId: payload.cohortId,
        cohortName: payload.cohortName,
        activityType: args.activityType,
        activityId: args.activityId,
        activityTitle: args.activityTitle,
        perMemberCredits: perMemberCost,
        memberCount: payload.members.length,
        totalCoinsDeducted: totalCost,
        assignerId: args.assignerId,
        assignerName: args.assignerName,
        createdAt: serverTimestamp(),
      });

      payload.members.forEach((member) => {
        const assignmentRef = doc(collection(db, "assignments"));
        const assignmentData: AssignmentWriteData = {
          tenantId: args.tenantId,
          cohortId: payload.cohortId,
          cohortName: payload.cohortName,
          cohortAssignmentId: cohortAssignmentRef.id,
          activityType: args.activityType,
          activityId: args.activityId,
          activityTitle: args.activityTitle,
          creditsRequired: perMemberCost,
          ...(args.cost !== undefined && { cost: args.cost }),
          assignerId: args.assignerId,
          assignerName: args.assignerName,
          assigneeId: member.id,
          assigneePhone: member.phoneE164,
          assigneeEmail: member.email,
          assigneeFirstName: member.firstName,
          assigneeLastName: member.lastName,
          assigneeFullName: member.fullName,
          status: args.status ?? "assigned",
          coinsDeducted: perMemberCost,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        transaction.set(assignmentRef, assignmentData);
      });

      if (totalCost > 0) {
        const walletRef = doc(db, "wallets", wallet.id);
        transaction.update(walletRef, {
          availableCoins: wallet.availableCoins - totalCost,
          utilizedCoins: wallet.utilizedCoins + totalCost,
          updatedBy: args.assignerId,
          updatedAt: serverTimestamp(),
        });

        const walletTransactionRef = doc(collection(db, "walletTransactions"));
        transaction.set(walletTransactionRef, {
          walletId: wallet.id,
          userId: wallet.userId,
          tenantId: args.tenantId,
          userType: wallet.userType,
          userName: wallet.userName || args.assignerName,
          transactionType: "debit",
          source: "assignment",
          reason: `Cohort Assignment: ${payload.cohortName} - ${args.activityTitle}`,
          coins: totalCost,
          cohortId: payload.cohortId,
          cohortAssignmentId: cohortAssignmentRef.id,
          activityType: args.activityType,
          activityId: args.activityId,
          createdBy: args.assignerId,
          createdAt: serverTimestamp(),
        });
      }

      return cohortAssignmentRef.id;
    });

    return {
      success: true,
      message: `Assigned to ${payload.members.length} cohort members. ${totalCost} coins deducted from wallet.`,
      assignmentCount: payload.members.length,
      cohortAssignmentId: result,
    };
  } catch (error) {
    console.error("[createCohortAssignment] error:", error);
    return {
      success: false,
      message: "Error assigning activity to cohort. Please try again.",
    };
  }
}

export async function createRecommendation(args: {
  tenantId: string;
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  creditsRequired: number;
  cost?: number;
  assigneeId: string;
  assigneePhone: string;
  assigneeEmail: string;
  assigneeFirstName: string;
  assigneeLastName: string;
  assigneeFullName: string;
  assignerId: string;
  assignerName: string;
}): Promise<{ success: boolean; message: string; assignmentId?: string }> {
  try {
    const provisionedAssignee = await provisionAssigneeIfNeeded({
      tenantId: args.tenantId,
      assigneeId: args.assigneeId,
      assigneePhone: args.assigneePhone,
      assigneeEmail: args.assigneeEmail,
      assigneeFullName: args.assigneeFullName,
      assignerId: args.assignerId,
    });

    const recommendationRef = doc(collection(db, "assignments"));
    const recommendationData: AssignmentWriteData = {
      tenantId: args.tenantId,
      activityType: args.activityType,
      activityId: args.activityId,
      activityTitle: args.activityTitle,
      creditsRequired: args.creditsRequired,
      ...(args.cost !== undefined && { cost: args.cost }),
      assignerId: args.assignerId,
      assignerName: args.assignerName,
      assigneeId: provisionedAssignee.assigneeId,
      assigneePhone: provisionedAssignee.assigneePhone,
      assigneeEmail: provisionedAssignee.assigneeEmail,
      assigneeFirstName: args.assigneeFirstName,
      assigneeLastName: args.assigneeLastName,
      assigneeFullName: provisionedAssignee.assigneeFullName,
      status: "recommended",
      coinsDeducted: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(recommendationRef, recommendationData);

    return {
      success: true,
      message: "Recommendation sent successfully!",
      assignmentId: recommendationRef.id,
    };
  } catch (error) {
    console.error("[createRecommendation] error:", error);
    return {
      success: false,
      message: "Error creating recommendation. Please try again.",
    };
  }
}

export async function updateAssignmentStatus(args: {
  assignmentId: string;
  status: AssignmentStatus;
}): Promise<void> {
  await updateDoc(doc(db, "assignments", args.assignmentId), {
    status: args.status,
    updatedAt: serverTimestamp(),
  });
}

export async function getAssignmentById(assignmentId: string): Promise<AssignmentRecord | null> {
  try {
    const snap = await getDoc(doc(db, "assignments", assignmentId));
    if (!snap.exists()) {
      return null;
    }

    return {
      id: snap.id,
      ...(snap.data() as Omit<AssignmentRecord, "id">),
    };
  } catch (error) {
    console.error("[getAssignmentById] error:", error);
    return null;
  }
}

/**
 * Get assignments for a user
 */
export async function getAssignmentsByAssignee(
  assigneeId: string,
  tenantId: string
): Promise<AssignmentRecord[]> {
  try {
    const q = query(
      collection(db, "assignments"),
      where("assigneeId", "==", assigneeId),
      where("tenantId", "==", tenantId),
      where("status", "==", "assigned")
    );

    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as AssignmentRecord));
  } catch (error) {
    console.error("[getAssignmentsByAssignee] error:", error);
    return [];
  }
}

function mapAssignmentDocsToRecords(docs: Array<{ id: string; data: () => unknown }>): AssignmentRecord[] {
  return docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<AssignmentRecord, "id">),
  }));
}

function toSortableTimestamp(value: AssignmentRecord["createdAt"]): number {
  if (!value || !("toMillis" in value) || typeof value.toMillis !== "function") {
    return 0;
  }

  return value.toMillis();
}

export async function getAssignmentsForAssigneeContext(args: {
  tenantId: string;
  assigneeIds: string[];
  assigneePhone?: string;
  assigneeEmail?: string;
}): Promise<AssignmentRecord[]> {
  const normalizedIds = Array.from(new Set(args.assigneeIds.map((id) => id.trim()).filter(Boolean)));
  const normalizedPhone = args.assigneePhone?.trim() ?? "";
  const normalizedEmail = args.assigneeEmail?.trim().toLowerCase() ?? "";

  try {
    const queries = [
      ...normalizedIds.map((assigneeId) =>
        getDocs(query(collection(db, "assignments"), where("assigneeId", "==", assigneeId)))
      ),
      ...(normalizedPhone
        ? [getDocs(query(collection(db, "assignments"), where("assigneePhone", "==", normalizedPhone)))]
        : []),
      ...(normalizedEmail
        ? [getDocs(query(collection(db, "assignments"), where("assigneeEmail", "==", normalizedEmail)))]
        : []),
    ];

    const snapshots = await Promise.all(queries);
    const allMatched = snapshots
      .flatMap((snapshot) => mapAssignmentDocsToRecords(snapshot.docs))
      .reduce<AssignmentRecord[]>((acc, item) => {
        if (!acc.some((existing) => existing.id === item.id)) {
          acc.push(item);
        }
        return acc;
      }, []);

    const tenantMatched = allMatched.filter((item) => item.tenantId === args.tenantId);
    const recordsToReturn = tenantMatched.length > 0 ? tenantMatched : allMatched;

    return recordsToReturn.sort((a, b) => toSortableTimestamp(b.createdAt) - toSortableTimestamp(a.createdAt));
  } catch (error) {
    console.error("[getAssignmentsForAssigneeContext] error:", error);
    return [];
  }
}

export async function getAssignmentsForAssignerContext(args: {
  tenantId: string;
  assignerIds: string[];
}): Promise<AssignmentRecord[]> {
  const normalizedIds = Array.from(new Set(args.assignerIds.map((id) => id.trim()).filter(Boolean)));

  if (normalizedIds.length === 0) {
    return [];
  }

  try {
    const snapshots = await Promise.all(
      normalizedIds.map((assignerId) =>
        getDocs(query(collection(db, "assignments"), where("assignerId", "==", assignerId)))
      )
    );

    const allMatched = snapshots
      .flatMap((snapshot) => mapAssignmentDocsToRecords(snapshot.docs))
      .reduce<AssignmentRecord[]>((acc, item) => {
        if (!acc.some((existing) => existing.id === item.id)) {
          acc.push(item);
        }
        return acc;
      }, []);

    const tenantMatched = allMatched.filter((item) => item.tenantId === args.tenantId);
    const recordsToReturn = tenantMatched.length > 0 ? tenantMatched : allMatched;

    return recordsToReturn.sort((a, b) => toSortableTimestamp(b.createdAt) - toSortableTimestamp(a.createdAt));
  } catch (error) {
    console.error("[getAssignmentsForAssignerContext] error:", error);
    return [];
  }
}
