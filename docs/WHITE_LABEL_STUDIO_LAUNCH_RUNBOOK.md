# StudioVerse White-Label Studio Launch Runbook

## Purpose

Use this runbook to launch one new studio tenant safely and consistently.

This repository is now tenant-config-driven. New studio onboarding should require:

- tenant config
- tenant assets
- tenant notification templates
- tenant route folder
- optional custom domain mapping

No feature code duplication is required.

## Preconditions

- You have final studio branding assets:
  - `logo.png`
  - `bot.png`
  - `coin.png`
  - `hero1.png`, `hero2.png`, `hero3.png`
  - `favicon.ico`
- You have approved role labels and terminology for the studio.
- You have DNS/domain ownership if launching with a custom domain.

## Weekly Launch Checklist

### 1) Create tenant config

1. Copy `src/tenants/coaching-studio/config.ts` to `src/tenants/<new-tenant-id>/config.ts`.
2. Update the following values:
   - `id`
   - `name`
   - `domain`
   - `roles`
   - `labels`
   - `theme` (logo, colors)
   - `branding` (app display, favicon)
   - `landingContent.heroImages`
   - legal links
3. Keep role keys unchanged: `superadmin`, `company`, `professional`, `individual`.

### 2) Add tenant notification templates

1. Copy `src/tenants/coaching-studio/notification-templates.json` to `src/tenants/<new-tenant-id>/notification-templates.json`.
2. Replace all tenant-specific copy with the new studio brand text.

### 3) Register tenant in the tenant registry

1. Edit `src/tenants/index.ts`.
2. Add import for the new config.
3. Add the new config to `TENANT_CONFIGS`.

### 4) Add tenant public assets

1. Create `public/tenants/<new-tenant-id>/`.
2. Add:
   - `logo.png`
   - `bot.png`
   - `coin.png`
   - `hero1.png`, `hero2.png`, `hero3.png`
   - `favicon.ico`
3. Confirm all config asset paths match exactly.

### 5) Create tenant app routes

1. Copy `src/app/coaching-studio/` to `src/app/<new-tenant-id>/`.
2. In copied route files, switch tenant config imports to `src/tenants/<new-tenant-id>/config`.
3. Ensure each route uses shared modules from `src/modules/app-shell` or feature modules.
4. Do not create tenant-specific module duplicates under `src/modules/`.

### 6) Domain routing setup (if custom domain)

1. Add the domain to deployment platform.
2. Ensure host resolution maps to the new tenant via existing tenant resolver logic.
3. Validate direct domain access rewrites to `/<new-tenant-id>` paths.

### 7) Data and admin readiness

1. Create or verify Super Admin tenant records in Firestore if required by admin screens.
2. Verify wallets/treasury initialization behavior for the new tenant.
3. Verify notification toggles and template lookup resolve for the new tenant.

### 8) Validation gates before release

Run:

```bash
npm run build
npx tsc --noEmit
```

Then manually validate:

1. Landing page renders with new brand.
2. Auth page works.
3. Dashboard, programs, tools, events, wallet, and profile pages load.
4. Buy coins/request coins flow uses new tenant branding.
5. Notification emails use new tenant template content.
6. Bot widget uses new tenant bot persona assets.
7. Domain-based routing resolves correctly.

## Fast Smoke Test Matrix

- Unauthenticated:
  - `/<new-tenant-id>`
  - `/<new-tenant-id>/auth`
- Authenticated (company/professional/individual):
  - `/<new-tenant-id>/dashboard`
  - `/<new-tenant-id>/programs`
  - `/<new-tenant-id>/tools`
  - `/<new-tenant-id>/events`
  - `/<new-tenant-id>/manage-wallet`
  - `/<new-tenant-id>/buy-coins`
  - `/<new-tenant-id>/messages`
  - `/<new-tenant-id>/profile`

## Common Pitfalls

- Adding tenant-specific feature code duplication instead of reusing shared modules.
- Forgetting to register tenant in `src/tenants/index.ts`.
- Asset path mismatches between config and `public/tenants/<new-tenant-id>/`.
- Copying routes but leaving old tenant config imports.
- Domain DNS configured but host not mapped to tenant.

## Rollback Plan

If launch fails:

1. Remove tenant from `TENANT_CONFIGS` in `src/tenants/index.ts`.
2. Remove `src/app/<new-tenant-id>/` routes.
3. Remove `src/tenants/<new-tenant-id>/` config/templates.
4. Remove `public/tenants/<new-tenant-id>/` assets.
5. Re-run `npm run build` to confirm repository stability.

## Definition of Done

A new studio is launch-ready when:

- it builds and deploys without code changes outside config/routes/assets
- all tenant pages resolve correctly
- branding/text/notifications are tenant-correct
- domain routing works
- role-based access and wallet flows behave as expected
