/**
 * Tenant Branding Token System
 *
 * Centralizes all tenant-driven branding and styling decisions.
 * Pages and components consume tokens from this module instead of
 * hardcoding colors, imagery, or display values.
 */

import { TenantConfig } from "@/types/tenant";

export type BrandingTokens = {
  // Colors
  primaryColor: string;
  primaryColorDark?: string;
  primaryColorLight?: string;

  // Typography
  displayName: string;
  subtitle?: string;

  // Imagery
  logo: string;
  faviconPath?: string;

  // Metadata
  pageTitle: string;
  pageDescription?: string;

  // Legal/Contact
  contactEmail?: string;
  privacyPolicyPath?: string;
  termsOfServicePath?: string;
};

/**
 * Extract branding tokens from tenant configuration.
 * Safe to call on any tenant config; provides sensible defaults.
 */
export function extractBrandingTokens(tenantConfig: TenantConfig): BrandingTokens {
  return {
    primaryColor: tenantConfig.theme.primaryColor,
    logo: tenantConfig.theme.logo,

    displayName: tenantConfig.branding?.appDisplayName ?? tenantConfig.name,
    subtitle: tenantConfig.branding?.appSubtitle,

    pageTitle: tenantConfig.pageMeta?.defaultTitle ?? tenantConfig.name,
    pageDescription: tenantConfig.pageMeta?.defaultDescription,

    contactEmail: tenantConfig.branding?.contactEmail,
    privacyPolicyPath: tenantConfig.legal?.privacyPolicyPath,
    termsOfServicePath: tenantConfig.legal?.termsPath,
    faviconPath: tenantConfig.branding?.faviconPath,
  };
}

/**
 * Generate CSS custom property map from branding tokens.
 * Use in style blocks or CSS-in-JS to drive tenant theming.
 */
export function generateCSSCustomProperties(tokens: BrandingTokens): Record<string, string> {
  return {
    "--tenant-primary-color": tokens.primaryColor,
    "--tenant-primary-color-dark": tokens.primaryColorDark ?? tokens.primaryColor,
    "--tenant-primary-color-light": tokens.primaryColorLight ?? tokens.primaryColor,
    "--tenant-display-name": `"${tokens.displayName}"`,
    "--tenant-logo": `url(${tokens.logo})`,
  };
}

/**
 * Build inline style object from branding tokens.
 * Useful for dynamic style application in React components.
 */
export function buildBrandingStyles(tokens: BrandingTokens): React.CSSProperties {
  return {
    "--tenant-primary-color": tokens.primaryColor,
  } as React.CSSProperties;
}
