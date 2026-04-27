import { NextRequest, NextResponse } from "next/server";
import {
  isSharedTenantPath,
  isTenantRootPath,
  resolveTenantByHost,
} from "@/lib/tenant/routing";

const STATIC_FILE_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  ".ico",
  ".txt",
  ".xml",
  ".map",
  ".json",
  ".woff",
  ".woff2",
];

type StudioRole = "company" | "professional" | "individual" | "superadmin";

const TENANT_IDS = new Set(["coaching-studio", "training-studio", "recruitment-studio"]);

const PROTECTED_ROUTE_RULES: Record<string, StudioRole[]> = {
  dashboard: ["company", "professional", "individual", "superadmin"],
  "manage-users": ["company", "professional", "superadmin"],
  "manage-cohorts": ["company", "professional", "superadmin"],
  "assigned-activities": ["company", "professional", "superadmin"],
  "manage-programs": ["company", "professional", "superadmin"],
  "manage-events": ["company", "professional", "superadmin"],
  "manage-assessments": ["company", "professional", "superadmin"],
  "manage-wallet": ["company", "professional", "individual", "superadmin"],
  "request-coins": ["professional", "superadmin"],
  "buy-coins": ["company", "professional", "individual", "superadmin"],
  "my-activities": ["company", "professional", "individual", "superadmin"],
  "manage-referrals": ["company", "professional", "individual", "superadmin"],
};

function shouldBypass(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return true;
  }

  return STATIC_FILE_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function getEffectivePath(pathname: string, tenantId: string | null): string {
  if (!tenantId) return pathname;
  if (isSharedTenantPath(pathname)) {
    return `/${tenantId}${pathname}`;
  }
  return pathname;
}

function resolveProtectedRoute(pathname: string): { tenantId: string; routeKey: string } | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [tenantId, routeKey] = segments;
  if (!TENANT_IDS.has(tenantId)) return null;
  if (!(routeKey in PROTECTED_ROUTE_RULES)) return null;

  return { tenantId, routeKey };
}

function isStudioRole(value: string | undefined): value is StudioRole {
  return value === "company" || value === "professional" || value === "individual" || value === "superadmin";
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (shouldBypass(pathname) || isTenantRootPath(pathname)) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";
  const tenant = resolveTenantByHost(host);
  const tenantId = tenant?.id ?? null;
  const effectivePath = getEffectivePath(pathname, tenantId);
  const protectedRoute = resolveProtectedRoute(effectivePath);

  if (protectedRoute) {
    const roleCookie = request.cookies.get("cs_role")?.value;
    const role = isStudioRole(roleCookie) ? roleCookie : null;

    if (!role) {
      return redirectTo(request, `/${protectedRoute.tenantId}/auth`);
    }

    const allowedRoles = PROTECTED_ROUTE_RULES[protectedRoute.routeKey];
    if (!allowedRoles.includes(role)) {
      return redirectTo(request, `/${protectedRoute.tenantId}/dashboard`);
    }
  }

  if (!tenant) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${tenant.id}`;
    return NextResponse.rewrite(url);
  }

  if (isSharedTenantPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${tenant.id}${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
