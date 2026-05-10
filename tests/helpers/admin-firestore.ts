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
