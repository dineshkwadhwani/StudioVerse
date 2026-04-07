'use client';
import { useState, useRef, useEffect } from 'react';
import { auth, appCheck, getToken } from '@/services/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

type LogLevel = 'info' | 'ok' | 'err' | 'warn';
type LogEntry = { time: string; msg: string; level: LogLevel };

export default function AuthDiagnostic() {
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });

  const addLog = (msg: string, level: LogLevel = 'info') => {
    setLog(p => [...p, { time: ts(), msg, level }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  };

  // ─── Phase 1: Environment check ───────────────────────────────────────────
  useEffect(() => {
    addLog('=== Phase 1: Environment ===');
    addLog(`Origin: ${window.location.origin}`, 'info');
    addLog(`Protocol: ${window.location.protocol}`, window.location.protocol === 'https:' ? 'ok' : 'warn');

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      addLog('Localhost detected: Firebase test numbers should work here.', 'ok');
      addLog('Real phone numbers may fail on localhost. Use hosted HTTPS domain (for example Vercel) for real-number OTP.', 'warn');
    } else if (window.location.protocol === 'https:') {
      addLog('Hosted HTTPS domain detected: suitable for real phone-number OTP testing.', 'ok');
    } else {
      addLog('Non-HTTPS hosted domain detected. Use HTTPS for reliable real-number OTP.', 'warn');
    }

    const cfg = auth.app.options;
    addLog(`apiKey: ${cfg.apiKey ? cfg.apiKey.slice(0, 12) + '...' : 'MISSING'}`, cfg.apiKey ? 'ok' : 'err');
    addLog(`authDomain: ${cfg.authDomain ?? 'MISSING'}`, cfg.authDomain ? 'ok' : 'err');
    addLog(`projectId: ${cfg.projectId ?? 'MISSING'}`, cfg.projectId ? 'ok' : 'err');
    addLog(`appId: ${cfg.appId ? cfg.appId.slice(0, 20) + '...' : 'MISSING'}`, cfg.appId ? 'ok' : 'err');

    const enterpriseKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY;
    addLog(`RECAPTCHA_ENTERPRISE_KEY: ${enterpriseKey ? enterpriseKey.slice(0, 12) + '...' : 'not set — App Check will NOT work'}`, enterpriseKey ? 'ok' : 'err');

    // Test App Check token fetch
    addLog('Testing App Check token fetch...', 'info');
    if (!appCheck) {
      addLog('App Check not initialized — NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_KEY likely missing', 'err');
    } else {
      getToken(appCheck, false)
        .then(tokenResult => addLog(`App Check token OK (${tokenResult.token.slice(0, 20)}...)`, 'ok'))
        .catch((acErr: any) => {
          addLog(`App Check token FAILED: ${acErr?.message ?? acErr}`, 'err');
          addLog('Domain may not be registered on Enterprise key, or key is wrong.', 'warn');
        });
    }

    addLog(`Firebase auth currentUser: ${auth.currentUser?.uid ?? 'none'}`, 'info');
    addLog('=== Environment check complete ===');
  }, []);

  // ─── Phase 2: reCAPTCHA + OTP send ────────────────────────────────────────
  const resetVerifier = () => {
    try { verifierRef.current?.clear(); } catch { }
    verifierRef.current = null;
  };

  const sendOTP = async () => {
    setBusy(true);
    setLog([]);
    addLog('=== Phase 2: Send OTP ===');

    // Phone validation
    if (!phone.startsWith('+')) {
      addLog('ERROR: Phone must start with + and country code', 'err'); setBusy(false); return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      addLog('ERROR: Phone number too short', 'err'); setBusy(false); return;
    }
    addLog(`Phone: ${phone}`, 'ok');

    // reCAPTCHA setup
    addLog('Setting up RecaptchaVerifier (v2 normal — visible checkbox)...', 'info');
    resetVerifier();

    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: (token: string) => {
          addLog(`reCAPTCHA solved — token received (${token.slice(0, 20)}...)`, 'ok');
        },
        'expired-callback': () => {
          addLog('reCAPTCHA token expired — please solve the checkbox again', 'warn');
          resetVerifier();
        },
        'error-callback': (err: any) => {
          addLog(`reCAPTCHA error-callback: ${JSON.stringify(err)}`, 'err');
        },
      });

      verifierRef.current = verifier;
      addLog('RecaptchaVerifier created', 'ok');

      addLog('Rendering reCAPTCHA checkbox — solve it before OTP sends...', 'info');
      const widgetId = await verifier.render();
      addLog(`reCAPTCHA rendered (widgetId: ${widgetId}) — waiting for user to solve`, 'ok');

      addLog(`Calling signInWithPhoneNumber(${phone})...`, 'info');
      const result = await signInWithPhoneNumber(auth, phone, verifier);

      addLog('signInWithPhoneNumber resolved!', 'ok');
      addLog(`verificationId: ${result.verificationId.slice(0, 20)}...`, 'ok');
      addLog('=== OTP sent successfully — check your phone ===', 'ok');

      setConfirmation(result);
      setStep('otp');

    } catch (err: any) {
      addLog(`=== FAILED ===`, 'err');
      addLog(`code: ${err.code}`, 'err');
      addLog(`message: ${err.message}`, 'err');

      // Specific guidance per error code
      if (err.code === 'auth/invalid-app-credential') {
        addLog('DIAGNOSIS: Firebase rejected the reCAPTCHA token.', 'warn');
        addLog('Check 1: Is reCAPTCHA Enterprise enabled in Firebase Auth settings?', 'warn');
        addLog('Check 2: Does your App Check key match what Firebase Auth reCAPTCHA settings shows?', 'warn');
        addLog('Check 3: Is ENABLE_APP_CHECK=true in .env.local?', 'warn');
        addLog('Check 4: Did you restart npm run dev after changing .env.local?', 'warn');
      }
      if (err.code === 'auth/too-many-requests') {
        addLog('DIAGNOSIS: This number/IP is rate limited. Wait 30+ min or use a different number.', 'warn');
      }
      if (err.code === 'auth/captcha-check-failed') {
        addLog('DIAGNOSIS: reCAPTCHA token invalid. Try hard refresh (Ctrl+Shift+R).', 'warn');
      }
      if (err.code === 'auth/missing-phone-number') {
        addLog('DIAGNOSIS: Phone number is empty or malformed.', 'warn');
      }
      if (err.code === 'auth/quota-exceeded') {
        addLog('DIAGNOSIS: SMS quota exceeded on this Firebase project. Check Firebase console usage.', 'warn');
      }
      if (err.code === 'auth/network-request-failed') {
        addLog('DIAGNOSIS: Network error — check your internet connection.', 'warn');
      }

      resetVerifier();
    }
    setBusy(false);
  };

  // ─── Phase 3: OTP verify ──────────────────────────────────────────────────
  const verifyOTP = async () => {
    if (!confirmation) return;
    setBusy(true);
    addLog('=== Phase 3: Verify OTP ===');
    addLog(`Entered OTP: ${otp}`, 'info');

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      addLog('ERROR: OTP must be exactly 6 digits', 'err');
      setBusy(false); return;
    }

    try {
      addLog('Calling confirmation.confirm()...', 'info');
      const result = await confirmation.confirm(otp);
      addLog('=== SUCCESS ===', 'ok');
      addLog(`UID: ${result.user.uid}`, 'ok');
      addLog(`Phone: ${result.user.phoneNumber}`, 'ok');
      addLog(`isNewUser: ${result.operationType}`, 'ok');
    } catch (err: any) {
      addLog(`=== VERIFY FAILED ===`, 'err');
      addLog(`code: ${err.code}`, 'err');
      addLog(`message: ${err.message}`, 'err');
      if (err.code === 'auth/invalid-verification-code') addLog('Wrong OTP — double check the SMS', 'warn');
      if (err.code === 'auth/code-expired') addLog('OTP expired — click Reset and resend', 'warn');
    }
    setBusy(false);
  };

  const reset = () => {
    resetVerifier();
    setStep('phone');
    setConfirmation(null);
    setOtp('');
    setLog([]);
  };

  const colors: Record<LogLevel, string> = {
    info: '#888',
    ok: '#22c55e',
    err: '#ef4444',
    warn: '#f59e0b',
  };

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: 'auto', fontFamily: 'monospace' }}>
      <h2 style={{ fontFamily: 'sans-serif', fontWeight: 500, marginBottom: 4 }}>Firebase Phone Auth — Full Diagnostic</h2>
      <p style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#888', marginBottom: 24 }}>
        All phases logged in real-time. Environment check runs on mount.
      </p>

      <div id="recaptcha-container" />

      {step === 'phone' && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+919999999999"
            disabled={busy}
            style={{ padding: '10px 14px', fontSize: 15, border: '1px solid #ddd', borderRadius: 6, width: 220 }}
          />
          <button
            onClick={sendOTP}
            disabled={busy}
            style={{ padding: '10px 20px', background: busy ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 15 }}
          >
            {busy ? 'Working...' : 'Send OTP'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value)}
            placeholder="6-digit OTP"
            maxLength={6}
            disabled={busy}
            style={{ padding: '10px 14px', fontSize: 15, border: '1px solid #ddd', borderRadius: 6, width: 160 }}
          />
          <button
            onClick={verifyOTP}
            disabled={busy}
            style={{ padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15 }}
          >
            Verify
          </button>
          <button
            onClick={reset}
            style={{ padding: '10px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 15 }}
          >
            Reset
          </button>
        </div>
      )}

      <div
        ref={logRef}
        style={{ background: '#0d0d0d', borderRadius: 8, padding: 16, height: 360, overflowY: 'auto', fontSize: 12, lineHeight: 1.7 }}
      >
        {log.length === 0 && <span style={{ color: '#444' }}>Waiting...</span>}
        {log.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, borderBottom: '1px solid #1a1a1a', padding: '2px 0' }}>
            <span style={{ color: '#444', whiteSpace: 'nowrap', minWidth: 72 }}>{entry.time}</span>
            <span style={{ color: colors[entry.level], wordBreak: 'break-all' }}>{entry.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}