/**
 * Firebase Admin SDK helper for E2E tests.
 *
 * Used to set up and tear down test fixtures in `studioverse-test` Firestore
 * — operations that bypass security rules and would be impossible from the
 * Playwright browser context. Backed by FIREBASE_ADMIN_* env vars in
 * `.env.local`.
 */

import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import {
  initializeApp,
  cert,
  getApps,
  type App,
} from "firebase-admin/app";
import {
  getFirestore,
  Firestore,
  FieldValue,
  type Query,
} from "firebase-admin/firestore";

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

function ensureEnvLoaded(): void {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
    return;
  }
  loadDotenv({ path: resolve(process.cwd(), ".env.local") });
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  ensureEnvLoaded();

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_ADMIN_* env vars. Tests rely on credentials in .env.local. " +
        "Either run from project root or ensure dotenv can find .env.local."
    );
  }

  const existing = getApps().find((a) => a.name === "tests-admin");
  cachedApp =
    existing ??
    initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      },
      "tests-admin"
    );

  cachedDb = getFirestore(cachedApp);
  return cachedDb;
}

/**
 * Normalises a 10-digit Indian number to E.164 (+91…). Mirrors the
 * normalizePhone() used by saveUser() and AuthWizard so we can match
 * regardless of which flow originally wrote the doc.
 */
export function toE164India(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10 && digits.startsWith("91")) return `+${digits}`;
  if (input.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Find user docs whose phoneE164 matches the given phone (in any common
 * format). Returns at most a handful of matches.
 */
export async function findUsersByPhone(phone: string): Promise<
  Array<{ id: string; data: FirebaseFirestore.DocumentData }>
> {
  const db = getAdminDb();
  const e164 = toE164India(phone);
  const snap = await db.collection("users").where("phoneE164", "==", e164).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * Idempotent test cleanup: deletes any user docs with the given phone, plus
 * their associated wallet and walletTransaction docs. Returns a summary of
 * what was deleted.
 */
export async function deleteUserAndWalletByPhone(phone: string): Promise<{
  usersDeleted: number;
  walletsDeleted: number;
  txnsDeleted: number;
}> {
  const db = getAdminDb();
  const matches = await findUsersByPhone(phone);

  let usersDeleted = 0;
  let walletsDeleted = 0;
  let txnsDeleted = 0;

  for (const match of matches) {
    const userId = match.id;

    // Delete walletTransactions for this user.
    const txnsSnap = await db
      .collection("walletTransactions")
      .where("userId", "==", userId)
      .get();
    for (const t of txnsSnap.docs) {
      await t.ref.delete();
      txnsDeleted++;
    }

    // Delete wallets where userId matches (covers scoped + legacy walletIds).
    const walletsSnap = await db
      .collection("wallets")
      .where("userId", "==", userId)
      .get();
    for (const w of walletsSnap.docs) {
      await w.ref.delete();
      walletsDeleted++;
    }

    await match.data && (await db.collection("users").doc(userId).delete());
    usersDeleted++;
  }

  return { usersDeleted, walletsDeleted, txnsDeleted };
}

/**
 * Get the single user record for a phone, or null. Throws if multiple match
 * (shouldn't happen — uniqueness is enforced at the UI layer).
 */
export async function getUserByPhone(
  phone: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const matches = await findUsersByPhone(phone);
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(
      `Expected at most one user for ${phone}, found ${matches.length}. Possible test data pollution.`
    );
  }
  return matches[0]!;
}

/**
 * Idempotent cleanup of any document in a given collection that matches
 * `fieldName == value`. Returns the count deleted.
 */
export async function deleteDocsWhere(
  collection: string,
  fieldName: string,
  value: string | number | boolean
): Promise<number> {
  const db = getAdminDb();
  const snap = await db.collection(collection).where(fieldName, "==", value).get();
  for (const doc of snap.docs) {
    await doc.ref.delete();
  }
  return snap.docs.length;
}

/**
 * Create a Program doc for tests. Default mode is draft (not visible on the
 * Assign Activities page). Pass `publish: true` + a `listingPackageId` to
 * write a published-public program that satisfies the page's
 * `isPublishedPublic` filter.
 */
export async function bootstrapDraftProgram(args: {
  name: string;
  tenantId: string;
  publish?: boolean;
  listingPackageId?: string;
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("programs").doc();
  const isPublished = !!args.publish;
  await ref.set({
    name: args.name,
    tenantId: args.tenantId,
    tenantIds: [args.tenantId],
    shortDescription: `Short description for ${args.name}.`,
    longDescription: `Long description for ${args.name}.`,
    details: `Detailed agenda for ${args.name}.`,
    thumbnailUrl: isPublished
      ? "https://placehold.co/400x300.png"
      : "",
    thumbnailPath: "",
    videoUrl: "",
    creditsRequired: 50,
    availableFrom: "",
    expiresAt: "",
    facilitatorName: "E2E Facilitator",
    deliveryType: "course",
    durationValue: 4,
    durationUnit: "weeks",
    visibility: "public",
    catalogVisibility: "tenant_wide",
    status: isPublished ? "published" : "draft",
    publicationState: isPublished ? "published" : "draft",
    ownershipScope: "platform",
    ownerEntityId: "platform",
    promoted: false,
    promotionStatus: "none",
    promotionPackageId: null,
    listingPackageId: args.listingPackageId ?? null,
    listingStatus: args.listingPackageId ? "approved" : "none",
    published: isPublished,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Create a minimal "draft" Event doc for tests that need an event to edit.
 */
export async function bootstrapDraftEvent(args: {
  name: string;
  tenantId: string;
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("events").doc();
  await ref.set({
    name: args.name,
    tenantId: args.tenantId,
    tenantIds: [args.tenantId],
    shortDescription: `Short description for ${args.name}.`,
    longDescription: `Long description for ${args.name}.`,
    details: `Detailed agenda for ${args.name}.`,
    thumbnailUrl: "",
    thumbnailPath: "",
    videoUrl: "",
    creditsRequired: 30,
    cost: 0,
    eventType: "workshop",
    eventSource: "studioverse_manager",
    eventDate: "2026-12-01",
    eventTime: "10:30",
    locationAddress: "Test Address",
    locationCity: "Pune",
    visibility: "public",
    catalogVisibility: "tenant_wide",
    status: "draft",
    publicationState: "draft",
    ownershipScope: "platform",
    ownerEntityId: "platform",
    promoted: false,
    promotionStatus: "none",
    promotionPackageId: null,
    listingPackageId: null,
    listingStatus: "none",
    published: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Create an active Listing Package for tests that need to attach one to a
 * resource. Resource type defaults to "program".
 */
export async function bootstrapListingPackage(args: {
  name: string;
  tenantId: string;
  resourceType?: "program" | "event" | "assessment";
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("listingPackages").doc();
  await ref.set({
    name: args.name,
    tenantId: args.tenantId,
    description: `E2E listing package: ${args.name}`,
    imageUrl: "",
    imagePath: "",
    resourceType: args.resourceType ?? "program",
    durationValue: 30,
    durationUnit: "days",
    costCredits: 50,
    sortOrder: 1,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Create an active Promotion Package for tests that need to attach one.
 */
export async function bootstrapPromotionPackage(args: {
  name: string;
  tenantId: string;
  resourceType?: "program" | "event" | "assessment";
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("promotionPackages").doc();
  await ref.set({
    name: args.name,
    tenantId: args.tenantId,
    description: `E2E promotion package: ${args.name}`,
    imageUrl: "",
    imagePath: "",
    resourceType: args.resourceType ?? "event",
    durationValue: 14,
    durationUnit: "days",
    costCredits: 75,
    sortOrder: 1,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Bootstrap a pending coin request from a Professional to a Company.
 */
export async function bootstrapCoinRequest(args: {
  tenantId: string;
  professionalId: string;
  professionalName: string;
  companyId: string;
  amount: number;
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("coinRequests").doc();
  await ref.set({
    tenantId: args.tenantId,
    requesterProfessionalId: args.professionalId,
    requesterName: args.professionalName,
    companyId: args.companyId,
    amount: args.amount,
    message: "E2E test request",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Bootstrap a pending cashout request.
 */
export async function bootstrapCashoutRequest(args: {
  tenantId: string;
  requesterUserId: string;
  requesterName: string;
  amount: number;
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("cashoutRequests").doc();
  await ref.set({
    tenantId: args.tenantId,
    requesterUserId: args.requesterUserId,
    requesterName: args.requesterName,
    amount: args.amount,
    coins: args.amount,
    paymentMethod: "test-mode",
    payoutDetails: "test-mode",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Bootstrap a pending bot hero request.
 */
export async function bootstrapBotHeroRequest(args: {
  tenantId: string;
  professionalId: string;
  professionalName: string;
  packageId: string;
  packageName: string;
  durationValue: number;
  durationUnit: "days" | "weeks";
  credits: number;
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("botHeroRequests").doc();
  await ref.set({
    tenantId: args.tenantId,
    professionalId: args.professionalId,
    professionalName: args.professionalName,
    packageId: args.packageId,
    packageName: args.packageName,
    durationValue: args.durationValue,
    durationUnit: args.durationUnit,
    credits: args.credits,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Set a program's promotion-request fields so it's pending SA approval.
 *
 * `requesterId` is required: `approveProgramPromotionRequest` resolves the
 * requester via `promotionRequestedBy` (then falls back to `updatedBy`,
 * `createdBy`) to find the wallet to charge. Without it the approval
 * silently throws "Could not determine requester wallet for this promotion."
 */
export async function setProgramPromotionRequested(args: {
  programId: string;
  promotionPackageId: string;
  requesterId: string;
}): Promise<void> {
  const db = getAdminDb();
  await db.collection("programs").doc(args.programId).update({
    promoted: true,
    promotionStatus: "requested",
    promotionPackageId: args.promotionPackageId,
    promotionRequestedBy: args.requesterId,
    updatedBy: args.requesterId,
    createdBy: args.requesterId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Create a minimal Assignment doc for tests that need a pre-existing
 * assignment in someone's My Activities list.
 */
export async function bootstrapAssignment(args: {
  tenantId: string;
  activityType: "program" | "event" | "assessment";
  activityId: string;
  activityTitle: string;
  assigneeId: string;
  assigneeFullName: string;
  assignerId: string;
  assignerName: string;
  status?: "assigned" | "registered" | "in_progress" | "completed";
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("assignments").doc();
  await ref.set({
    tenantId: args.tenantId,
    activityType: args.activityType,
    activityId: args.activityId,
    activityTitle: args.activityTitle,
    creditsRequired: 0,
    assignerId: args.assignerId,
    assignerName: args.assignerName,
    assigneeId: args.assigneeId,
    assigneePhone: "",
    assigneeEmail: "",
    assigneeFirstName: "",
    assigneeLastName: "",
    assigneeFullName: args.assigneeFullName,
    status: args.status ?? "assigned",
    coinsDeducted: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Top up (or set) a user's wallet to ensure they have at least `minCoins`
 * available. Adds the difference to both `availableCoins` and
 * `totalIssuedCoins`. No-op if the wallet already has enough.
 */
export async function ensureWalletAtLeast(args: {
  userId: string;
  tenantId: string;
  userType: "company" | "professional" | "individual";
  userName: string;
  minCoins: number;
}): Promise<void> {
  const db = getAdminDb();
  const walletId = `${args.tenantId}::${args.userId}`;
  const ref = db.collection("wallets").doc(walletId);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data()!;
    const current = Number(data.availableCoins ?? 0);
    if (current >= args.minCoins) return;
    const delta = args.minCoins - current;
    await ref.update({
      availableCoins: current + delta,
      totalIssuedCoins: Number(data.totalIssuedCoins ?? 0) + delta,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }
  await ref.set({
    userId: args.userId,
    tenantId: args.tenantId,
    userType: args.userType,
    userName: args.userName,
    totalIssuedCoins: args.minCoins,
    utilizedCoins: 0,
    availableCoins: args.minCoins,
    createdBy: args.userId,
    updatedBy: args.userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Set or clear the `associatedCompanyId` field on a user record. Used by
 * Company-actor tests to seed / revert membership state.
 */
export async function setUserAssociatedCompany(args: {
  userId: string;
  associatedCompanyId: string | null;
}): Promise<void> {
  const db = getAdminDb();
  await db.collection("users").doc(args.userId).update({
    associatedCompanyId: args.associatedCompanyId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Read the wallet doc + its transaction history for a given userId.
 * Used by tests to assert state after a UI-driven action.
 */
export async function getWalletStateForUser(userId: string): Promise<{
  wallet: FirebaseFirestore.DocumentData | null;
  transactions: FirebaseFirestore.DocumentData[];
}> {
  const db = getAdminDb();
  const walletSnap = await db.collection("wallets").where("userId", "==", userId).get();
  const wallet = walletSnap.docs[0]?.data() ?? null;

  const txnsSnap: Query = db.collection("walletTransactions").where("userId", "==", userId);
  const txns = await txnsSnap.get();
  return {
    wallet,
    transactions: txns.docs.map((d) => d.data()),
  };
}
