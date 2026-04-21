/**
 * Build bot knowledge base from functional epic docs plus core product context docs.
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
const CHUNK_SIZE_CHARS = 1800;

const EPIC_FILES = Array.from({ length: 12 }, (_, n) => `E${n}.md`);
const CONTEXT_FILES = ["StudioVerse_Executive_Product_Document_v2.md"];
const SOURCE_FILES = new Set([...EPIC_FILES, ...CONTEXT_FILES]);

const SECTION_EXCLUDE_PATTERNS = [
  /^epic\s+e\d+/i,
  /^implementation status snapshot/i,
  /^product requirements document$/i,
  /^document type/i,
  /^version/i,
  /^date/i,
  /^audience$/i,
  /^glossary$/i,
  /^future enhancements?/i,
];

function normalizeWhitespace(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();
}

function cleanChunkText(rawText) {
  let text = rawText;

  // Remove user-story IDs and internal reference IDs.
  text = text.replace(/\bUS-[A-Z]\d+-\d+\b\s*[—:-]?\s*/g, "");

  // Remove explicit section/clause references like Section 12.5, clause 13.2.1.
  text = text.replace(/\b(?:section|clause|sec\.?|subsection)\s+\d+(?:\.\d+)+\b/gi, "");

  // Remove standalone decimal references like (12.5), [13.2].
  text = text.replace(/[\[(]\s*\d+(?:\.\d+)+\s*[\])]/g, "");

  // Remove numbered markdown heading prefixes like "## 12.5 Title".
  text = text.replace(/^(#{1,6}\s*)\d+(?:\.\d+)*\s*[-—:]?\s*/gm, "$1");

  // Remove markdown markers.
  text = text.replace(/^#{1,6}\s*/gm, "");
  text = text.replace(/^[-*+]\s+/gm, "");

  // Drop markdown emphasis markers and inline code ticks for cleaner user-facing content.
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");

  return normalizeWhitespace(text);
}

function extractEpicTitle(content, fallback) {
  const match = content.match(/^##\s*EPIC\s+E\d+\s*[—-]\s*(.+)$/im);
  if (match?.[1]) return match[1].trim();
  return fallback;
}

function extractDocumentTitle(content, fallback) {
  const firstHeading = content.match(/^#\s+(.+)$/m);
  if (firstHeading?.[1]) return firstHeading[1].trim();
  return fallback;
}

function sanitizeSectionTitle(title) {
  if (!title) return "Overview";
  let cleaned = title.trim();

  // Remove user-story IDs from section titles.
  cleaned = cleaned.replace(/^US-[A-Z]\d+-\d+\s*[—:\-]?\s*/i, "");

  // Remove numeric heading prefixes like "12.5" or "1".
  cleaned = cleaned.replace(/^\d+(?:\.\d+)*\s*[—:\-]?\s*/, "");

  // Remove markdown numbering artifacts.
  cleaned = cleaned.replace(/^#+\s*/, "");
  cleaned = cleaned.replace(/^[.\-:]+\s*/, "");

  return cleaned.trim() || "Overview";
}

function shouldIncludeSection(title) {
  if (!title) return false;
  return !SECTION_EXCLUDE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

function splitIntoSections(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentTitle = "Overview";
  let currentLines = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##+\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          sectionTitle: sanitizeSectionTitle(currentTitle),
          text: currentLines.join("\n").trim(),
        });
      }
      currentTitle = sanitizeSectionTitle(headingMatch[1].trim());
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    sections.push({
      sectionTitle: sanitizeSectionTitle(currentTitle),
      text: currentLines.join("\n").trim(),
    });
  }

  return sections.filter((s) => shouldIncludeSection(s.sectionTitle));
}

function chunkSectionText(text) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > CHUNK_SIZE_CHARS && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

const mdFiles = readdirSync(DOCS_DIR)
  .filter((f) => SOURCE_FILES.has(f))
  .sort((a, b) => {
    const aEpic = /^E\d+\.md$/i.test(a);
    const bEpic = /^E\d+\.md$/i.test(b);
    if (aEpic && bEpic) {
      return Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""));
    }
    if (aEpic && !bEpic) return -1;
    if (!aEpic && bEpic) return 1;
    return a.localeCompare(b);
  });

const allChunks = [];

let counter = 1;

for (const file of mdFiles) {
  const content = readFileSync(join(DOCS_DIR, file), "utf-8");
  const epicIdMatch = file.match(/^E(\d+)\.md$/i);
  const epicId = epicIdMatch ? `E${epicIdMatch[1]}` : "EXEC";
  const epicTitle = epicIdMatch
    ? extractEpicTitle(content, file.replace(".md", ""))
    : extractDocumentTitle(content, "StudioVerse Executive Product Document");

  const sections = splitIntoSections(content);
  for (const section of sections) {
    const cleaned = cleanChunkText(section.text);
    if (!cleaned || cleaned.length < 80) continue;

    const chunks = chunkSectionText(cleaned);
    for (const chunkText of chunks) {
      allChunks.push({
        id: `${epicId}-${String(counter).padStart(4, "0")}`,
        source: file,
        epicId,
        epicTitle,
        sectionTitle: section.sectionTitle,
        text: chunkText,
      });
      counter += 1;
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "coaching-studio.json"),
  JSON.stringify(allChunks, null, 2),
  "utf-8"
);

console.log(`Built ${allChunks.length} chunks from ${mdFiles.length} files → public/bot-knowledge/coaching-studio.json`);
