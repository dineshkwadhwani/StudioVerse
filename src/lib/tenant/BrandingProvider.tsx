/**
 * BrandingProvider Component
 *
 * Injects tenant branding CSS custom properties into the DOM.
 * Wrap your app shell with this to enable CSS var-based theming.
 */

"use client";

import React, { useEffect } from "react";
import { useTenant } from "./context";
import { extractBrandingTokens, generateCSSCustomProperties } from "./branding";

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const tenant = useTenant();

  useEffect(() => {
    const tokens = extractBrandingTokens(tenant);
    const customProps = generateCSSCustomProperties(tokens);

    // Apply CSS custom properties to document root
    Object.entries(customProps).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    return () => {
      // Clean up on unmount/change
      Object.keys(customProps).forEach((key) => {
        document.documentElement.style.removeProperty(key);
      });
    };
  }, [tenant]);

  return <>{children}</>;
}
