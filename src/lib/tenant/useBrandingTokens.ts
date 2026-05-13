/**
 * useBrandingTokens Hook
 *
 * Provides tenant-driven branding tokens to React components.
 * Replaces hardcoded style values with runtime tenant configuration.
 */

"use client";

import { useTenant } from "./context";
import { extractBrandingTokens, BrandingTokens } from "./branding";

/**
 * Hook to access branding tokens in any component.
 * Must be used within a TenantProvider scope.
 */
export function useBrandingTokens(): BrandingTokens {
  const tenant = useTenant();
  return extractBrandingTokens(tenant);
}
