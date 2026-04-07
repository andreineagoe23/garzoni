#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = [
  path.join(ROOT, "frontend", "src", "assets"),
  path.join(ROOT, "mobile", "assets"),
  path.join(ROOT, "backend", "media"),
];
const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
]);

/** Replaced by Font Awesome (Navbar); do not upload legacy duplicates */
const SKIP_BASENAMES = new Set(["burger_menu.svg", "burgermenu.svg"]);

/** Basename → public_id for shared `@garzoni/core` `Images` (see packages/core/src/images.ts). */
const MARKETING_PUBLIC_IDS = {
  "login-bg.jpg": "garzoni/login-bg",
  "register-bg.jpg": "garzoni/register-bg",
  "basicfinance.png": "garzoni/basicfinance",
  "crypto.png": "garzoni/crypto",
  "forex.png": "garzoni/forex",
  "mindset.png": "garzoni/mindset",
  "personalfinance.png": "garzoni/personalfinance",
  "realestate.png": "garzoni/realestate",
  "mobile-1.png": "garzoni/mobile-1",
  "mobile-2.png": "garzoni/mobile-2",
  "mobile-3.png": "garzoni/mobile-3",
  "garzoni-logo.svg": "garzoni/logo/garzoni-logo",
  "garzoni-black.svg": "garzoni/logo/garzoni-black",
  "garzoni-logo-rectangle-no-bg.png": "garzoni/logo/garzoni-logo-rectangle-no-bg",
  "garzoni-logo-square-no-bg.png": "garzoni/logo/garzoni-logo-square-no-bg",
  "garzoni-logo-white-bg.png": "garzoni/logo/garzoni-logo-white-bg",
};

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_BASENAMES.has(entry.name)) continue;
    if (ALLOWED_EXT.has(ext)) out.push(full);
  }
  return out;
}

function toCloudinaryFolder(filePath) {
  const rel = path.relative(ROOT, path.dirname(filePath)).replace(/\\/g, "/");
  return `garzoni/${rel}`;
}

async function main() {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let apiKey = process.env.CLOUDINARY_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;

  if ((!cloudName || !apiKey || !apiSecret) && process.env.CLOUDINARY_URL) {
    try {
      const parsed = new URL(process.env.CLOUDINARY_URL);
      if (parsed.protocol === "cloudinary:") {
        cloudName = cloudName || parsed.hostname;
        apiKey = apiKey || decodeURIComponent(parsed.username || "");
        apiSecret = apiSecret || decodeURIComponent(parsed.password || "");
      }
    } catch (_err) {
      // ignore invalid CLOUDINARY_URL
    }
  }

  if (!cloudName || !apiKey || !apiSecret) {
    console.error(
      "Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  const files = TARGET_DIRS.flatMap((dir) => walkFiles(dir));
  if (!files.length) {
    console.log("No images found in target folders.");
    return;
  }

  console.log(`Uploading ${files.length} files...`);
  const results = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const base = path.basename(file);
    const mappedId = MARKETING_PUBLIC_IDS[base];
    try {
      const uploaded = await cloudinary.uploader.upload(
        file,
        mappedId
          ? {
              public_id: mappedId,
              resource_type: "auto",
              overwrite: true,
            }
          : {
              folder: toCloudinaryFolder(file),
              resource_type: "auto",
              overwrite: true,
            }
      );
      results.push({ file: rel, secure_url: uploaded.secure_url });
      console.log(`OK  ${rel}`);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.error(`ERR ${rel}: ${message}`);
    }
  }

  const outPath = path.join(ROOT, "scripts", "cloudinary-upload-results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved upload map: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
