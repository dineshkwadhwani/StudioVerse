import { NextRequest } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAtMs: number;
};

type RateLimitStore = Map<string, RateLimitBucket>;

type ConsumeRateLimitArgs = {
  req: NextRequest;
  routeKey: string;
  limit: number;
  windowMs: number;
  sessionHint?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  headers: Record<string, string>;
  retryAfterSec: number;
};

const STORE_KEY = "__studioverse_rate_limit_store__";

function getStore(): RateLimitStore {
  const globalScope = globalThis as unknown as { [STORE_KEY]?: RateLimitStore };
  if (!globalScope[STORE_KEY]) {
    globalScope[STORE_KEY] = new Map<string, RateLimitBucket>();
  }
  return globalScope[STORE_KEY] as RateLimitStore;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.trim() ?? "";
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip")?.trim() ?? "";
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function normalizeSessionHint(value: string | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "anon";
  return normalized.slice(0, 120);
}

function cleanupExpiredBuckets(store: RateLimitStore, nowMs: number): void {
  if (store.size < 1000) return;
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      store.delete(key);
    }
  }
}

export function consumeRateLimit(args: ConsumeRateLimitArgs): RateLimitResult {
  const nowMs = Date.now();
  const store = getStore();
  cleanupExpiredBuckets(store, nowMs);

  const ip = getClientIp(args.req);
  const session = normalizeSessionHint(args.sessionHint);
  const key = `${args.routeKey}:${ip}:${session}`;

  const existing = store.get(key);
  const bucket = !existing || existing.resetAtMs <= nowMs
    ? { count: 0, resetAtMs: nowMs + args.windowMs }
    : existing;

  const nextCount = bucket.count + 1;
  const allowed = nextCount <= args.limit;

  if (allowed) {
    bucket.count = nextCount;
    store.set(key, bucket);
  }

  const remaining = allowed ? Math.max(0, args.limit - bucket.count) : 0;
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1000));

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(args.limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.floor(bucket.resetAtMs / 1000)),
  };

  if (!allowed) {
    headers["Retry-After"] = String(retryAfterSec);
  }

  return {
    allowed,
    headers,
    retryAfterSec,
  };
}
