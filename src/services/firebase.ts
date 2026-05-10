import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// E2E mode: bypass reCAPTCHA verification for Firebase Auth phone OTP. Pairs
// with pre-provisioned Firebase test phone numbers (fixed OTP) so Playwright
// can sign in without solving the reCAPTCHA widget. Strictly opt-in via an env
// var the test runner sets — never enabled in dev/prod.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_E2E === "true") {
  auth.settings.appVerificationDisabledForTesting = true;
  // eslint-disable-next-line no-console
  console.info("[firebase] E2E mode: appVerificationDisabledForTesting=true");
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-south1");
export default app;