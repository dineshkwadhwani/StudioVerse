import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { consumeRateLimit } from "@/lib/rate-limit";

type CreateReferralPayload = {
  tenantId: string;
  referredName?: string;
  referredPhone?: string;
  referredEmail?: string;
  referredUserId?: string;
  source?: string;
};

type UpdateReferralPayload = {
  referralId: string;
  referredEmail: string;
};

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

async function getOldestSuperAdmin(): Promise<{ id: string; name: string }> {
  const usersSnap = await adminDb
    .collection("users")
    .where("userType", "==", "superadmin")
    .limit(50)
    .get();

  if (usersSnap.empty) {
    return { id: "system", name: "Super Admin" };
  }

  const oldest = usersSnap.docs
    .slice()
    .sort((a, b) => {
      const aMillis = a.get("createdAt")?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const bMillis = b.get("createdAt")?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      return aMillis - bMillis;
    })[0];

  return {
    id: oldest.id,
    name: String(oldest.get("name") ?? "Super Admin"),
  };
}

export async function POST(req: NextRequest) {
  const rateLimit = consumeRateLimit({
    req,
    routeKey: "bot-referral-create",
    limit: 25,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rateLimit.retryAfterSec}s.` },
      { status: 429, headers: rateLimit.headers }
    );
  }

  try {
    const body = (await req.json()) as Partial<CreateReferralPayload>;
    const tenantId = String(body.tenantId ?? "").trim();
    const referredName = String(body.referredName ?? "").trim();
    const referredPhone = normalizePhone(String(body.referredPhone ?? "").trim());
    const referredEmail = String(body.referredEmail ?? "").trim().toLowerCase();
    const referredUserId = String(body.referredUserId ?? "").trim();
    const source = String(body.source ?? "bot").trim() || "bot";

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400, headers: rateLimit.headers });
    }

    if (!referredName && !referredPhone && !referredEmail && !referredUserId) {
      return NextResponse.json(
        { error: "At least one referred contact field is required." },
        { status: 400, headers: rateLimit.headers }
      );
    }

    const superAdmin = await getOldestSuperAdmin();
    const referralRef = adminDb.collection("referrals").doc();

    await referralRef.set({
      tenantId,
      referrerUserId: superAdmin.id,
      referrerName: superAdmin.name,
      referrerRole: "superadmin",
      referrerCompanyId: null,
      referredType: "individual",
      referredEmail,
      referredPhone,
      referredName,
      referredUserId,
      status: "referred",
      source,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, referralId: referralRef.id }, { headers: rateLimit.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create referral.";
    const lowered = message.toLowerCase();
    const isCredentialError = lowered.includes("default credentials") || lowered.includes("could not load");

    if (isCredentialError) {
      return NextResponse.json(
        {
          ok: false,
          warning: "Referral persistence skipped in this environment.",
          code: "admin_credentials_missing",
        },
        { status: 200, headers: rateLimit.headers }
      );
    }

    return NextResponse.json({ error: message }, { status: 500, headers: rateLimit.headers });
  }
}

export async function PATCH(req: NextRequest) {
  const rateLimit = consumeRateLimit({
    req,
    routeKey: "bot-referral-update",
    limit: 25,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rateLimit.retryAfterSec}s.` },
      { status: 429, headers: rateLimit.headers }
    );
  }

  try {
    const body = (await req.json()) as Partial<UpdateReferralPayload>;
    const referralId = String(body.referralId ?? "").trim();
    const referredEmail = String(body.referredEmail ?? "").trim().toLowerCase();

    if (!referralId || !referredEmail) {
      return NextResponse.json(
        { error: "referralId and referredEmail are required." },
        { status: 400, headers: rateLimit.headers }
      );
    }

    await adminDb.collection("referrals").doc(referralId).set(
      {
        referredEmail,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true }, { headers: rateLimit.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update referral.";
    const lowered = message.toLowerCase();
    const isCredentialError = lowered.includes("default credentials") || lowered.includes("could not load");

    if (isCredentialError) {
      return NextResponse.json(
        {
          ok: false,
          warning: "Referral update skipped in this environment.",
          code: "admin_credentials_missing",
        },
        { status: 200, headers: rateLimit.headers }
      );
    }

    return NextResponse.json({ error: message }, { status: 500, headers: rateLimit.headers });
  }
}