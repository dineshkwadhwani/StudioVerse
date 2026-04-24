'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import styles from './LoginRegisterModal.module.css';
import firebaseApp from '@/services/firebase';
import { createWalletForUser, ensureWalletExists, getTenantRegistrationFreeCoins } from '@/services/wallet.service';
import { processReferralJoinForNewUser } from '@/services/referral.service';
import { config as coachingTenantConfig } from '@/tenants/coaching-studio/config';
import type { WalletUserType } from '@/types/wallet';
import type { TenantConfig } from '@/types/tenant';

type Phase = 'login-phone' | 'login-otp' | 'register-role' | 'register-details' | 'success';
type UserRole = 'company' | 'professional' | 'individual';

interface LoginRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantConfig?: TenantConfig;
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'company' || value === 'professional' || value === 'individual';
}

function resolveUserRole(data: Record<string, unknown>): UserRole {
  const direct = data.role;
  if (isUserRole(direct)) return direct;
  const legacy = data.userType;
  if (isUserRole(legacy)) return legacy;
  return 'individual';
}

export default function LoginRegisterModal({
  isOpen,
  onClose,
  tenantConfig = coachingTenantConfig,
}: LoginRegisterModalProps) {
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerIdRef = useRef(`recaptcha-container-${Math.random().toString(36).slice(2)}`);
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const professionalLabel = tenantConfig.roles.professional;
  const individualLabel = tenantConfig.roles.individual;

  const [phase, setPhase] = useState<Phase>('login-phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [userNotFound, setUserNotFound] = useState(false);
  const [lastAuthErrorCode, setLastAuthErrorCode] = useState<string>('');
  const [lastAuthErrorMessage, setLastAuthErrorMessage] = useState<string>('');
  const [sendOtpAttempts, setSendOtpAttempts] = useState(0);
  const [debugEvents, setDebugEvents] = useState<string[]>([]);
  const isDebugMode = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const isRecaptchaNullStyle =
        typeof event.filename === 'string' &&
        event.filename.includes('recaptcha__en.js') &&
        typeof event.message === 'string' &&
        event.message.includes("Cannot read properties of null (reading 'style')");
      if (isRecaptchaNullStyle) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', onWindowError, true);
    return () => window.removeEventListener('error', onWindowError, true);
  }, []);

  function logFlow(step: string, details?: Record<string, unknown>) {
    console.info('[TenantAuthModal]', step, details);
  }

  function pushDebug(message: string) {
    if (!isDebugMode) return;
    const stamp = new Date().toISOString().slice(11, 19);
    setDebugEvents((prev) => [`${stamp} ${message}`, ...prev].slice(0, 8));
  }

  function normalizePhone(input: string): string {
    const raw = input.trim();
    const digits = raw.replace(/\D/g, '');

    // Respect explicit international input.
    if (raw.startsWith('+')) {
      return `+${digits}`;
    }

    // Local India formats.
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }

    // Fallback to allow non-India international testing.
    return `+${digits}`;
  }

  function isValidE164(phoneValue: string): boolean {
    return /^\+[1-9]\d{9,14}$/.test(phoneValue);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recaptchaContainerId = recaptchaContainerIdRef.current;
    let container = document.getElementById(recaptchaContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = recaptchaContainerId;
      container.style.display = 'none';
      document.body.appendChild(container);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // Clear verifier when modal closes. Keep the container mounted to avoid reCAPTCHA null-style race conditions.
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch {}
        recaptchaRef.current = null;
      }
    }
    logFlow('modal:open-state-changed', { isOpen, phase });
  }, [isOpen, phase]);

  function getAuthErrorMessage(err: unknown): string {
    const error = err as { code?: string; message?: string };
    const errorMap: Record<string, string> = {
      'auth/invalid-phone-number': 'The phone number is invalid.',
      'auth/missing-phone-number': 'Please enter a phone number.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/invalid-app-credential':
        'Phone verification could not start. Refresh the page, complete reCAPTCHA again, and try once more.',
      'auth/missing-app-credential':
        'Phone verification could not start. Refresh the page, complete reCAPTCHA again, and try once more.',
      'auth/network-request-failed':
        'Network error. If testing locally, ensure you have added the phone number to Firebase test numbers.',
      'auth/invalid-verification-code': 'The OTP code is invalid. Please try again.',
      'auth/code-expired': 'The OTP code has expired. Please request a new one.',
    };
    return errorMap[error.code || ''] || error.message || 'An error occurred. Please try again.';
  }

  async function handleSendOtp() {
    setError('');
    setInfo('');
    setUserNotFound(false);
    setLastAuthErrorCode('');
    setLastAuthErrorMessage('');
    setSendOtpAttempts((prev) => prev + 1);
    const normalized = normalizePhone(phone);
    logFlow('send-otp:start', { phone: normalized });
    pushDebug(`send OTP start for ${normalized}`);

    if (!isValidE164(normalized)) {
      setError('Please enter a valid mobile number.');
      pushDebug('send OTP blocked: invalid E.164 number');
      logFlow('send-otp:invalid-phone');
      return;
    }

    setBusy(true);
    try {
      pushDebug('waiting for initializeRecaptchaConfig');


      // Keep one verifier instance for this modal session to avoid DOM churn noise.
      if (!recaptchaRef.current) {
        const recaptchaContainerId = recaptchaContainerIdRef.current;
        let container = document.getElementById(recaptchaContainerId);
        if (!container) {
          container = document.createElement('div');
          container.id = recaptchaContainerId;
          container.style.display = 'none';
          document.body.appendChild(container);
        }

        recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
        });
        await recaptchaRef.current.render();
      }

      pushDebug('calling signInWithPhoneNumber (Enterprise mode)');
      const result = await signInWithPhoneNumber(auth, normalized, recaptchaRef.current);
      confirmationRef.current = result;
      setPhase('login-otp');
      setInfo('OTP sent to your mobile. Enter the code below.');
      pushDebug('OTP send success');
      logFlow('send-otp:success');
    } catch (err) {
      const authErr = err as { code?: string; message?: string };
      setLastAuthErrorCode(authErr.code || 'unknown');
      setLastAuthErrorMessage(authErr.message || 'unknown');
      pushDebug(`OTP send failed: ${authErr.code || 'unknown'}`);
      logFlow('send-otp:error', { code: authErr.code, message: authErr.message });
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    setInfo('');
    setUserNotFound(false);
    if (!otp.trim()) {
      setError('Please enter the OTP code.');
      return;
    }

    setBusy(true);
    try {
      logFlow('verify-otp:start', { codeLength: otp.length });
      if (!confirmationRef.current) {
        setError('OTP session expired. Please request a new OTP.');
        return;
      }

      const result = await confirmationRef.current.confirm(otp);
      const phoneE164 = result.user.phoneNumber || normalizePhone(phone);

      logFlow('verify-otp:success', { phone: phoneE164 });

      // Check if user exists in Firestore
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('phoneE164', '==', phoneE164),
        where('tenantId', '==', tenantId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // User is authenticated in Firebase Auth but not registered in tenant profile data.
        // Stay on login and offer explicit Register action.
        logFlow('verify-otp:new-user');
        setUserNotFound(true);
        setInfo('User does not exist. Register now to continue.');
      } else {
        // Existing user - redirect to dashboard
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data() as Record<string, unknown>;
        const resolvedRole = resolveUserRole(userData);
        const resolvedName = typeof userData.name === 'string' ? userData.name : 'User';
        const resolvedEmail = typeof userData.email === 'string' ? userData.email : '';
        const resolvedPhone = typeof userData.phoneE164 === 'string' ? userData.phoneE164 : phoneE164;
        logFlow('verify-otp:existing-user', { role: resolvedRole, name: resolvedName });

        if (typeof userData.uid !== 'string' || userData.uid !== result.user.uid) {
          await setDoc(
            doc(db, 'users', userDoc.id),
            {
              uid: result.user.uid,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }

        // Ensure pre-provisioned users (created by assignment flow) have a wallet.
        const resolvedUserId = typeof userData.userId === 'string' ? userData.userId : undefined;
        void ensureWalletExists({
          userId: result.user.uid,
          lookupUserIds: [userDoc.id, resolvedUserId].filter(Boolean) as string[],
          tenantId,
          userType: resolvedRole as WalletUserType,
          userName: resolvedName,
        });

        // Keep session uid aligned with Firebase Auth uid for cross-page auth checks.
        sessionStorage.setItem('cs_uid', result.user.uid);
        sessionStorage.setItem('cs_profile_id', userDoc.id);
        sessionStorage.setItem('cs_role', resolvedRole);
        sessionStorage.setItem('cs_name', resolvedName);
        sessionStorage.setItem('cs_email', resolvedEmail);
        sessionStorage.setItem('cs_phone', resolvedPhone);

        // Redirect to dashboard
        setPhase('success');
        setTimeout(() => {
          window.location.href = `${basePath}/dashboard`;
        }, 500);
      }
    } catch (err) {
      logFlow('verify-otp:error', { message: (err as Error).message });
      setError(getAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setError('');
    setInfo('');

    if (!role) {
      setError('Please select your role.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (role === 'company' && !companyName.trim()) {
      setError('Please enter your company name.');
      return;
    }

    setBusy(true);
    try {
      logFlow('register:start', { role, name });

      // Get the current phone and UID from Firebase Auth
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const phoneE164 = currentUser.phoneNumber || normalizePhone(phone);
      const userId = currentUser.uid;

      // Prepare user data
      const userData: Record<string, unknown> = {
        uid: userId,
        phoneE164,
        name,
        email: trimmedEmail,
        role,
        userType: role,
        tenantId,
        createdAt: new Date().toISOString(),
      };

      if (role === 'company') {
        userData.companyName = companyName;
        userData.position = position;
      }

      // Save to Firestore users collection
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, userData, { merge: true });

      // Auto-create the wallet with the tenant's configured signup bonus.
      try {
        const registrationCoins = await getTenantRegistrationFreeCoins(tenantId);
        await createWalletForUser({
          userId,
          tenantId,
          userType: role as WalletUserType,
          userName: name,
          createdBy: 'system',
          initialCoins: registrationCoins,
          reason: 'Registration bonus',
        });
      } catch {
        // Wallet already exists or creation failed — non-fatal.
      }

      // Check for referral join reward (only on self-registration for Professionals/Individuals, non-fatal if fails)
      if ((role === 'professional' || role === 'individual')) {
        try {
          await processReferralJoinForNewUser({
            userId,
            fullName: name,
            email: trimmedEmail,
            phoneE164,
            tenantId,
            userType: role,
          });
        } catch {
          // Referral processing failed — non-fatal, user registration still succeeds.
        }
      }

      logFlow('register:success', { userId, role });
      setPhase('success');
      setInfo('Registration successful! You are now logged in.');

      // Set session storage
      sessionStorage.setItem('cs_uid', userId);
      sessionStorage.setItem('cs_profile_id', userDocRef.id);
      sessionStorage.setItem('cs_role', role);
      sessionStorage.setItem('cs_name', name);
      sessionStorage.setItem('cs_email', trimmedEmail);
      sessionStorage.setItem('cs_phone', phoneE164);

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = `${basePath}/dashboard`;
      }, 500);
    } catch (err) {
      logFlow('register:error', { message: (err as Error).message });
      setError((err as Error).message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function goBackToLogin() {
    setPhase('login-phone');
    setPhone('');
    setOtp('');
    setRole(null);
    setName('');
    setEmail('');
    setCompanyName('');
    setPosition('');
    setError('');
    setInfo('');
    setUserNotFound(false);
  }

  function handleOfferRegister() {
    logFlow('login:user-not-found-offer-register');
    setPhase('register-role');
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>

        {/* === LOGIN PHONE PHASE === */}
        {phase === 'login-phone' && (
          <div className={styles.content}>
            <h2 className={styles.title}>Sign In</h2>
            <p className={styles.subtitle}>Enter your mobile number to continue.</p>

            <label className={styles.label}>Mobile Number</label>
            <input
              type="tel"
              className={styles.input}
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
            />

            {error && <div className={styles.error}>{error}</div>}
            {info && <div className={styles.info}>{info}</div>}
            {isDebugMode ? (
              <div className={styles.info}>
                Debug:
                <br />
                code: {lastAuthErrorCode || 'none'}
                <br />
                message: {lastAuthErrorMessage || 'none'}
                <br />
                origin: {typeof window !== 'undefined' ? window.location.origin : 'n/a'}
                <br />
                protocol: {typeof window !== 'undefined' ? window.location.protocol : 'n/a'}
                <br />
                host: {typeof window !== 'undefined' ? window.location.host : 'n/a'}
                <br />
                authDomain: {String(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'n/a')}
                <br />
                mode: Enterprise + invisible RecaptchaVerifier
                <br />
                attempts: {sendOtpAttempts}
                {debugEvents.length > 0 ? (
                  <>
                    <br />
                    events: {debugEvents.join(' | ')}
                  </>
                ) : null}
              </div>
            ) : null}

            <button
              className={styles.primaryBtn}
              onClick={handleSendOtp}
              disabled={busy || !phone.trim()}
            >
              {busy ? 'Sending...' : 'Send OTP'}
            </button>


          </div>
        )}

        {/* === LOGIN OTP PHASE === */}
        {phase === 'login-otp' && (
          <div className={styles.content}>
            <h2 className={styles.title}>Verify OTP</h2>
            <p className={styles.subtitle}>Enter the code sent to {phone}</p>

            <label className={styles.label}>One-Time Code</label>
            <input
              type="text"
              className={styles.input}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.slice(0, 6))}
              disabled={busy}
              maxLength={6}
            />

            {error && <div className={styles.error}>{error}</div>}
            {info && <div className={styles.info}>{info}</div>}
            {userNotFound && (
              <div className={styles.warning}>
                User does not exist.{' '}
                <button className={styles.linkBtn} onClick={handleOfferRegister}>
                  Register now
                </button>
              </div>
            )}

            <button
              className={styles.primaryBtn}
              onClick={handleVerifyOtp}
              disabled={busy || otp.length !== 6}
            >
              {busy ? 'Verifying...' : 'Verify'}
            </button>

            <button className={styles.secondaryBtn} onClick={goBackToLogin}>
              Back
            </button>
          </div>
        )}

        {/* === REGISTER ROLE PHASE === */}
        {phase === 'register-role' && (
          <div className={styles.content}>
            <h2 className={styles.title}>Select Your Role</h2>
            <p className={styles.subtitle}>Tell us more about yourself.</p>

            <div className={styles.roleGrid}>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  value="company"
                  checked={role === 'company'}
                  onChange={(e) => setRole(e.target.value as 'company')}
                />
                <span>Company</span>
              </label>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  value="professional"
                  checked={role === 'professional'}
                  onChange={(e) => setRole(e.target.value as 'professional')}
                />
                <span>{professionalLabel}</span>
              </label>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="role"
                  value="individual"
                  checked={role === 'individual'}
                  onChange={(e) => setRole(e.target.value as 'individual')}
                />
                <span>{individualLabel}</span>
              </label>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.primaryBtn}
              onClick={() => setPhase('register-details')}
              disabled={!role}
            >
              Continue
            </button>

            <button className={styles.secondaryBtn} onClick={goBackToLogin}>
              Back to Login
            </button>
          </div>
        )}

        {/* === REGISTER DETAILS PHASE === */}
        {phase === 'register-details' && (
          <div className={styles.content}>
            <h2 className={styles.title}>Complete Your Profile</h2>
            <p className={styles.subtitle}>A few more details and you are ready to go.</p>

            {role === 'company' && (
              <>
                <label className={styles.label}>Company Name</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={busy}
                />
              </>
            )}

            <label className={styles.label}>Your Full Name</label>
            <input
              type="text"
              className={styles.input}
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />

            <label className={styles.label}>Email Address</label>
            <input
              type="email"
              className={styles.input}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />

            {role === 'company' && (
              <>
                <label className={styles.label}>Your Position</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Owner, HR Manager"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={busy}
                />
              </>
            )}

            {error && <div className={styles.error}>{error}</div>}
            {info && <div className={styles.info}>{info}</div>}

            <button
              className={styles.primaryBtn}
              onClick={handleRegister}
              disabled={busy}
            >
              {busy ? 'Registering...' : 'Complete Registration'}
            </button>

            <button className={styles.secondaryBtn} onClick={() => setPhase('register-role')}>
              Back
            </button>
          </div>
        )}

        {/* === SUCCESS PHASE === */}
        {phase === 'success' && (
          <div className={styles.content}>
            <h2 className={styles.title}>Success!</h2>
            <p className={styles.subtitle}>Redirecting to your dashboard...</p>
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}
