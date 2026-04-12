import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { WithFieldValue } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { AssignmentRecord, UserSearchResult, ActivityType } from "@/types/assignment";
import type { UserProfileRecord } from "@/types/profile";
import { getWalletByUserId, getWalletForUserContext } from "@/services/wallet.service";

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
  
  try {
    // Search in users collection by phone or email
    const phoneQuery = query(
      collection(db, "users"),
      where("tenantId", "==", tenantId),
      where("phoneE164", "==", normalizedSearch)
    );

    const emailQuery = query(
      collection(db, "users"),
      where("tenantId", "==", tenantId),
      where("email", "==", normalizedSearch)
    );

    const [phoneSnap, emailSnap] = await Promise.all([
      getDocs(phoneQuery),
      getDocs(emailQuery),
    ]);

    const resultsMap = new Map<string, UserSearchResult>();

    // Add phone matches
    phoneSnap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const profile = mapUserToSearchResult(doc.id, data);
      if (profile) {
        resultsMap.set(profile.id, profile);
      }
    });

    // Add email matches (avoid duplicates)
    emailSnap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const profile = mapUserToSearchResult(doc.id, data);
      if (profile && !resultsMap.has(profile.id)) {
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
  return value.trim();
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

  await setDoc(
    doc(db, "wallets", newAssigneeId),
    {
      userId: newAssigneeId,
      tenantId: args.tenantId,
      userType: "individual",
      userName: assigneeFullName,
      totalIssuedCoins: 0,
      utilizedCoins: 0,
      availableCoins: 0,
      createdBy: args.assignerId,
      updatedBy: args.assignerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

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
        status: "assigned",
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
    const wallet = await getWalletForUserContext([
      ...(args.assignerLookupIds ?? []),
      args.assignerId,
    ]);
    
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
        status: "assigned",
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
