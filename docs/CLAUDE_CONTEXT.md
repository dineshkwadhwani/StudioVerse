# CLAUDE_CONTEXT.md — StudioVerse Working Context

This file contains richer working context for Claude Code. It is more detailed than `CLAUDE.md`, and should be used as supporting reference rather than a short always-on prompt.

## Product context

StudioVerse is the parent platform for multiple studio deployments. Each studio shares the same base architecture and app shell, but differs in branding, terminology, and selected behaviors.

### Studios
- Coaching Studio
- Training Studio
- Recruitment Studio

### Core intent
- One codebase.
- Shared modules where possible.
- Config-driven studio differences.
- Tenant-aware routing and data isolation.
- Firebase-backed data and auth.
- Vercel-hosted web app.

## Existing conventions

### Routing
- Next.js App Router is the standard.
- Routes live under `src/app/`.
- Domain and tenant resolution are handled through proxy/tenant routing utilities.
- Avoid inventing alternate route structures unless the docs require it.

### Data access
- Components should not query Firestore directly.
- Firestore reads/writes must go through services.
- Trust-sensitive operations should be implemented in Firebase Functions.

### Config separation
There are two major configuration surfaces:
1. Authenticated app-shell/studio config.
2. Marketing/landing-page content config.

Do not mix them.

## Implementation principles

- Prefer shared code over duplication.
- Use config for labels, branding, copy, and small behavior differences.
- Keep feature implementations reusable across studios.
- Use typed constants instead of magic strings.
- Keep security and isolation boundaries explicit.

## Current working areas from existing Copilot context

The repository has active work across:
- referral / wallet / coin issuance flows
- assignment and recommendation flows
- studio-level landing pages
- assessment and event management
- auth and session handling
- tenant-specific labels and routes
- email sending with Resend

This context file should not try to reproduce every implementation detail. Those details belong in the deeper domain docs and feature docs.

## Email setup baseline

For Coaching Studio:
- Verified sending domain: `coachingstudio.in`
- Sender: `contact@coachingstudio.in`
- Resend is used for outbound transactional email
- GoDaddy mailbox is still used for inbox receiving
- DNS records were added in GoDaddy, not Vercel, for the email setup

## How Claude should use this repo

When changing code:
- keep changes minimal and targeted
- preserve existing multi-tenant behavior
- avoid duplicating logic per studio
- ensure production build safety
- preserve developer ergonomics for future studios

## Recommended add-ons

If this repo grows further, add these files:
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/COACHING_STUDIO.md`
- `docs/TRAINING_STUDIO.md`
- `docs/RECRUITMENT_STUDIO.md`
- `docs/EMAIL_SETUP.md`
- `docs/ROUTING_GUIDE.md`
- `docs/SECURITY_AND_DATA_ACCESS.md`