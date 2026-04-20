import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

type KnowledgeChunk = {
  source: string;
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

let cachedChunks: KnowledgeChunk[] | null = null;

function loadChunks(tenantId: string): KnowledgeChunk[] {
  if (cachedChunks) return cachedChunks;
  try {
    const filePath = join(process.cwd(), "public", "bot-knowledge", `${tenantId}.json`);
    const raw = readFileSync(filePath, "utf-8");
    cachedChunks = JSON.parse(raw) as KnowledgeChunk[];
    return cachedChunks;
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query: string; tenantId: string; topK?: number };
    const { query, tenantId, topK = 5 } = body;

    if (!query || !tenantId) {
      return NextResponse.json({ chunks: [] });
    }

    const chunks = loadChunks(tenantId);
    const scored = chunks
      .map((chunk) => ({ ...chunk, score: scoreChunk(chunk.text, query) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const context = scored.map((c) => `[${c.source}]\n${c.text}`).join("\n\n---\n\n");
    return NextResponse.json({ context });
  } catch (err) {
    console.error("Bot retrieve error:", err);
    return NextResponse.json({ context: "" });
  }
}
