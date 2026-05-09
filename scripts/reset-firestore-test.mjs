#!/usr/bin/env node
// Destructive Firestore reset for studioverse-test.
// Keeps: superadmin users, programs, assessments, assessmentQuestions, events.
// Resets: each treasury wallet to 100000 coins.
// Wipes everything else.
//
// Usage:
//   node scripts/reset-firestore-test.mjs --confirm
//
// Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
// FIREBASE_ADMIN_PRIVATE_KEY in env (from .env.local).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const CONFIRMED = process.argv.includes("--confirm");

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error("Missing FIREBASE_ADMIN_PROJECT_ID");
  process.exit(1);
}

if (projectId !== "studioverse-test") {
  console.error(`Refusing to run on project '${projectId}'. This script is hard-locked to 'studioverse-test'.`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  projectId,
});

const db = admin.firestore();

const KEEP_FULL = new Set([
  "programs",
  "assessments",
  "assessmentQuestions",
  "events",
  "tenants",
]);

const TREASURY_RESET_AMOUNT = 100000;

async function deleteCollection(name, filterFn = null) {
  const snap = await db.collection(name).get();
  if (snap.empty) {
    console.log(`  ${name}: empty`);
    return 0;
  }

  let kept = 0;
  let deleted = 0;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    if (filterFn && filterFn(doc)) {
      kept++;
      continue;
    }
    batch.delete(doc.ref);
    deleted++;
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  console.log(`  ${name}: deleted ${deleted}, kept ${kept}`);
  return deleted;
}

async function listAllCollections() {
  const cols = await db.listCollections();
  return cols.map((c) => c.id);
}

async function resetTreasuryWallets() {
  const snap = await db.collection("wallets").get();
  let kept = 0;
  let deleted = 0;
  let reset = 0;

  let batch = db.batch();
  let ops = 0;
  for (const doc of snap.docs) {
    const id = doc.id;
    if (id.startsWith("treasury::")) {
      batch.set(
        doc.ref,
        {
          totalIssuedCoins: TREASURY_RESET_AMOUNT,
          availableCoins: TREASURY_RESET_AMOUNT,
          utilizedCoins: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      reset++;
      ops++;
    } else {
      batch.delete(doc.ref);
      deleted++;
      ops++;
    }
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  console.log(`  wallets: deleted ${deleted}, treasury reset ${reset}, kept ${kept}`);
}

async function run() {
  console.log(`Project: ${projectId}`);
  console.log("");

  const allCollections = await listAllCollections();
  console.log("Top-level collections found:", allCollections.join(", "));
  console.log("");

  if (!CONFIRMED) {
    console.log("DRY RUN — pass --confirm to execute. No writes performed.");
    return;
  }

  console.log("Executing destructive reset...");
  console.log("");

  // 1. Users — keep superadmin only
  await deleteCollection("users", (doc) => {
    const data = doc.data() || {};
    const role = data.userType || data.profileType || data.role;
    return role === "superadmin";
  });

  // 2. Wallets — reset treasury, delete others
  await resetTreasuryWallets();

  // 3. Wipe everything else not in KEEP_FULL and not already handled
  const handled = new Set(["users", "wallets"]);
  for (const name of allCollections) {
    if (handled.has(name)) continue;
    if (KEEP_FULL.has(name)) {
      console.log(`  ${name}: kept (full)`);
      continue;
    }
    await deleteCollection(name);
  }

  console.log("");
  console.log("Reset complete.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
