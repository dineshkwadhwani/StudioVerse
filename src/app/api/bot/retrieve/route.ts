import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { consumeRateLimit } from "@/lib/rate-limit";

type KnowledgeChunk = {
  id?: string;
  source: string;
  epicId?: string;
  epicTitle?: string;
  sectionTitle?: string;
  text: string;
};

// Simple TF-IDF-style keyword scoring for retrieval (no embedding cost)
function scoreChunk(chunk: string, query: string): number {
  const queryTokens = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const chunkLower = chunk.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    const count = (chunkLower.match(new RegExp(token, "g")) ?? []).length;
    score += count;
  }
  return score;
}

function buildSearchText(chunk: KnowledgeChunk): string {
  return [
    chunk.epicId ?? "",
    chunk.epicTitle ?? "",
    chunk.sectionTitle ?? "",
    chunk.text,
  ]
    .filter(Boolean)
    .join("\n");
}

const chunkCacheByTenant = new Map<string, KnowledgeChunk[]>();

function loadChunks(tenantId: string): KnowledgeChunk[] {
  const tenantCache = chunkCacheByTenant.get(tenantId);
  if (tenantCache) {
    return tenantCache;
  }

  try {
    const filePath = join(process.cwd(), "public", "bot-knowledge", `${tenantId}.json`);
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as KnowledgeChunk[];
    chunkCacheByTenant.set(tenantId, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query: string; tenantId: string; topK?: number; sessionId?: string };
    const { query, tenantId, topK = 5, sessionId } = body;

    const rateLimit = consumeRateLimit({
      req,
      routeKey: "bot-retrieve",
      limit: 40,
      windowMs: 60_000,
      sessionHint: sessionId,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Too many retrieve requests. Please retry in ${rateLimit.retryAfterSec}s.` },
        { status: 429, headers: rateLimit.headers }
      );
    }

    if (!query || !tenantId) {
      return NextResponse.json({ chunks: [] }, { headers: rateLimit.headers });
    }

    const chunks = loadChunks(tenantId);
    const scored = chunks
      .map((chunk) => {
        const searchText = buildSearchText(chunk);
        return { ...chunk, score: scoreChunk(searchText, query) };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const context = scored
      .map((c) => {
        const header = [
          c.source,
          c.epicTitle ? `Epic: ${c.epicTitle}` : "",
          c.sectionTitle ? `Section: ${c.sectionTitle}` : "",
        ]
          .filter(Boolean)
          .join(" | ");
        return `[${header}]\n${c.text}`;
      })
      .join("\n\n---\n\n");
    return NextResponse.json({ context }, { headers: rateLimit.headers });
  } catch (err) {
    console.error("Bot retrieve error:", err);
    return NextResponse.json({ context: "" });
  }
}
