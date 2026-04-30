import {
  collection,
  doc,
  getDocs,
  increment,
  runTransaction,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import {
  BOT_HERO_DURATION_UNITS,
  type BotHeroDurationUnit,
  type BotHeroPackageFormValues,
  type BotHeroPackageRecord,
  type BotHeroRequestRecord,
  type BotHeroRequestStatus,
} from "@/types/botHero";

const PACKAGES_COLLECTION = "botHeroPackages";
const REQUESTS_COLLECTION = "botHeroRequests";

// ── Helpers ────────────────────────────────────────────────────────────────

function toStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNum(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : (Number(value) || fallback);
}

function toDurationUnit(raw: string): BotHeroDurationUnit {
  return BOT_HERO_DURATION_UNITS.includes(raw as BotHeroDurationUnit)
    ? (raw as BotHeroDurationUnit)
    : "weeks";
}

function mapPackage(id: string, data: Record<string, unknown>): BotHeroPackageRecord {
  return {
    id,
    name: toStr(data.name),
    description: toStr(data.description) || undefined,
    durationValue: toNum(data.durationValue),
    durationUnit: toDurationUnit(toStr(data.durationUnit)),
    credits: toNum(data.credits),
    active: data.active === true,
    sortOrder: toNum(data.sortOrder, 99),
    createdBy: toStr(data.createdBy),
    updatedBy: toStr(data.updatedBy),
    createdAt: data.createdAt as BotHeroPackageRecord["createdAt"],
    updatedAt: data.updatedAt as BotHeroPackageRecord["updatedAt"],
  };
}

function mapRequest(id: string, data: Record<string, unknown>): BotHeroRequestRecord {
  return {
    id,
    tenantId: toStr(data.tenantId),
    professionalId: toStr(data.professionalId),
    professionalName: toStr(data.professionalName),
    professionalAvatar: toStr(data.professionalAvatar),
    packageId: toStr(data.packageId),
    packageName: toStr(data.packageName),
    durationValue: toNum(data.durationValue),
    durationUnit: toDurationUnit(toStr(data.durationUnit)),
    credits: toNum(data.credits),
    walletTransactionId: toStr(data.walletTransactionId),
    status: (toStr(data.status) || "pending") as BotHeroRequestStatus,
    preferredStartDate: toStr(data.preferredStartDate) || undefined,
    approvedStartDate: toStr(data.approvedStartDate) || undefined,
    approvedEndDate: toStr(data.approvedEndDate) || undefined,
    approvedBy: toStr(data.approvedBy) || undefined,
    approvedAt: data.approvedAt as BotHeroRequestRecord["approvedAt"],
    deniedBy: toStr(data.deniedBy) || undefined,
    deniedAt: data.deniedAt as BotHeroRequestRecord["deniedAt"],
    denialReason: toStr(data.denialReason) || undefined,
    refundTransactionId: toStr(data.refundTransactionId) || undefined,
    requestedAt: data.requestedAt as BotHeroRequestRecord["requestedAt"],
    createdAt: data.createdAt as BotHeroRequestRecord["createdAt"],
    updatedAt: data.updatedAt as BotHeroRequestRecord["updatedAt"],
  };
}

// ── Package CRUD ────────────────────────────────────────────────────────────

export async function listBotHeroPackages(): Promise<BotHeroPackageRecord[]> {
  const snap = await getDocs(collection(db, PACKAGES_COLLECTION));
  return snap.docs
    .map((row) => mapPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listActiveBotHeroPackages(): Promise<BotHeroPackageRecord[]> {
  const snap = await getDocs(
    query(collection(db, PACKAGES_COLLECTION), where("active", "==", true))
  );
  return snap.docs
    .map((row) => mapPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveBotHeroPackage(
  values: BotHeroPackageFormValues,
  operatorId: string
): Promise<void> {
  const isUpdate = Boolean(values.id);
  const docId = values.id ?? doc(collection(db, PACKAGES_COLLECTION)).id;
  const docRef = doc(db, PACKAGES_COLLECTION, docId);

  const payload = {
    name: values.name.trim(),
    description: values.description.trim(),
    durationValue: Number(values.durationValue),
    durationUnit: values.durationUnit,
    credits: Number(values.credits),
    active: values.active,
    sortOrder: Number(values.sortOrder) || 99,
    updatedBy: operatorId,
    updatedAt: serverTimestamp(),
    ...(isUpdate ? {} : { createdBy: operatorId, createdAt: serverTimestamp() }),
  };

  if (isUpdate) {
    await updateDoc(docRef, payload);
  } else {
    await setDoc(docRef, payload);
  }
}

export function validateBotHeroPackageForm(
  values: BotHeroPackageFormValues
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.name.trim()) {
    errors.name = "Package name is required.";
  }

  const dur = Number(values.durationValue);
  if (!values.durationValue.trim() || !Number.isFinite(dur) || dur <= 0) {
    errors.durationValue = "Duration must be a positive number.";
  }

  const cred = Number(values.credits);
  if (!values.credits.trim() || !Number.isFinite(cred) || cred <= 0) {
    errors.credits = "Credits must be a positive number.";
  }

  return errors;
}

export function getBotHeroPackageSummary(pkg: BotHeroPackageRecord): string {
  return `${pkg.durationValue} ${pkg.durationUnit} • ${pkg.credits} credits`;
}

export function calcEndDate(startDateStr: string, durationValue: number, durationUnit: BotHeroDurationUnit): string {
  const start = new Date(startDateStr);
  const daysToAdd = durationUnit === "weeks" ? durationValue * 7 : durationValue;
  const end = new Date(start);
  end.setDate(end.getDate() + daysToAdd);
  return end.toISOString().split("T")[0];
}

// ── Request reads ───────────────────────────────────────────────────────────

export async function listPendingBotHeroRequests(): Promise<BotHeroRequestRecord[]> {
  const snap = await getDocs(
    query(collection(db, REQUESTS_COLLECTION), where("status", "==", "pending"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((row) => mapRequest(row.id, row.data() as Record<string, unknown>));
}

export async function listBotHeroRequestsForProfessional(professionalId: string): Promise<BotHeroRequestRecord[]> {
  const snap = await getDocs(
    query(collection(db, REQUESTS_COLLECTION), where("professionalId", "==", professionalId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((row) => mapRequest(row.id, row.data() as Record<string, unknown>));
}

export async function getActiveBotHero(tenantId: string): Promise<BotHeroRequestRecord | null> {
  const now = new Date().toISOString().split("T")[0];
  const snap = await getDocs(
    query(
      collection(db, REQUESTS_COLLECTION),
      where("tenantId", "==", tenantId),
      where("status", "==", "approved"),
      where("approvedStartDate", "<=", now)
    )
  );

  // Filter end date client-side (Firestore can only have one inequality per query)
  const active = snap.docs
    .map((row) => mapRequest(row.id, row.data() as Record<string, unknown>))
    .filter((r) => r.approvedEndDate && r.approvedEndDate >= now);

  return active[0] ?? null;
}

export async function checkBotHeroDatesOverlap(
  tenantId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
): Promise<boolean> {
  // Load all approved/active requests for this tenant
  const snap = await getDocs(
    query(
      collection(db, REQUESTS_COLLECTION),
      where("tenantId", "==", tenantId),
      where("status", "in", ["approved", "active"])
    )
  );

  return snap.docs.some((row) => {
    const data = mapRequest(row.id, row.data() as Record<string, unknown>);
    if (row.id === excludeRequestId) return false;
    if (!data.approvedStartDate || !data.approvedEndDate) return false;

    // Overlap: start < existingEnd AND end > existingStart
    return startDate < data.approvedEndDate && endDate > data.approvedStartDate;
  });
}

// ── Submit request (coach) — debit wallet immediately ──────────────────────

export async function submitBotHeroRequest(args: {
  tenantId: string;
  professionalId: string;
  professionalName: string;
  professionalAvatar: string;
  pkg: BotHeroPackageRecord;
  preferredStartDate?: string;
}): Promise<void> {
  const { tenantId, professionalId, professionalName, professionalAvatar, pkg, preferredStartDate } = args;

  if (!professionalAvatar.trim()) {
    throw new Error("A profile picture is required to submit a Bot Hero request.");
  }

  // Resolve wallet id pattern — scoped or legacy
  const walletId = `${tenantId}::${professionalId}`;
  const walletRef = doc(db, "wallets", walletId);
  const legacyWalletRef = doc(db, "wallets", professionalId);

  const requestRef = doc(collection(db, REQUESTS_COLLECTION));
  const txRef = doc(collection(db, "walletTransactions"));

  await runTransaction(db, async (tx) => {
    const [walletSnap, legacySnap] = await Promise.all([tx.get(walletRef), tx.get(legacyWalletRef)]);

    const targetWalletSnap = walletSnap.exists() ? walletSnap : (legacySnap.exists() ? legacySnap : null);
    if (!targetWalletSnap) throw new Error("Wallet not found for this professional.");

    const available = Number(targetWalletSnap.data()?.availableCoins ?? 0);
    if (available < pkg.credits) {
      throw new Error(`Insufficient credits. You need ${pkg.credits} but have ${available}.`);
    }

    const targetWalletRef = walletSnap.exists() ? walletRef : legacyWalletRef;
    const targetWalletId = walletSnap.exists() ? walletId : professionalId;

    // Debit wallet
    tx.update(targetWalletRef, {
      availableCoins: increment(-pkg.credits),
      utilizedCoins: increment(pkg.credits),
      updatedAt: serverTimestamp(),
    });

    // Write ledger entry
    tx.set(txRef, {
      walletId: targetWalletId,
      userId: professionalId,
      tenantId,
      type: "debit",
      amount: pkg.credits,
      source: "bot-hero",
      reason: `Bot Hero package: ${pkg.name}`,
      activityId: requestRef.id,
      createdBy: professionalId,
      createdAt: serverTimestamp(),
    });

    // Write request
    tx.set(requestRef, {
      tenantId,
      professionalId,
      professionalName,
      professionalAvatar,
      packageId: pkg.id,
      packageName: pkg.name,
      durationValue: pkg.durationValue,
      durationUnit: pkg.durationUnit,
      credits: pkg.credits,
      walletTransactionId: txRef.id,
      status: "pending",
      preferredStartDate: preferredStartDate ?? "",
      requestedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Approve (admin) ────────────────────────────────────────────────────────

export async function approveBotHeroRequest(args: {
  requestId: string;
  request: BotHeroRequestRecord;
  startDate: string;
  operatorId: string;
}): Promise<void> {
  const { requestId, request, startDate, operatorId } = args;

  const endDate = calcEndDate(startDate, request.durationValue, request.durationUnit);

  const hasOverlap = await checkBotHeroDatesOverlap(
    request.tenantId,
    startDate,
    endDate,
    requestId
  );
  if (hasOverlap) {
    throw new Error(
      `Dates conflict with an existing approved Bot Hero slot. Please select a start date after ${endDate}.`
    );
  }

  await updateDoc(doc(db, REQUESTS_COLLECTION, requestId), {
    status: "approved",
    approvedStartDate: startDate,
    approvedEndDate: endDate,
    approvedBy: operatorId,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ── Deny (admin) — refund wallet ───────────────────────────────────────────

export async function denyBotHeroRequest(args: {
  requestId: string;
  request: BotHeroRequestRecord;
  operatorId: string;
  reason?: string;
}): Promise<void> {
  const { requestId, request, operatorId, reason } = args;

  const walletId = `${request.tenantId}::${request.professionalId}`;
  const walletRef = doc(db, "wallets", walletId);
  const legacyWalletRef = doc(db, "wallets", request.professionalId);
  const refundTxRef = doc(collection(db, "walletTransactions"));

  await runTransaction(db, async (tx) => {
    const [walletSnap, legacySnap] = await Promise.all([tx.get(walletRef), tx.get(legacyWalletRef)]);
    const targetWalletSnap = walletSnap.exists() ? walletSnap : (legacySnap.exists() ? legacySnap : null);

    if (targetWalletSnap) {
      const targetWalletRef = walletSnap.exists() ? walletRef : legacyWalletRef;
      const targetWalletId = walletSnap.exists() ? walletId : request.professionalId;

      tx.update(targetWalletRef, {
        availableCoins: increment(request.credits),
        utilizedCoins: increment(-request.credits),
        updatedAt: serverTimestamp(),
      });

      tx.set(refundTxRef, {
        walletId: targetWalletId,
        userId: request.professionalId,
        tenantId: request.tenantId,
        type: "credit",
        amount: request.credits,
        source: "bot-hero",
        reason: `Refund: Bot Hero request denied — ${request.packageName}`,
        activityId: requestId,
        createdBy: operatorId,
        createdAt: serverTimestamp(),
      });
    }

    tx.update(doc(db, REQUESTS_COLLECTION, requestId), {
      status: "denied",
      deniedBy: operatorId,
      deniedAt: serverTimestamp(),
      denialReason: reason ?? "",
      refundTransactionId: refundTxRef.id,
      updatedAt: serverTimestamp(),
    });
  });
}
