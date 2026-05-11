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
 * Create a minimal "draft" Program doc for tests that need a program to edit.
 * Fields chosen to satisfy the Edit form's expected shape without triggering
 * publish-time validation (`published: false`).
 */
export async function bootstrapDraftProgram(args: {
  name: string;
  tenantId: string;
}): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("programs").doc();
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
    creditsRequired: 50,
    availableFrom: "",
    expiresAt: "",
    facilitatorName: "E2E Facilitator",
    deliveryType: "course",
    durationValue: 4,
    durationUnit: "weeks",
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
