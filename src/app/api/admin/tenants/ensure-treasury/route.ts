import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

type UserDoc = {
  uid?: string;
  userType?: "superadmin" | "company" | "professional" | "individual";
  status?: "active" | "inactive";
};

type EnsureTreasuryBody = {
  tenantId?: string;
  openingCoins?: number;
};

const TREASURY_OWNER_USER_ID = "9767676738";

function buildTenantTreasuryWalletId(tenantId: string): string {
  return `treasury::${tenantId.trim()}`;
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

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authorization.slice("Bearer ".length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);

    const actor = await resolveActor(decoded.uid);
    if (!actor || actor.userType !== "superadmin" || actor.status !== "active") {
      return NextResponse.json({ error: "Only active superadmins can ensure tenant treasury wallet." }, { status: 403 });
    }

    const body = (await request.json()) as EnsureTreasuryBody;
    const tenantId = String(body.tenantId ?? "").trim().toLowerCase();
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    const openingCoins = Math.max(0, Math.floor(Number(body.openingCoins ?? 0)));
    const walletId = buildTenantTreasuryWalletId(tenantId);
    const walletRef = adminDb.collection("wallets").doc(walletId);

    let created = false;
    await adminDb.runTransaction(async (tx) => {
      const walletSnap = await tx.get(walletRef);
      if (walletSnap.exists) {
        return;
      }

      created = true;
      tx.set(walletRef, {
        userId: TREASURY_OWNER_USER_ID,
        tenantId,
        userType: "superadmin",
        userName: "Tenant Treasury",
        totalIssuedCoins: openingCoins,
        utilizedCoins: 0,
        availableCoins: openingCoins,
        createdBy: actor.id,
        updatedBy: actor.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (openingCoins > 0) {
        const txRef = adminDb.collection("walletTransactions").doc();
        tx.set(txRef, {
          walletId,
          userId: TREASURY_OWNER_USER_ID,
          tenantId,
          userType: "superadmin",
          userName: "Tenant Treasury",
          transactionType: "credit",
          reason: "Tenant treasury opening balance",
          source: "manual_offline_allocation",
          coins: openingCoins,
          createdBy: actor.id,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({ status: "ok", walletId, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
