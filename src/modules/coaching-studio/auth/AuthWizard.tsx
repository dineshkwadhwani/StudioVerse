"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import styles from "./AuthWizard.module.css";

type UserRole = "company" | "professional" | "individual";
type CompanyPosition = "owner" | "coach";

type Phase =
  | "phone"
  | "otp"
  | "role-select"
  | "details"
  | "done";

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

type Props = {
  onClose?: () => void;
};

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-phone-number":
        return "Please enter a valid mobile number with the correct country code.";
      case "auth/too-many-requests":
        return "Too many attempts were made. Please wait a few minutes and try again.";
      case "auth/invalid-verification-code":
        return "The OTP you entered is incorrect. Please check the code and try again.";
      case "auth/code-expired":
        return "This OTP has expired. Please request a new code.";
      case "auth/missing-app-credential":
      case "auth/invalid-app-credential":
        return "Phone verification could not start. Refresh the page, complete reCAPTCHA again, and try once more.";
      case "auth/network-request-failed":
        return "OTP could not be sent. If you are testing locally, use a Firebase test phone number or check your Firebase phone-auth setup and internet connection.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function AuthWizard({ onClose }: Props) {
  const router = useRouter();

  function logFlow(step: string, details?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[CoachingAuthWizard]", step, details ?? {});
    }
  }

  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState<UserRole>("individual");
  const [companyName, setCompanyName] = useState("");
  const [companyPosition, setCompanyPosition] = useState<CompanyPosition>("owner");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  function clearRecaptcha() {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }

  function setupRecaptcha() {
    if (recaptchaRef.current || typeof window === "undefined") {
      return;
    }

    try {
      recaptchaRef.current = new RecaptchaVerifier(auth, "auth-wizard-recaptcha", {
        size: "normal",
      });
      void recaptchaRef.current.render().catch(() => {
        setError("Phone verification could not be prepared. Refresh the page and try again.");
        clearRecaptcha();
      });
    } catch {
      setError("Phone verification could not be prepared. Refresh the page and try again.");
      clearRecaptcha();
    }
  }

  useEffect(() => {
    setupRecaptcha();

    return () => {
      clearRecaptcha();
    };
  }, []);

  async function handleSendOtp() {
    setError("");
    setInfo("");
    const normalized = normalizePhone(phone);
    logFlow("send-otp:start", { phone: normalized });
    if (!normalized.startsWith("+") || normalized.length < 12) {
      setError("Please enter a valid mobile number.");
      logFlow("send-otp:invalid-phone");
      return;
    }
    if (!recaptchaRef.current) {
      setError("reCAPTCHA not ready. Please wait a moment and try again.");
      logFlow("send-otp:recaptcha-not-ready");
      return;
    }
    setBusy(true);
    try {
      const result = await signInWithPhoneNumber(auth, normalized, recaptchaRef.current);
      confirmationRef.current = result;
      setInfo("OTP sent to your mobile. We will check your profile after verification.");
      setPhase("otp");
      logFlow("send-otp:success");
    } catch (err) {
      clearRecaptcha();
      setupRecaptcha();
      logFlow("send-otp:error", {
        message: err instanceof Error ? err.message : "unknown-error",
      });
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setInfo("");
    logFlow("verify-otp:start");
    if (!confirmationRef.current) {
      setError("Please request an OTP first.");
      logFlow("verify-otp:no-confirmation");
      return;
    }
    setBusy(true);
    try {
      const credential = await confirmationRef.current.confirm(otp);
      const firebaseUser = credential.user;
      const normalizedPhone = normalizePhone(phone);

      const existing = await getDocs(
        query(
          collection(db, "users"),
          where("phoneE164", "==", normalizedPhone),
          where("tenantId", "==", "coaching-studio"),
          limit(1)
        )
      );

      if (!existing.empty) {
        const userData = existing.docs[0].data();
        logFlow("verify-otp:existing-user", { role: userData.userType as string });
        sessionStorage.setItem("cs_uid", firebaseUser.uid);
        sessionStorage.setItem("cs_role", userData.userType as string);
        sessionStorage.setItem("cs_name", userData.name as string);
        router.push("/coaching-studio/dashboard");
        onClose?.();
        return;
      }

      setInfo("Mobile number verified. Tell us a little about yourself to complete registration.");
      setPhase("role-select");
      logFlow("verify-otp:new-user");
    } catch (err) {
      logFlow("verify-otp:error", {
        message: err instanceof Error ? err.message : "unknown-error",
      });
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setError("");
    setBusy(true);
    logFlow("register:start", { role });
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("Session expired. Please start again.");

      const normalizedPhone = normalizePhone(phone);
      const userRef = doc(collection(db, "users"));

      const base = {
        uid: firebaseUser.uid,
        phoneE164: normalizedPhone,
        tenantId: "coaching-studio",
        status: "active" as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (role === "individual") {
        await setDoc(userRef, {
          ...base,
          name: fullName.trim(),
          userType: "individual",
        });
      } else if (role === "professional") {
        await setDoc(userRef, {
          ...base,
          name: fullName.trim(),
          userType: "professional",
        });
      } else {
        await setDoc(userRef, {
          ...base,
          name: fullName.trim(),
          userType: "company",
          companyName: companyName.trim(),
          companyPosition,
        });
      }

      sessionStorage.setItem("cs_uid", firebaseUser.uid);
      sessionStorage.setItem("cs_role", role === "company" ? "company" : role === "professional" ? "professional" : "individual");
      sessionStorage.setItem("cs_name", fullName.trim());
      setPhase("done");
      logFlow("register:success", { role, name: fullName.trim() });
      setTimeout(() => {
        router.push("/coaching-studio/dashboard");
        onClose?.();
      }, 800);
    } catch (err) {
      logFlow("register:error", {
        message: err instanceof Error ? err.message : "unknown-error",
      });
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wizard}>
      {/* Progress indicator */}
      <div className={styles.steps}>
        <span className={`${styles.step} ${["phone","otp"].includes(phase) ? styles.stepActive : styles.stepDone}`}>1. Verify</span>
        <span className={styles.stepDivider}>›</span>
        <span className={`${styles.step} ${phase === "role-select" ? styles.stepActive : ["details","done"].includes(phase) ? styles.stepDone : ""}`}>2. Role</span>
        <span className={styles.stepDivider}>›</span>
        <span className={`${styles.step} ${phase === "details" ? styles.stepActive : phase === "done" ? styles.stepDone : ""}`}>3. Details</span>
      </div>

      {/* Phase: phone */}
      {phase === "phone" && (
        <div className={styles.phaseBlock}>
          <h3 className={styles.phaseTitle}>Enter your mobile number</h3>
          <p className={styles.phaseHint}>We will send you a one-time code to verify.</p>
          <label className={styles.label} htmlFor="wiz-phone">Mobile Number</label>
          <input
            id="wiz-phone"
            className={styles.input}
            type="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div id="auth-wizard-recaptcha" className={styles.recaptcha} />
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={handleSendOtp}
          >
            {busy ? "Sending…" : "Send OTP"}
          </button>
        </div>
      )}

      {/* Phase: OTP */}
      {phase === "otp" && (
        <div className={styles.phaseBlock}>
          <h3 className={styles.phaseTitle}>Enter verification code</h3>
          <p className={styles.phaseHint}>Check your SMS for a 6-digit code.</p>
          <label className={styles.label} htmlFor="wiz-otp">OTP</label>
          <input
            id="wiz-otp"
            className={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button type="button" className={styles.primary} disabled={busy} onClick={handleVerifyOtp}>
            {busy ? "Verifying…" : "Verify OTP"}
          </button>
          <button type="button" className={styles.ghost} onClick={() => setPhase("phone")}>
            ← Change number
          </button>
        </div>
      )}

      {/* Phase: role select */}
      {phase === "role-select" && (
        <div className={styles.phaseBlock}>
          <h3 className={styles.phaseTitle}>Who are you?</h3>
          <p className={styles.phaseHint}>Tell us how you will use Coaching Studio.</p>
          <div className={styles.roleGrid}>
            {(["company", "professional", "individual"] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.roleTile} ${role === r ? styles.roleTileActive : ""}`}
                onClick={() => setRole(r)}
              >
                <span className={styles.roleIcon}>
                  {r === "company" ? "🏢" : r === "professional" ? "🎓" : "👤"}
                </span>
                <span className={styles.roleLabel}>
                  {r === "company" ? "Coaching Company" : r === "professional" ? "Coach" : "Learner"}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.primary} onClick={() => setPhase("details")}>
            Continue →
          </button>
        </div>
      )}

      {/* Phase: details */}
      {phase === "details" && (
        <div className={styles.phaseBlock}>
          <h3 className={styles.phaseTitle}>Complete your profile</h3>

          {role === "company" && (
            <>
              <label className={styles.label} htmlFor="wiz-company">Company Name</label>
              <input id="wiz-company" className={styles.input} placeholder="e.g. Acme Coaching" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />

              <label className={styles.label}>Your role in this company</label>
              <div className={styles.radioRow}>
                <label className={styles.radioPill}>
                  <input type="radio" name="pos" checked={companyPosition === "owner"} onChange={() => setCompanyPosition("owner")} />
                  Owner
                </label>
                <label className={styles.radioPill}>
                  <input type="radio" name="pos" checked={companyPosition === "coach"} onChange={() => setCompanyPosition("coach")} />
                  Coach
                </label>
              </div>

              <label className={styles.label} htmlFor="wiz-name">Your Full Name</label>
              <input id="wiz-name" className={styles.input} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </>
          )}

          {role === "professional" && (
            <>
              <label className={styles.label} htmlFor="wiz-name">Your Full Name</label>
              <input id="wiz-name" className={styles.input} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </>
          )}

          {role === "individual" && (
            <>
              <label className={styles.label} htmlFor="wiz-name">Your Full Name</label>
              <input id="wiz-name" className={styles.input} placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </>
          )}

          <button type="button" className={styles.primary} disabled={busy} onClick={handleRegister}>
            {busy ? "Registering…" : "Complete Registration"}
          </button>
          <button type="button" className={styles.ghost} onClick={() => setPhase("role-select")}>
            ← Back
          </button>
        </div>
      )}

      {/* Phase: done */}
      {phase === "done" && (
        <div className={styles.phaseBlock}>
          <p className={styles.doneText}>✅ Registered! Redirecting to your dashboard…</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.info}>{info}</p>}
    </div>
  );
}
