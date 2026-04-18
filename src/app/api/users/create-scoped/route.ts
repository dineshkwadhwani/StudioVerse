import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type AppUserType = "company" | "professional" | "individual";

type CreateScopedUserBody = {
  action?: "lookup" | "create";
  targetUserType: "professional" | "individual";
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
  coachProfessionalId?: string;
};

type UserDoc = {
  uid?: string;
  userId?: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneE164?: string;
  phone?: string;
  userType?: AppUserType;
  profileType?: AppUserType;
  role?: AppUserType;
  status?: "active" | "inactive";
  tenantId?: string;
  companyName?: string;
  associatedCompanyId?: string;
  associatedProfessionalId?: string | null;
  createdByUserId?: string;
  createdByRole?: AppUserType;
  assignmentEligible?: boolean;
  mandatoryProfileCompleted?: boolean;
  profileCompletionPercent?: number;
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
};

function normalize(value: string): string {
  return value.trim();
}

function normalizeEmail(value: string): string {
  return normalize(value).toLowerCase();
}

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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error.";
}

async function resolveCreator(authUid: string) {
  const directSnap = await adminDb.collection("users").doc(authUid).get();
  if (directSnap.exists) {
    return {
      id: directSnap.id,
      ...(directSnap.data() as UserDoc),
    };
  }

  const uidSnap = await adminDb.collection("users").where("uid", "==", authUid).limit(1).get();
  if (!uidSnap.empty) {
    const row = uidSnap.docs[0];
    return {
      id: row.id,
      ...(row.data() as UserDoc),
    };
  }

  return null;
}

function mapUserForResponse(id: string, user: UserDoc) {
  return {
    id,
    ...user,
  };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }

    const idToken = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);

    const creator = await resolveCreator(decoded.uid);
    if (!creator) {
      return NextResponse.json({ error: "Creator profile not found.", requestId }, { status: 403 });
    }

    const creatorRole = creator.userType ?? creator.profileType ?? creator.role;
    if (creatorRole !== "company" && creatorRole !== "professional") {
      return NextResponse.json({ error: "Only Company or Professional can create users.", requestId }, { status: 403 });
    }

    const body = (await request.json()) as CreateScopedUserBody;
    const action = body.action ?? "create";
    const firstName = normalize(body.firstName || "");
    const lastName = normalize(body.lastName || "");
    const email = normalizeEmail(body.email || "");
    const phoneE164 = normalizePhone(body.phoneE164 || "");
    const targetUserType = body.targetUserType;

    if (action !== "lookup" && action !== "create") {
      return NextResponse.json({ error: "Invalid action.", requestId }, { status: 400 });
    }

    if (targetUserType !== "professional" && targetUserType !== "individual") {
      return NextResponse.json({ error: "Invalid targetUserType.", requestId }, { status: 400 });
    }

    if (!phoneE164) {
      return NextResponse.json({ error: "phoneE164 is required.", requestId }, { status: 400 });
    }

    if (creatorRole === "professional" && targetUserType !== "individual") {
      return NextResponse.json({ error: "Professional can create only Individual users.", requestId }, { status: 403 });
    }

    const tenantId = creator.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Creator tenant is missing.", requestId }, { status: 400 });
    }

    const associatedCompanyId =
      creatorRole === "company"
        ? creator.id
        : creator.associatedCompanyId || undefined;

    let associatedProfessionalId: string | null = null;

    if (creatorRole === "company" && targetUserType === "individual" && body.coachProfessionalId?.trim()) {
      const coachId = body.coachProfessionalId.trim();
      const coachSnap = await adminDb.collection("users").doc(coachId).get();
      if (!coachSnap.exists) {
        return NextResponse.json({ error: "Selected coach not found.", requestId }, { status: 400 });
      }
      const coach = coachSnap.data() as UserDoc;
      const coachRole = coach.userType ?? coach.profileType ?? coach.role;
      if (coachRole !== "professional") {
        return NextResponse.json({ error: "Selected coach is not a Professional.", requestId }, { status: 400 });
      }
      if (coach.tenantId !== tenantId || coach.associatedCompanyId !== creator.id) {
        return NextResponse.json({ error: "Coach must belong to same Company.", requestId }, { status: 400 });
      }
      if (coach.status === "inactive") {
        return NextResponse.json({ error: "Selected coach is inactive.", requestId }, { status: 400 });
      }
      associatedProfessionalId = coachId;
    }

    if (creatorRole === "professional" && targetUserType === "individual") {
      associatedProfessionalId = creator.id;
    }

    const existingByPhone = await adminDb
      .collection("users")
      .where("phoneE164", "==", phoneE164)
      .limit(1)
      .get();

    if (action === "lookup") {
      if (existingByPhone.empty) {
        return NextResponse.json({ requestId, found: false });
      }

      const existingRow = existingByPhone.docs[0];
      const existing = existingRow.data() as UserDoc;
      const existingRole = existing.userType ?? existing.profileType ?? existing.role;

      if (existingRole !== targetUserType) {
        return NextResponse.json(
          { error: "The phone number belongs to a different user type.", requestId },
          { status: 409 }
        );
      }

      if (existing.tenantId && existing.tenantId !== tenantId) {
        return NextResponse.json(
          { error: "This Individual belongs to another tenant and cannot be associated here.", requestId },
          { status: 409 }
        );
      }

      return NextResponse.json({
        requestId,
        found: true,
        operation: "lookup",
        user: mapUserForResponse(existingRow.id, existing),
      });
    }

    // Prefer linking an existing profile by phone before creating a new auth/user record.
    if (!existingByPhone.empty) {
      const existingRow = existingByPhone.docs[0];
      const existing = existingRow.data() as UserDoc;
      const existingRole = existing.userType ?? existing.profileType ?? existing.role;

      if (existingRole !== targetUserType) {
        return NextResponse.json(
          { error: "The phone number belongs to a different user type.", requestId },
          { status: 409 }
        );
      }

      if (existing.tenantId && existing.tenantId !== tenantId) {
        return NextResponse.json(
          { error: "This Individual belongs to another tenant and cannot be associated here.", requestId },
          { status: 409 }
        );
      }

      const updatePayload: Partial<UserDoc> & { updatedAt: FieldValue } = {
        tenantId,
        associatedCompanyId,
        companyName: creator.companyName ?? existing.companyName ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (targetUserType === "individual") {
        if (creatorRole === "professional") {
          updatePayload.associatedProfessionalId = creator.id;
        } else if (associatedProfessionalId) {
          updatePayload.associatedProfessionalId = associatedProfessionalId;
        }
      }

      if (targetUserType === "professional" && creatorRole !== "company") {
        return NextResponse.json(
          { error: "Only Company can associate Professional users.", requestId },
          { status: 403 }
        );
      }

      await existingRow.ref.set(updatePayload, { merge: true });
      const refreshed = (await existingRow.ref.get()).data() as UserDoc;

      return NextResponse.json({
        requestId,
        operation: "associated",
        user: mapUserForResponse(existingRow.id, refreshed),
      });
    }

    if (!firstName || !lastName || !email || !phoneE164) {
      return NextResponse.json(
        { error: "firstName, lastName, email, and phoneE164 are required when creating a new user.", requestId },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email format.", requestId }, { status: 400 });
    }

    const duplicateByEmail = await adminDb.collection("users").where("email", "==", email).limit(1).get();
    if (!duplicateByEmail.empty) {
      return NextResponse.json({ error: "A user with this email already exists.", requestId }, { status: 409 });
    }

    const fullName = `${firstName} ${lastName}`.trim();

    const authUser = await adminAuth.createUser({
      email,
      phoneNumber: phoneE164,
      displayName: fullName,
      emailVerified: false,
      disabled: false,
    });

    const payload: UserDoc & {
      createdByUserId: string;
      createdByRole: AppUserType;
      createdAt: FieldValue;
      updatedAt: FieldValue;
      assignmentEligible: boolean;
      mandatoryProfileCompleted: boolean;
      profileCompletionPercent: number;
    } = {
      uid: authUser.uid,
      userId: authUser.uid,
      name: fullName,
      fullName,
      firstName,
      lastName,
      email,
      phoneE164,
      phone: phoneE164,
      userType: targetUserType,
      profileType: targetUserType,
      role: targetUserType,
      status: "active",
      tenantId,
      companyName: creator.companyName ?? "",
      associatedCompanyId,
      associatedProfessionalId,
      createdByUserId: creator.id,
      createdByRole: creatorRole,
      assignmentEligible: false,
      mandatoryProfileCompleted: false,
      profileCompletionPercent: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    try {
      await adminDb.collection("users").doc(authUser.uid).set(payload);
    } catch (firestoreError) {
      await adminAuth.deleteUser(authUser.uid);
      throw firestoreError;
    }

    return NextResponse.json({
      requestId,
      operation: "created",
      user: {
        id: authUser.uid,
        ...payload,
      },
    });
  } catch (error) {
    console.error("[users/create-scoped] failed", {
      requestId,
      error: toErrorMessage(error),
    });

    return NextResponse.json(
      {
        error: toErrorMessage(error),
        requestId,
      },
      { status: 500 }
    );
  }
}
