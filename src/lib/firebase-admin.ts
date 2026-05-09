import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function resolveProjectId(): string | undefined {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function resolveAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeApp(
    projectId
      ? {
          credential: applicationDefault(),
          projectId,
        }
      : {
          credential: applicationDefault(),
        }
  );
}

let adminApp: ReturnType<typeof initializeApp> | null = null;
try {
  adminApp = resolveAdminApp();
} catch (err) {
  console.warn("⚠️ Firebase Admin initialization failed (this is OK for dev):", err);
}

// Cast as non-nullable: if adminApp is null, routes will throw at runtime and
// their existing catch blocks will return a 500 response.
export const adminAuth = (adminApp ? getAuth(adminApp) : null) as Auth;
export const adminDb = (adminApp ? getFirestore(adminApp) : null) as Firestore;
