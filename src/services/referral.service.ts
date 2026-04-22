import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { getTenantMailConfig, sendReferralInviteEmail, sendReferralReminderEmail } from "@/services/mail.service";
import type {
  ReferredType,
  ReferralRecord,
  ReferrerRole,
  ReferralStatus,
} from "@/types/referral";

const DEFAULT_REFERRAL_JOIN_REWARD = 5;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

function toReferralRecord(id: string, data: Record<string, unknown>): ReferralRecord {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    referrerUserId: String(data.referrerUserId ?? ""),
    referrerName: String(data.referrerName ?? ""),
    referrerRole: (data.referrerRole as ReferrerRole) ?? "individual",
    referrerCompanyId:
      typeof data.referrerCompanyId === "string"
        ? data.referrerCompanyId
        : data.referrerCompanyId === null
          ? null
          : undefined,
    referredType: (data.referredType as ReferredType) ?? "individual",
    referredEmail: String(data.referredEmail ?? ""),
    referredPhone: String(data.referredPhone ?? ""),
    status: (data.status as ReferralStatus) ?? "referred",
    createdAt: data.createdAt as ReferralRecord["createdAt"],
    updatedAt: data.updatedAt as ReferralRecord["updatedAt"],
    joinedAt: data.joinedAt as ReferralRecord["joinedAt"],
    joinedUserId: typeof data.joinedUserId === "string" ? data.joinedUserId : undefined,
    reminderSentAt: data.reminderSentAt as ReferralRecord["reminderSentAt"],
  };
}

async function getTenantReferralJoinReward(tenantId: string): Promise<number> {
  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  return Math.max(
    0,
    Math.floor(
      Number(tenantSnap.data()?.walletConfig?.referralFreeCoins ?? DEFAULT_REFERRAL_JOIN_REWARD)
    )
  );
}

async function getTenantRegistrationCoins(tenantId: string): Promise<number> {
  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  return Math.max(
    0,
    Math.floor(Number(tenantSnap.data()?.walletConfig?.registrationFreeCoins ?? 10))
  );
}

type CreditWalletArgs = {
  userId: string;
  tenantId: string;
  userName: string;
  userType: "company" | "professional" | "individual";
  createdBy: string;
  coins: number;
  reason: string;
  referralId: string;
};

async function creditWallet(args: CreditWalletArgs): Promise<void> {
  const walletRef = doc(db, "wallets", args.userId);

  await runTransaction(db, async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    const walletData = walletSnap.exists() ? (walletSnap.data() as Record<string, unknown>) : {};

    const currentIssued = Number(walletData.totalIssuedCoins ?? 0);
    const currentUtilized = Number(walletData.utilizedCoins ?? 0);
    const currentAvailable = Number(walletData.availableCoins ?? 0);

    const nextIssued = currentIssued + args.coins;
    const nextAvailable = currentAvailable + args.coins;

    transaction.set(
      walletRef,
      {
        userId: args.userId,
        tenantId: args.tenantId,
        userType: args.userType,
        userName: args.userName,
        totalIssuedCoins: nextIssued,
        utilizedCoins: currentUtilized,
        availableCoins: nextAvailable,
        createdBy: walletData.createdBy ?? args.createdBy,
        updatedBy: args.createdBy,
        createdAt: walletData.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const txRef = doc(collection(db, "walletTransactions"));
    transaction.set(txRef, {
      walletId: args.userId,
      userId: args.userId,
      tenantId: args.tenantId,
      userType: args.userType,
      userName: args.userName,
      transactionType: "credit",
      coins: args.coins,
      reason: args.reason,
      source: "referral",
      referralId: args.referralId,
      createdBy: args.createdBy,
      createdAt: serverTimestamp(),
    });
  });
}

export async function createReferral(args: {
  tenantId: string;
  referrerUserId: string;
  referrerName: string;
  referrerRole: ReferrerRole;
  referrerCompanyId?: string | null;
  referredType: ReferredType;
  referredEmail: string;
  referredPhone: string;
}): Promise<string> {
  const referredEmail = normalizeEmail(args.referredEmail);
  const referredPhone = normalizePhone(args.referredPhone);

  if (!referredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(referredEmail)) {
    throw new Error("Please provide a valid email address.");
  }

  if (!referredPhone || referredPhone.length < 10) {
    throw new Error("Please provide a valid phone number.");
  }

  if (
    args.referrerRole !== "company"
    && args.referrerRole !== "professional"
    && args.referrerRole !== "individual"
    && args.referrerRole !== "superadmin"
  ) {
    throw new Error("Only Company, Professional, Individual, or Super Admin can create referrals.");
  }

  const duplicateQuery = query(
    collection(db, "referrals"),
    where("tenantId", "==", args.tenantId),
    where("referredEmail", "==", referredEmail),
    where("status", "in", ["referred", "reminded"])
  );
  const duplicateSnap = await getDocs(duplicateQuery);
  if (!duplicateSnap.empty) {
    throw new Error("An active referral already exists for this email.");
  }

  const referralRef = doc(collection(db, "referrals"));

  await runTransaction(db, async (transaction) => {
    transaction.set(referralRef, {
      tenantId: args.tenantId,
      referrerUserId: args.referrerUserId,
      referrerName: args.referrerName,
      referrerRole: args.referrerRole,
      referrerCompanyId: args.referrerCompanyId ?? null,
      referredType: args.referredType,
      referredEmail,
      referredPhone,
      status: "referred",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const mailConfig = await getTenantMailConfig(args.tenantId);

  await sendReferralInviteEmail({
    mailConfig,
    referredEmail,
    referredPhone,
    referredType: args.referredType,
    tenantId: args.tenantId,
    referrerName: args.referrerName,
  });

  return referralRef.id;
}

export async function listReferralsForUser(args: {
  referrerUserId: string;
  referredType?: ReferredType | "all";
}): Promise<ReferralRecord[]> {
  const referralsQuery = query(
    collection(db, "referrals"),
    where("referrerUserId", "==", args.referrerUserId)
  );
  const snap = await getDocs(referralsQuery);

  const rows = snap.docs
    .map((entry) => toReferralRecord(entry.id, entry.data() as Record<string, unknown>))
    .filter((entry) => (args.referredType && args.referredType !== "all" ? entry.referredType === args.referredType : true))
    .sort((a, b) => {
      const first = a.createdAt && "toMillis" in a.createdAt ? a.createdAt.toMillis() : 0;
      const second = b.createdAt && "toMillis" in b.createdAt ? b.createdAt.toMillis() : 0;
      return second - first;
    });

  return rows;
}

export async function listAllReferrals(args?: {
  referrerRole?: ReferrerRole | "all";
  referredType?: ReferredType | "all";
  status?: ReferralStatus | "all";
}): Promise<ReferralRecord[]> {
  const snap = await getDocs(collection(db, "referrals"));

  return snap.docs
    .map((entry) => toReferralRecord(entry.id, entry.data() as Record<string, unknown>))
    .filter((entry) => (args?.referrerRole && args.referrerRole !== "all" ? entry.referrerRole === args.referrerRole : true))
    .filter((entry) => (args?.referredType && args.referredType !== "all" ? entry.referredType === args.referredType : true))
    .filter((entry) => (args?.status && args.status !== "all" ? entry.status === args.status : true))
    .sort((a, b) => {
      const first = a.createdAt && "toMillis" in a.createdAt ? a.createdAt.toMillis() : 0;
      const second = b.createdAt && "toMillis" in b.createdAt ? b.createdAt.toMillis() : 0;
      return second - first;
    });
}

export async function sendReferralReminders(args: {
  referralIds: string[];
  actorUserId: string;
}): Promise<number> {
  if (args.referralIds.length === 0) {
    return 0;
  }

  const uniqueIds = Array.from(new Set(args.referralIds));
  const reminders: Array<{ id: string; email: string; phone: string; type: ReferredType; tenantId: string }> = [];
  const batch = writeBatch(db);

  for (const referralId of uniqueIds) {
    const referralRef = doc(db, "referrals", referralId);
    const referralSnap = await getDoc(referralRef);
    if (!referralSnap.exists()) {
      continue;
    }

    const record = toReferralRecord(referralSnap.id, referralSnap.data() as Record<string, unknown>);
    if (record.status === "joined") {
      continue;
    }

    batch.update(referralRef, {
      status: "reminded",
      reminderSentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: args.actorUserId,
    });

    reminders.push({
      id: record.id,
      email: record.referredEmail,
      phone: record.referredPhone,
      type: record.referredType,
      tenantId: record.tenantId,
    });
  }

  if (reminders.length === 0) {
    return 0;
  }

  await batch.commit();
  const mailConfigByTenant = new Map<string, Promise<import("@/services/mail.service").TenantMailConfig>>();

  await Promise.all(
    reminders.map(async (entry) => {
      let mailConfigPromise = mailConfigByTenant.get(entry.tenantId);
      if (!mailConfigPromise) {
        mailConfigPromise = getTenantMailConfig(entry.tenantId);
        mailConfigByTenant.set(entry.tenantId, mailConfigPromise);
      }

      const mailConfig = await mailConfigPromise;

      return sendReferralReminderEmail({
        mailConfig,
        referralId: entry.id,
        referredEmail: entry.email,
        referredPhone: entry.phone,
        referredType: entry.type,
        tenantId: entry.tenantId,
      });
    })
  );

  return reminders.length;
}

export async function processReferralJoinForNewUser(args: {
  userId: string;
  fullName: string;
  tenantId: string;
  userType: "professional" | "individual";
  email: string;
  phoneE164: string;
}): Promise<void> {
  const targetType: ReferredType = args.userType === "professional" ? "coach" : "individual";
  const email = normalizeEmail(args.email);
  const phone = normalizePhone(args.phoneE164);

  // Query only by phone + tenantId (two-field equality — no composite index required).
  // Then filter referredType and status in code to avoid needing a multi-field index.
  const byPhoneQuery = query(
    collection(db, "referrals"),
    where("tenantId", "==", args.tenantId),
    where("referredPhone", "==", phone)
  );
  const byPhoneSnap = await getDocs(byPhoneQuery);

  let matches = byPhoneSnap.docs
    .map((entry) => toReferralRecord(entry.id, entry.data() as Record<string, unknown>))
    .filter((entry) =>
      entry.referredType === targetType && (entry.status === "referred" || entry.status === "reminded")
    );

  // Also try matching by email if phone gave no results and email is present
  if (matches.length === 0 && email) {
    const byEmailQuery = query(
      collection(db, "referrals"),
      where("tenantId", "==", args.tenantId),
      where("referredEmail", "==", email)
    );
    const byEmailSnap = await getDocs(byEmailQuery);
    matches = byEmailSnap.docs
      .map((entry) => toReferralRecord(entry.id, entry.data() as Record<string, unknown>))
      .filter((entry) =>
        entry.referredType === targetType && (entry.status === "referred" || entry.status === "reminded")
      );
  }

  if (matches.length === 0) {
    return;
  }

  // Use the oldest matching referral
  matches.sort((a, b) => {
    const first = a.createdAt && "toMillis" in a.createdAt ? a.createdAt.toMillis() : 0;
    const second = b.createdAt && "toMillis" in b.createdAt ? b.createdAt.toMillis() : 0;
    return first - second;
  });

  const matched = matches[0];
  const [joinReward, registrationCoins] = await Promise.all([
    getTenantReferralJoinReward(args.tenantId),
    getTenantRegistrationCoins(args.tenantId),
  ]);

  const referralRef = doc(db, "referrals", matched.id);
  const referrerWalletRef = doc(db, "wallets", matched.referrerUserId);
  const newUserWalletRef = doc(db, "wallets", args.userId);

  await runTransaction(db, async (transaction) => {
    const [referralSnap, referrerWalletSnap, newUserWalletSnap] = await Promise.all([
      transaction.get(referralRef),
      transaction.get(referrerWalletRef),
      transaction.get(newUserWalletRef),
    ]);

    if (!referralSnap.exists()) {
      return;
    }

    const latest = toReferralRecord(referralSnap.id, referralSnap.data() as Record<string, unknown>);
    if (latest.status === "joined") {
      return;
    }

    // Mark referral as joined
    transaction.update(referralRef, {
      status: "joined",
      joinedAt: serverTimestamp(),
      joinedUserId: args.userId,
      updatedAt: serverTimestamp(),
      updatedBy: args.userId,
    });

    const referrerRole =
      latest.referrerRole === "company" || latest.referrerRole === "professional" || latest.referrerRole === "individual"
        ? latest.referrerRole
        : "individual";

    // Credit referrer with join reward (5 coins)
    const referrerData = referrerWalletSnap.exists() ? (referrerWalletSnap.data() as Record<string, unknown>) : {};
    transaction.set(
      referrerWalletRef,
      {
        userId: latest.referrerUserId,
        tenantId: latest.tenantId,
        userType: referrerRole,
        userName: latest.referrerName,
        totalIssuedCoins: Number(referrerData.totalIssuedCoins ?? 0) + joinReward,
        utilizedCoins: Number(referrerData.utilizedCoins ?? 0),
        availableCoins: Number(referrerData.availableCoins ?? 0) + joinReward,
        createdBy: referrerData.createdBy ?? latest.referrerUserId,
        updatedBy: args.userId,
        createdAt: referrerData.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const referrerTxRef = doc(collection(db, "walletTransactions"));
    transaction.set(referrerTxRef, {
      walletId: latest.referrerUserId,
      userId: latest.referrerUserId,
      tenantId: latest.tenantId,
      userType: referrerRole,
      userName: latest.referrerName,
      transactionType: "credit",
      coins: joinReward,
      reason: "Referral joined reward",
      source: "referral",
      referralId: latest.id,
      joinedUserId: args.userId,
      joinedUserName: args.fullName,
      createdBy: args.userId,
      createdAt: serverTimestamp(),
    });

    // Credit the new (referred) user with registration coins (10 coins)
    if (registrationCoins > 0) {
      const newUserData = newUserWalletSnap.exists() ? (newUserWalletSnap.data() as Record<string, unknown>) : {};
      transaction.set(
        newUserWalletRef,
        {
          userId: args.userId,
          tenantId: args.tenantId,
          userType: args.userType,
          userName: args.fullName,
          totalIssuedCoins: Number(newUserData.totalIssuedCoins ?? 0) + registrationCoins,
          utilizedCoins: Number(newUserData.utilizedCoins ?? 0),
          availableCoins: Number(newUserData.availableCoins ?? 0) + registrationCoins,
          createdBy: newUserData.createdBy ?? "system",
          updatedBy: "system",
          createdAt: newUserData.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const newUserTxRef = doc(collection(db, "walletTransactions"));
      transaction.set(newUserTxRef, {
        walletId: args.userId,
        userId: args.userId,
        tenantId: args.tenantId,
        userType: args.userType,
        userName: args.fullName,
        transactionType: "credit",
        coins: registrationCoins,
        reason: "Welcome coins — referred user registration",
        source: "referral",
        referralId: latest.id,
        createdBy: "system",
        createdAt: serverTimestamp(),
      });
    }
  });
}

export async function updateReferralStatus(args: {
  referralId: string;
  status: ReferralStatus;
  actorUserId: string;
}): Promise<void> {
  await updateDoc(doc(db, "referrals", args.referralId), {
    status: args.status,
    updatedAt: serverTimestamp(),
    updatedBy: args.actorUserId,
  });
}
