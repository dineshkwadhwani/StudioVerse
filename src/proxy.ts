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

function shouldBypass(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return true;
  }

  return STATIC_FILE_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (shouldBypass(pathname) || isTenantRootPath(pathname)) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";
  const tenant = resolveTenantByHost(host);

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
