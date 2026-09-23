#!/usr/bin/env node
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { generateKit } from "../src/pipeline/index.js";

const args = parseArgs(process.argv.slice(2));

if (!args.input || !args.output) {
  console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
  process.exit(1);
}

const cases = JSON.parse(await readFile(args.input, "utf8"));
if (!Array.isArray(cases)) {
  console.error("Input must be an array of cases");
  process.exit(1);
}

const kits = [];
for (const item of cases) {
  try {
    const kit = await generateKit({
      jd: item.jd,
      company_url: item.company_url,
      days: item.days
    });
    kits.push({ id: item.id, status: "ok", kit, error: null });
  } catch (error) {
    kits.push({
      id: item.id,
      status: "failed",
      kit: null,
      error: {
        code: error.code || "KIT_GENERATION_FAILED",
        message: error.message || "Unable to produce kit."
      }
    });
  }
}

await writeFile(args.output, JSON.stringify({
  version: "1.0",
  generated_at: new Date().toISOString(),
  kits
}, null, 2));

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--input") parsed.input = values[index + 1];
    if (values[index] === "--output") parsed.output = values[index + 1];
  }
  return parsed;
}
