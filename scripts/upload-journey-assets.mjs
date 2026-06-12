#!/usr/bin/env node
// Upload journey map PNGs to Cloudinary under garzoni/journey/<name>.
//
//   node scripts/upload-journey-assets.mjs
//
// Reads CLOUDINARY_URL from env or backend/.env.
// Prints a JSON map of { slug: secure_url } to stdout when done.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(here, "..", "mobile", "assets", "journey");
const FOLDER = "garzoni/journey";

function loadCloudinaryUrl() {
  if (process.env.CLOUDINARY_URL) return process.env.CLOUDINARY_URL;
  const envPath = join(here, "..", "backend", ".env");
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, "utf8")
      .split("\n")
      .find((l) => l.startsWith("CLOUDINARY_URL="));
    if (line) return line.slice("CLOUDINARY_URL=".length).trim();
  }
  throw new Error("CLOUDINARY_URL not set and not found in backend/.env");
}

async function uploadFile(file, apiKey, apiSecret, cloudName) {
  const slug = basename(file, extname(file));
  const publicId = `${FOLDER}/${slug}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");

  const bytes = await readFile(file);
  const form = new FormData();
  form.append("file", new Blob([bytes]), basename(file));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  process.stderr.write(`  uploading ${slug} ...`);
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(`upload failed for ${slug} (${res.status}): ${JSON.stringify(data)}`);
  }
  process.stderr.write(` OK\n`);
  return { slug, url: data.secure_url };
}

async function main() {
  const m = loadCloudinaryUrl().match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error("malformed CLOUDINARY_URL");
  const [, apiKey, apiSecret, cloudName] = m;

  const files = (await readdir(ASSETS_DIR))
    .filter((f) => f.endsWith(".png"))
    .map((f) => join(ASSETS_DIR, f));

  process.stderr.write(`Uploading ${files.length} journey PNGs to ${cloudName}/${FOLDER}/\n`);

  const results = {};
  for (const file of files) {
    const { slug, url } = await uploadFile(file, apiKey, apiSecret, cloudName);
    results[slug] = url;
  }

  console.log(JSON.stringify(results, null, 2));
  process.stderr.write(`Done.\n`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
