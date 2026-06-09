import { auth } from "@/services/firebase";

export type DirectSuperadminStatus = "active" | "inactive";

export async function createSuperadminUser(input: {
  fullName: string;
  email: string;
  phoneE164: string;
  status: DirectSuperadminStatus;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/admin/users/create-superadmin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fullName: input.fullName,
      email: input.email,
      phoneE164: input.phoneE164,
      status: input.status,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to create superadmin.");
  }
}