import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type UserDoc = {
  uid?: string;
  userType?: "superadmin" | "company" | "professional" | "individual";
  status?: "active" | "inactive";
};

type CreateSuperadminBody = {
  fullName?: string;
  email?: string;
  phoneE164?: string;
  status?: "active" | "inactive";
};

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length > 10 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

async function resolveActor(authUid: string): Promise<(UserDoc & { id: string }) | null> {
  const direct = await adminDb.collection("users").doc(authUid).get();
  if (direct.exists) {
    return { id: direct.id, ...(direct.data() as UserDoc) };
  }

  const byUid = await adminDb.collection("users").where("uid", "==", authUid).limit(1).get();
  if (byUid.empty) {
    return null;
  }

  const row = byUid.docs[0];
  return { id: row.id, ...(row.data() as UserDoc) };
}

async function findPendingInvitation(args: { phoneE164: string; email?: string }) {
  const byPhone = await adminDb
    .collection("invitations")
    .where("phoneE164", "==", args.phoneE164)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!byPhone.empty) {
    return byPhone.docs[0];
  }

  if (!args.email) {
    return null;
  }

  const byEmail = await adminDb
    .collection("invitations")
    .where("email", "==", args.email)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  return byEmail.empty ? null : byEmail.docs[0];
}

async function assertNoExistingUser(args: { phoneE164: string; email?: string }) {
  const byPhone = await adminDb.collection("users").where("phoneE164", "==", args.phoneE164).limit(1).get();
  if (!byPhone.empty) {
    throw new Error("This phone number is already linked to another user.");
  }

  if (args.email) {
    const byEmail = await adminDb.collection("users").where("email", "==", args.email).limit(1).get();
    if (!byEmail.empty) {
      throw new Error("This email is already linked to another user.");
    }
  }

  try {
    await adminAuth.getUserByPhoneNumber(args.phoneE164);
    throw new Error("This phone number is already linked to another auth user.");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("There is no user record")) {
      if (error instanceof Error && error.message === "This phone number is already linked to another auth user.") {
        throw error;
      }
    }
  }

  if (!args.email) {
    return;
  }

  try {
    await adminAuth.getUserByEmail(args.email);
    throw new Error("This email is already linked to another auth user.");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("There is no user record")) {
      if (error instanceof Error && error.message === "This email is already linked to another auth user.") {
        throw error;
      }
    }
  }
}

export async function POST(request: NextRequest) {
  let createdAuthUid: string | null = null;
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);

    const actor = await resolveActor(decoded.uid);
    if (!actor || actor.userType !== "superadmin" || actor.status !== "active") {
      return NextResponse.json({ error: "Only active superadmins can create superadmins." }, { status: 403 });
    }

    const body = (await request.json()) as CreateSuperadminBody;
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phoneE164 = normalizePhone(String(body.phoneE164 ?? ""));
    const status = body.status === "inactive" ? "inactive" : "active";

    if (!fullName) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!phoneE164 || phoneE164 === "+" || phoneE164.length < 10) {
      return NextResponse.json({ error: "Phone number is required and must be valid." }, { status: 400 });
    }

    const pendingInvitation = await findPendingInvitation({ phoneE164, email: email || undefined });
    if (pendingInvitation) {
      const data = pendingInvitation.data() as Record<string, unknown>;
      if (String(data.userType ?? "") !== "superadmin") {
        return NextResponse.json({ error: "A pending invitation already exists for this phone or email." }, { status: 409 });
      }
    }

    await assertNoExistingUser({ phoneE164, email: email || undefined });

    const authUser = await adminAuth.createUser({
      displayName: fullName,
      phoneNumber: phoneE164,
      ...(email ? { email } : {}),
      disabled: status === "inactive",
    });
    createdAuthUid = authUser.uid;

    const userPayload: Record<string, unknown> = {
      userId: authUser.uid,
      uid: authUser.uid,
      tenantId: "platform",
      userType: "superadmin",
      profileType: "superadmin",
      role: "superadmin",
      status,
      firstName: "",
      lastName: "",
      fullName,
      email,
      phoneE164,
      phone: phoneE164,
      companyName: "",
      associatedCompanyId: null,
      associatedProfessionalId: null,
      createdByUserId: actor.id,
      createdByRole: "superadmin",
      assignmentEligible: true,
      mandatoryProfileCompleted: false,
      profileCompletionPercent: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.runTransaction(async (transaction) => {
      transaction.set(adminDb.collection("users").doc(authUser.uid), userPayload, { merge: true });

      if (pendingInvitation) {
        transaction.update(pendingInvitation.ref, {
          status: "claimed",
          claimedUid: authUser.uid,
          claimedUserId: authUser.uid,
          claimedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    await adminAuth.setCustomUserClaims(authUser.uid, { superadmin: true });

    return NextResponse.json({
      status: "ok",
      user: {
        id: authUser.uid,
        ...userPayload,
      },
    });
  } catch (error) {
    if (createdAuthUid) {
      try {
        await adminAuth.deleteUser(createdAuthUid);
      } catch {
        // Best-effort cleanup only.
      }
    }

    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}