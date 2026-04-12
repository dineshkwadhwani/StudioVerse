# StudioVerse Architecture Overview

Status: Working architecture map for local development and Copilot context.  
Canonical source: Technical Stories Master and local docs derived from it.

## Purpose

This document explains how the StudioVerse platform is structured at a high level.

StudioVerse is designed as:
- one repository
- one shared codebase
- three Studio deployments
- one shared authenticated app shell
- separate Studio-specific landing page experiences
- Firebase as the backend platform
- Vercel as the primary frontend deployment platform[file:181]

## Core model

StudioVerse supports three Studio deployments:
- Coaching Studio
- Training Studio
- Recruitment Studio

The platform should reuse as much code as possible and express Studio-specific differences through configuration, labels, content config, and deployment environment values rather than code duplication.[file:181]

## Deployment shape

The same repository powers three separate Vercel projects, one for each Studio deployment:
- `studioverse-coaching`
- `studioverse-training`
- `studioverse-recruitment`

The broader environment model also includes three Firebase projects:
- `studioverse-dev`
- `studioverse-staging`
- `studioverse-prod`

This means Studio type and environment are different concerns:
- Studio type = coaching / training / recruitment
- environment = dev / staging / prod[file:181]

## Runtime principles

StudioVerse uses a shared authenticated app shell for logged-in product functionality.

At the same time, each Studio has its own public landing page directory under `src/app/`, and domain rewrites map each Studio domain to its internal landing route while preserving a clean `/` URL for visitors.[file:181]

## Studio boundaries

Two separate configuration systems should exist:

1. **App-shell Studio config**
   - drives terminology
   - role labels
   - feature flags
   - branding tokens
   - Studio-aware runtime behavior

2. **Landing-page content config**
   - drives marketing copy
   - SEO content
   - counters
   - benefit cards
   - CTA copy
   - public page sections

These two config layers must stay separate so app behavior and marketing content do not become mixed together.[file:181]

## Repository architecture

The technical architecture expects a monorepo-style structure centered around `src/` for frontend application code and `functions/` for Firebase backend code.

Important structural areas:
- `src/app/` for Next.js App Router pages
- `src/modules/` for feature modules and shared UI structure
- `src/tenants/` for tenant runtime config and per-tenant metadata
- `src/config/studio.ts` for resolved active studio config
- `src/services/` for all Firestore access
- `src/hooks/` and `src/store/` for shared app state
- `src/lib/tenant/` for tenant resolution and host/path routing helpers
- `src/proxy.ts` for host-based rewrite logic
- `functions/` for trusted backend logic[file:181]

## Frontend model

The frontend is built with Next.js App Router and TypeScript.

Key frontend rules:
- all code lives under `src/`
- studio routes currently live under tenant-prefixed paths in `src/app/<tenant-id>/`
- tenant-prefixed paths include both landing and authenticated app-shell pages
- shared components follow a module pattern
- components do not call Firestore directly
- all data access goes through the service layer[file:181]

## Backend model

Firebase provides the backend foundation for the platform.

Core Firebase services in scope:
- Firestore as the primary structured database
- Firebase Authentication for identity
- Firebase Storage for files and media
- Firebase Functions Gen 2 for trusted business logic
- Firebase Emulator Suite for local development

Functions are expected to be modular, typed, deployable, and responsible for sensitive or trusted backend operations.[file:181]

## Security model

Security is built as a first-class architecture concern, not an afterthought.

The platform uses:
- authenticated access at the backend layer
- role-aware access control
- `studioType` data isolation
- `professionalId` scoping for individual-level ownership
- route protection in the app shell
- Firestore rules for all collections
- Functions-side validation and audit logging[file:181]

## Role model

The RBAC model uses four stable internal roles:
- `superadmin`
- `company`
- `professional`
- `individual`

These roles stay stable in code and Firestore, while user-facing labels can vary by Studio through configuration. A user may also hold multiple roles, and permissions are additive except where superadmin overrides apply.[file:181]

## Data model direction

The backend architecture already assumes a 25-collection Firestore model.

Core examples include:
- `users`
- `userContexts`
- `companies`
- `cohorts`
- `programs`
- `tools`
- `assignments`
- `reports`
- `notifications`
- `auditLogs`
- `studioConfig`
- `payments`

This collection model supports identity, RBAC, content, delivery, reporting, auditability, and future monetisation paths.[file:181]

## Environment model

Environment isolation is mandatory.

The project separates:
- local development and feature work in `studioverse-dev`
- QA and stakeholder review in `studioverse-staging`
- live traffic in `studioverse-prod`

The app should always connect to the correct Firebase project for the active environment, and data must not bleed across environments.[file:181]

## Local development model

Local development should rely on documented setup conventions and the Firebase Emulator Suite.

The project expects:
- reproducible local setup from README
- `.env.example` as the environment template
- `NEXT_PUBLIC_STUDIO_TYPE` for local app-shell Studio switching
- emulator-based local backend work
- linting, type-checking, and clean builds as baseline engineering expectations[file:181]

## Routing model

Routing follows the Next.js App Router structure.

Important route rules:
- tenant entrypoints are `/coaching-studio`, `/training-studio`, and `/recruitment-studio`
- shared app-shell pages are exposed under each tenant prefix (for example `/training-studio/dashboard`)
- root (`/`) and shared tenant paths are resolved via host-based rewrites in `src/proxy.ts`
- typed route constants should be used instead of magic strings[file:181]

## Service and logic boundaries

StudioVerse deliberately separates UI, services, and backend logic.

Working boundary rules:
- components render UI
- hooks coordinate client behavior
- services perform Firestore access
- Functions handle trusted backend workflows
- shared config controls Studio-specific variation
- security rules enforce data access independently of client behavior[file:181]

## Technical epic map

The technical foundation is organized like this:

- `T0` — project setup, tooling, env conventions, README, branch strategy
- `T1` — Firebase backend setup, rules baseline, emulators, Functions, collections, logging
- `T2` — frontend architecture, folders, routes, stores, services, utilities, forms
- `T3` — deployment and DevOps, Vercel projects, env vars, CI/CD, rollback
- `T4` — security and access control, RBAC, guards, full Firestore rules, audit logs, PII handling
- `T5` — Studio config architecture, terminology, branding, feature flags, config-driven differences[file:181]

## Current status

The technical status currently stands as:
- `T0` done
- `T1` in progress
- `T2` in progress
- `T3` in progress
- `T4` in progress
- `T5` in progress

Implementation has moved beyond initial scaffolding: tenant-prefixed routing, domain-aware rewrites, shared app-shell wrappers, and assessment runtime/report flows are present in code and actively evolving.[file:181]

## Local docs map

The local docs set should be read roughly in this order:
- `docs/E0.md`
- `docs/E1.md`
- `docs/T0.md`
- `docs/T1.md`
- `docs/T2.md`
- `docs/T3.md`
- `docs/T4.md`
- `docs/T5.md`

This overview exists to connect those docs into one mental model instead of treating them as isolated files.[file:181]

## Practical rule for contributors

When adding code to StudioVerse, default to these choices:
- shared code first
- config over branching
- service layer over direct Firestore access
- Functions for trusted logic
- rules and guards for security
- environment isolation by default
- typed constants over string literals
- modular structure over ad hoc files[file:181]

## Use this document

Use this file as the first-stop summary when:
- onboarding a developer
- prompting Copilot
- reviewing architecture decisions
- deciding where new code belongs
- checking whether a change belongs in config, services, frontend modules, or Functions

For implementation detail, the source of truth should then move to the relevant local epic doc.[file:181]