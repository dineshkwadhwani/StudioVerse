# CLAUDE.md — StudioVerse

<!-- markdownlint-disable MD013 -->

This repository powers **StudioVerse**: one shared codebase, multiple studios, tenant-aware routing, shared app-shell, Firebase backend, and Vercel deployment.

## Read this first

Before making code changes, read:

- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/E0.md` through `docs/E12.md`
- `docs/FIREBASE_PROD_ROLLOUT.md`
- `COPILOT_CONTEXT.md` (deeper working context)

## Core project model

- StudioVerse is one repo, one shared app-shell, multiple studio deployments.
- Current studios: Coaching, Training, Recruitment.
- Prefer shared code over duplication.
- Use configuration for studio differences whenever possible.
- Keep landing-page config separate from authenticated app-shell config.

## Architecture rules

- `src/app/` = routes and layouts.
- `src/modules/` = feature modules.
- `src/services/` = all Firestore/data access.
- `src/hooks/` = hooks only.
- `src/tenants/` and `src/config/studio.ts` = authenticated studio config.
- `src/modules/marketing/*/content.config.ts` = landing page content only.
- `functions/` = trusted server-side business logic.
- `src/proxy.ts` and `src/lib/tenant/` handle tenant routing and resolution.

## Non-negotiable rules

- Do not access Firestore directly from React components.
- Keep sensitive logic in Firebase Functions when trust matters.
- Always enforce studio-type and role isolation.
- Never mix landing copy with authenticated app-shell behavior.
- Use typed constants instead of string literals where possible.
- Keep Firebase SDK usage contained in services and backend code.
- Do not leak raw backend errors to the UI.

## Role model

Use these stable internal roles:

- `superadmin`
- `company`
- `professional`
- `individual`

UI labels may vary by studio via config, but internal role identifiers stay stable.

## Environment rules

- Local development uses `.env.local`.
- Never expose secrets in client code.
- Use `NEXT_PUBLIC_*` only for safe public values.
- Keep studio type separate from environment type.

## Build quality

Generated code should be:

- typed
- modular
- config-driven
- service-oriented
- security-aware
- emulator-friendly
- build-safe across all studios

## Current implementation baseline

- Coaching Studio email sending uses Resend with verified domain `coachingstudio.in`.
- GoDaddy mailbox records for `@` must remain intact.
- Resend sending uses subdomain records like `send.coachingstudio.in`.
- For production deploys, `RESEND_API_KEY` must also be set in Vercel environment variables.

## Working style

When implementing something new:

1. Reuse shared code if possible.
2. Put studio variation in config.
3. Keep UI separate from data access.
4. Put trusted logic in Functions.
5. Validate tenant and role boundaries.
6. Preserve type safety and repository conventions.
