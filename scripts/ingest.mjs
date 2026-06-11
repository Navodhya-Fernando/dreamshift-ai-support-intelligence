import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const KB_DIR = path.join(ROOT, "kb");

const WORKER_URL = (process.env.WORKER_URL || "").trim().replace(/\/+$/, "");
const INGEST_KEY = (process.env.INGEST_KEY || "").trim();

const endpoint = `${WORKER_URL}/ingest`;

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 60_000;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!WORKER_URL) {
  fail(`❌ Missing WORKER_URL.

Add it to .env:

WORKER_URL="https://dreamshift-bot.dreamshift-kb.workers.dev"
`);
}

if (!INGEST_KEY) {
  fail(`❌ Missing INGEST_KEY.

Add it to .env:

INGEST_KEY="your-private-ingest-key"
`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readKbFiles() {
  try {
    const entries = await fs.readdir(KB_DIR, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((file) => file.toLowerCase().endsWith(".md"))
      .sort();
  } catch (error) {
    fail(`❌ Could not read KB directory: ${KB_DIR}\n${error.message}`);
  }
}

async function postJson(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-key": INGEST_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await res.text();

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { raw };
    }

    if (!res.ok) {
      throw new Error(
        `HTTP ${res.status} ${res.statusText}: ${
          typeof parsed === "object" ? JSON.stringify(parsed) : raw
        }`
      );
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadOne(file) {
  const fullPath = path.join(KB_DIR, file);
  const text = await fs.readFile(fullPath, "utf-8");

  if (!text.trim()) {
    throw new Error("File is empty");
  }

  const payload = {
    file,
    text,
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await postJson(endpoint, payload);
    } catch (error) {
      lastError = error;

      if (attempt <= MAX_RETRIES) {
        console.log(`retrying attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        await sleep(1500 * attempt);
      }
    }
  }

  throw lastError;
}

async function run() {
  const files = await readKbFiles();

  if (!files.length) {
    console.warn(`ℹ️ No .md files found in ${KB_DIR}`);
    return;
  }

  console.log(`🚀 Ingesting ${files.length} file(s) to ${endpoint}`);

  const results = {
    ok: [],
    failed: [],
  };

  for (const file of files) {
    process.stdout.write(`📤 ${file} ... `);

    try {
      const output = await uploadOne(file);
      results.ok.push({ file, output });
      console.log("ok", output);
    } catch (error) {
      results.failed.push({ file, error: error.message });
      console.log("failed");
      console.error(`   ❌ ${error.message}`);
    }
  }

  console.log("\n──────── Ingestion Summary ────────");
  console.log(`✅ Successful: ${results.ok.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.failed.length) {
    console.log("\nFailed files:");
    for (const item of results.failed) {
      console.log(`- ${item.file}: ${item.error}`);
    }

    console.log(`
⚠️ Ingestion finished with failures.

Most likely cause in your current case:
The Worker is still creating Vectorize IDs that are too long.

Patch src/index.js too:
Replace:
const id = \`\${file}:\${i}:\${crypto.randomUUID()}\`;

With a shorter ID generator.
`);

    process.exitCode = 1;
    return;
  }

  console.log("\n✅ Ingestion complete.");
}

run().catch((error) => {
  console.error("❌ Fatal:", error);
  process.exit(1);
});