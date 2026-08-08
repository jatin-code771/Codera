/**
 * seed-from-github.js
 *
 * Downloads the open-source problem dataset from GitHub and inserts
 * problems into Codera's PostgreSQL database via Prisma.
 *
 * Usage:
 *   node seed-from-github.js            → inserts first 50 problems
 *   node seed-from-github.js 100        → inserts first 100 problems
 *   node seed-from-github.js all        → inserts every problem in the file
 *
 * Requirements:
 *   - An ADMIN user must already exist (run make-admin.js first)
 *   - DATABASE_URL must be set in backend/.env
 */

import { PrismaClient } from "./src/generated/prisma/index.js";
import dotenv from "dotenv";
import { createWriteStream, unlinkSync, existsSync, readFileSync } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip } from "zlib";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────

const DATASET_URL =
  "https://raw.githubusercontent.com/utkarshX-dev/leetcode-scraper-dataset/main/problems_cleaned.json";

const SUPPORTED_LANG_SLUGS = ["python3", "javascript", "java", "typescript"];

// Map dataset langSlug → your Prisma codeSnippet key
const LANG_SLUG_MAP = {
  python3: "PYTHON",
  javascript: "JAVASCRIPT",
  java: "JAVA",
  typescript: "TYPESCRIPT",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map dataset difficulty string → Prisma Difficulty enum
 */
function mapDifficulty(d) {
  const map = { Easy: "EASY", Medium: "MEDIUM", Hard: "HARD" };
  return map[d] ?? "EASY";
}

/**
 * Extract plain text constraints from the HTML content field.
 * The dataset stores the full problem description as HTML.
 * We look for a <p> that starts with a digit constraint pattern.
 */
function extractConstraints(htmlContent) {
  if (!htmlContent) return "See problem description.";

  // Pull everything inside a <ul> that looks like constraints
  const constraintsMatch = htmlContent.match(
    /<strong[^>]*>Constraints?:?<\/strong>([\s\S]*?)(?=<strong|$)/i
  );
  if (constraintsMatch) {
    // Strip HTML tags
    return constraintsMatch[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&le;/g, "<=")
      .replace(/&ge;/g, ">=")
      .trim();
  }
  return "See problem description.";
}

/**
 * Extract examples from the HTML content field.
 * Returns an array of { input, output, explanation? } objects.
 */
function extractExamples(htmlContent) {
  if (!htmlContent) return [];

  const examples = [];
  const exampleRegex =
    /<strong[^>]*>Input:<\/strong>([\s\S]*?)<strong[^>]*>Output:<\/strong>([\s\S]*?)(?=<strong[^>]*>(?:Input|Constraints|Follow-up)|$)/gi;

  let match;
  while ((match = exampleRegex.exec(htmlContent)) !== null) {
    const input = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    const outputBlock = match[2];
    const explanationMatch = outputBlock.match(
      /<strong[^>]*>Explanation:<\/strong>([\s\S]*?)(?=<\/pre>|$)/i
    );
    const output = outputBlock
      .replace(/<strong[^>]*>Explanation:[\s\S]*$/i, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    const explanation = explanationMatch
      ? explanationMatch[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : undefined;

    if (input && output) {
      examples.push({ input, output, ...(explanation ? { explanation } : {}) });
    }
  }

  return examples.length > 0
    ? examples
    : [{ input: "See problem description.", output: "See problem description." }];
}

/**
 * Strip HTML tags and decode common entities from the content field
 * to produce a clean markdown-style description.
 */
function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, code) => "\n```\n" + code.replace(/<[^>]+>/g, "").trim() + "\n```\n")
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "_$1_")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<li>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&le;/g, "<=")
    .replace(/&ge;/g, ">=")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build codeSnippet object (only the 4 languages your sandbox supports).
 */
function buildCodeSnippets(snippets) {
  const result = {};
  for (const s of snippets ?? []) {
    const key = LANG_SLUG_MAP[s.langSlug?.toLowerCase()];
    if (key) result[key] = s.code;
  }
  return result;
}

/**
 * Build testCases array in the format your schema expects:
 *   [{ input: "...", output: "..." }, ...]
 *
 * The dataset testCases field is an array of raw stdin strings.
 * We pair every two lines as separate inputs (LeetCode style).
 */
function buildTestCases(rawTestCases) {
  if (!rawTestCases || rawTestCases.length === 0) return null;

  // rawTestCases is already an array of stdin strings like "[2,7,11,15]\n9"
  return rawTestCases.map((tc) => ({
    input: tc,
    output: "", // Raw dataset has no expected output — see NOTE below
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI argument
  const arg = process.argv[2] ?? "50";
  const limit = arg === "all" ? Infinity : parseInt(arg, 10);

  if (isNaN(limit) || limit <= 0) {
    console.error("Usage: node seed-from-github.js [number|all]");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Codera — Problem Seeder");
  console.log("=".repeat(60));

  // 1. Find admin user
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) {
    console.error("\n✗ No ADMIN user found. Run make-admin.js first.");
    process.exit(1);
  }
  console.log(`\n✓ Admin user found: ${adminUser.email}`);

  // 2. Download dataset
  console.log(`\n⬇  Downloading dataset from GitHub...`);
  console.log(`   ${DATASET_URL}`);

  let problems;
  try {
    const res = await fetch(DATASET_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const parsed = JSON.parse(raw);
    // The file has a { metadata, problems } wrapper OR is a plain array
    problems = Array.isArray(parsed) ? parsed : (parsed.problems ?? []);
  } catch (err) {
    console.error(`\n✗ Failed to download dataset: ${err.message}`);
    console.error(
      "  If the file is too large, download it manually and place it at:"
    );
    console.error("  backend/data/problems_cleaned.json");
    console.error("  Then re-run this script — it will use the local copy.");
    process.exit(1);
  }

  console.log(`✓ Loaded ${problems.length} problems from dataset`);

  // 3. Slice to limit
  const toInsert = problems.slice(0, limit === Infinity ? undefined : limit);
  console.log(`\n→ Inserting up to ${toInsert.length} problems...\n`);

  let inserted = 0;
  let skipped = 0;
  let duplicate = 0;

  for (const p of toInsert) {
    // Skip problems with no code snippets for our supported languages
    const codeSnippets = buildCodeSnippets(p.codeSnippets);
    if (Object.keys(codeSnippets).length === 0) {
      skipped++;
      continue;
    }

    // Build test cases — skip if completely empty
    const testCases = buildTestCases(p.testCases);
    if (!testCases || testCases.length === 0) {
      skipped++;
      continue;
    }

    // Check for duplicate by title (idempotent seeding)
    const existing = await prisma.problem.findFirst({
      where: { title: p.title },
      select: { id: true },
    });
    if (existing) {
      duplicate++;
      continue;
    }

    const description = htmlToText(p.content);
    const examples = extractExamples(p.content ?? "");
    const constraints = extractConstraints(p.content ?? "");
    const hints =
      Array.isArray(p.hints) && p.hints.length > 0
        ? p.hints.join("\n")
        : null;
    const tags = Array.isArray(p.topicTags) ? p.topicTags : [];

    try {
      await prisma.problem.create({
        data: {
          title: p.title,
          description,
          difficulty: mapDifficulty(p.difficulty),
          tags,
          userId: adminUser.id,
          examples,
          constraints,
          hints,
          editorial: null, // Dataset has no editorial
          testCases,
          codeSnippet: codeSnippets,
          referenceSolution: {}, // No reference solution in this dataset
        },
      });
      inserted++;
      process.stdout.write(`  ✓ [${inserted}] ${p.title}\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${p.title} — ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Done!");
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${skipped}  (no supported code snippets / test cases)`);
  console.log(`  Duplicate: ${duplicate}  (already in DB)`);
  console.log("=".repeat(60));

  // ── IMPORTANT NOTE ──────────────────────────────────────────────────────────
  //
  // The dataset testCases field contains only the *input* (stdin).
  // Expected outputs are NOT included in the scraped data.
  //
  // This means:
  //   • Problems display correctly in your app
  //   • Users can browse and submit code
  //   • BUT automatic test-case comparison (pass/fail) will not work
  //     because output is stored as an empty string ""
  //
  // To fix this you have two options:
  //   A) Manually add expected outputs to the testCases JSON for each problem
  //   B) Write a script that runs a reference solution through your Sandbox
  //      API to generate the expected output, then updates the DB record
  //
  // For a portfolio/demo project, option A for the first 10–20 problems is
  // the most practical starting point.
  // ────────────────────────────────────────────────────────────────────────────

  console.log("\n⚠  IMPORTANT: testCases are imported WITHOUT expected outputs.");
  console.log("   See the comment at the bottom of this script for next steps.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
