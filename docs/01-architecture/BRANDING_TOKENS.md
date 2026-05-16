# Tenant Branding Token System

## Overview

The branding token system provides a centralized, tenant-driven approach to theming and styling.

Instead of hardcoding colors, logos, display names, or asset paths in components, consume tokens from tenant configuration at runtime.

## Key Modules

- [src/lib/tenant/branding.ts](../src/lib/tenant/branding.ts) — Core token extraction and CSS custom property generation
- [src/lib/tenant/useBrandingTokens.ts](../src/lib/tenant/useBrandingTokens.ts) — React hook for component access
- [src/lib/tenant/BrandingProvider.tsx](../src/lib/tenant/BrandingProvider.tsx) — Provider that injects CSS custom properties

## Usage Patterns

### In CSS Files

Use CSS custom properties to reference tenant branding:

```css
.header {
  background-color: var(--tenant-primary-color);
  background-image: var(--tenant-logo);
}
```

### In React Components

Use the `useBrandingTokens` hook:

```tsx
import { useBrandingTokens } from "@/lib/tenant/useBrandingTokens";

export function SomeComponent() {
  const branding = useBrandingTokens();
  
  return (
    <div style={{ color: branding.primaryColor }}>
      {branding.displayName}
    </div>
  );
}
```

### In App Shell

Wrap your app with `BrandingProvider` to inject CSS custom properties globally:

```tsx
import { BrandingProvider } from "@/lib/tenant/BrandingProvider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TenantProvider>
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
```

## Token Contract

All branding tokens are defined in the `BrandingTokens` type in [src/lib/tenant/branding.ts](../src/lib/tenant/branding.ts).

Current tokens:

- `primaryColor` — Primary brand color
- `primaryColorDark` / `primaryColorLight` — Color variants
- `displayName` — Tenant display name for UI
- `subtitle` — Tenant subtitle/tagline
- `logo` — Logo asset path
- `faviconPath` — Favicon path (optional)
- `pageTitle` — SEO page title
- `pageDescription` — SEO page description
- `contactEmail` — Tenant contact email
- `privacyPolicyPath` — Privacy policy route
- `termsOfServicePath` — Terms of service route

## Adding New Tokens

1. Add the field to `BrandingTokens` type in `src/lib/tenant/branding.ts`
2. Update `extractBrandingTokens` to pull from tenant config
3. Update tenant configs in `src/tenants/*/config.ts` to provide the value
4. Use in components via hook or CSS custom properties

## Next Steps

- Gradually replace hardcoded styles with tokens
- Create a style guide showing before/after examples
- Add validation to catch missing token definitions
