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
import { httpsCallable } from "firebase/functions";
import { db } from "@/services/firebase";
import { functions } from "@/services/firebase";
import { getTenantMailConfig, sendReferralInviteEmail, sendReferralReminderEmail } from "@/services/mail.service";
import type {
  ReferredType,
  ReferralRecord,
  ReferrerRole,
  ReferralStatus,
} from "@/types/referral";

const processReferralJoinCallable = httpsCallable<
  {
    userId: string;
    fullName: string;
    tenantId: string;
    userType: "professional" | "individual";
    email: string;
    phoneE164: string;
  },
  { status: string }
>(functions, "processReferralJoinWithTreasury");

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
  tenantId?: string;
}): Promise<ReferralRecord[]> {
  const snap = await getDocs(collection(db, "referrals"));

  return snap.docs
    .map((entry) => toReferralRecord(entry.id, entry.data() as Record<string, unknown>))
    .filter((entry) => (args?.tenantId ? entry.tenantId === args.tenantId : true))
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
  await processReferralJoinCallable({
    userId: args.userId,
    fullName: args.fullName,
    tenantId: args.tenantId,
    userType: args.userType,
    email: args.email,
    phoneE164: args.phoneE164,
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
