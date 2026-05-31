#!/usr/bin/env node
// One-off: upload the marketing demo clip to Cloudinary as a signed upload.
//
//   node scripts/upload-demo-video.mjs <path-to-video>
//
// Reads CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>) from the
// environment, or falls back to backend/.env. Uploads to public_id
// `garzoni/welcome/garzoni-demo` (overwriting) and prints the secure delivery URL.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const PUBLIC_ID = "garzoni/welcome/garzoni-demo";

function loadCloudinaryUrl() {
  if (process.env.CLOUDINARY_URL) return process.env.CLOUDINARY_URL;
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", "backend", ".env");
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, "utf8")
      .split("\n")
      .find((l) => l.startsWith("CLOUDINARY_URL="));
    if (line) return line.slice("CLOUDINARY_URL=".length).trim();
  }
  throw new Error("CLOUDINARY_URL not set and not found in backend/.env");
}

async function main() {
  const file = process.argv[2];
  if (!file)
    throw new Error("usage: node scripts/upload-demo-video.mjs <video>");

  const m = loadCloudinaryUrl().match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error("malformed CLOUDINARY_URL");
  const [, apiKey, apiSecret, cloudName] = m;

  const timestamp = Math.floor(Date.now() / 1000);
  // Signed params, sorted alphabetically, joined with &, secret appended, sha1.
  const toSign = `overwrite=true&public_id=${PUBLIC_ID}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");

  const bytes = await readFile(file);
  const form = new FormData();
  form.append("file", new Blob([bytes]), basename(file));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", PUBLIC_ID);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  process.stderr.write(`Uploading ${file} -> ${cloudName}/${PUBLIC_ID} ...\n`);
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(`upload failed (${res.status}): ${JSON.stringify(data)}`);
  }
  process.stderr.write(
    `OK  duration=${data.duration}s  ${data.width}x${data.height}\n`,
  );
  console.log(data.secure_url);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
