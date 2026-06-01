import type { Metadata } from "next";
import type { TenantConfig } from "@/types/tenant";

function toAbsoluteUrl(domain: string, path: string): string {
  const normalizedDomain = domain.trim().replace(/^https?:\/\//, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${normalizedDomain}${normalizedPath}`;
}

export function buildTenantMetadata(config: TenantConfig): Metadata {
  const title = config.pageMeta?.defaultTitle ?? config.name;
  const description =
    config.pageMeta?.defaultDescription ?? `${config.name} powered by ${config.platform.name}.`;
  const iconPath = config.branding?.faviconPath ?? config.theme.logo;
  const iconUrl = toAbsoluteUrl(config.domain, iconPath);
  const metadataBase = new URL(`https://${config.domain}`);

  return {
    metadataBase,
    title: {
      default: title,
      template: `%s | ${config.name}`,
    },
    description,
    openGraph: {
      title,
      description,
      siteName: config.name,
      type: "website",
      url: metadataBase,
      images: [
        {
          url: iconUrl,
          alt: `${config.name} logo`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [iconUrl],
    },
  };
}