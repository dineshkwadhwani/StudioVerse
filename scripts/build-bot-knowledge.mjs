/**
 * Build bot knowledge base from /docs/*.md files.
 * Produces public/bot-knowledge/coaching-studio.json
 * Run: node scripts/build-bot-knowledge.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOCS_DIR = join(ROOT, "docs");
const OUT_DIR = join(ROOT, "public", "bot-knowledge");
const CHUNK_SIZE = 600; // tokens approx (chars / 4)

function chunkText(text, source) {
  // Split on double newlines (paragraphs), then merge into ~600 token chunks
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length / 4 > CHUNK_SIZE && current) {
      chunks.push({ source, text: current.trim() });
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) {
    chunks.push({ source, text: current.trim() });
  }
  return chunks;
}

const mdFiles = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
const allChunks = [];

for (const file of mdFiles) {
  const content = readFileSync(join(DOCS_DIR, file), "utf-8");
  const chunks = chunkText(content, file);
  allChunks.push(...chunks);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "coaching-studio.json"),
  JSON.stringify(allChunks, null, 2),
  "utf-8"
);

console.log(`Built ${allChunks.length} chunks from ${mdFiles.length} files → public/bot-knowledge/coaching-studio.json`);
