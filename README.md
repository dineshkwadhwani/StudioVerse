# StudioVerse

StudioVerse is a multi-tenant platform with three tenant experiences built on one shared codebase:

- Coaching Studio
- Training Studio
- Recruitment Studio

The frontend is Next.js App Router (TypeScript) and the backend foundation is Firebase (Auth, Firestore, Storage, Functions).

## Current Architecture (Implemented)

- Tenant routes are mounted under `src/app/<tenant-id>/`.
- Shared app-shell behavior is reused through `src/modules/app-shell/*` wrappers.
- Tenant configuration is centralized under `src/tenants/*` with resolver support in `src/lib/tenant/*`.
- Host/domain-based entrypoint rewrites are handled by `src/proxy.ts`.
- Firestore access is routed through `src/services/*`.

Examples:

- `/coaching-studio/dashboard`
- `/training-studio/my-activities`
- `/recruitment-studio/tools`

## Local Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Firebase Web Env Variables

Set these in `.env.local` (and corresponding deployment environments):

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Tenant resolution env options:

- `NEXT_PUBLIC_TENANT_ID` (direct tenant id override)
- `NEXT_PUBLIC_STUDIO_TYPE` (`coaching` | `training` | `recruitment`)

## Phone Auth Notes

- Phone auth uses Firebase `RecaptchaVerifier`.
- Localhost is suitable for configured Firebase test numbers.
- Real (non-test) number OTP should be validated on deployed HTTPS domains.
- Authorized domains in Firebase Auth must match the exact host.

## Firebase Notes (StudioVerse)

### Web env variables

Set these in local `.env.local` and Vercel project settings:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Phone auth behavior

- Phone auth uses standard Firebase `RecaptchaVerifier` flow.
- Localhost is suitable for configured Firebase test numbers.
- Real (non-test) numbers should be tested on deployed HTTPS domains (for example Vercel).
- Add the exact deployed hostname to Firebase Auth Authorized domains.

### Superadmin bootstrap

- First superadmin record is auto-seeded on initial login through admin flow.
- Seed logic is implemented in `src/modules/admin/SuperAdminPortal.tsx` using `MASTER_SUPERADMIN_PHONE_E164` from `src/modules/admin/masterData.ts`.
