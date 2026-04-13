#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Upload local images to Cloudinary under a single `garzoni/` tree (no `monevo/`, no
 * `garzoni/backend/media/...` duplicates). Same logical asset = one public_id (deduped).
 *
 * Usage:
 *   CLOUDINARY_URL=... node scripts/upload-cloudinary-images.js
 *   node scripts/upload-cloudinary-images.js --dry-run
 *
 * After upload, optional DB remap: backend migrate_cloudinary_images (uses cloudinary-upload-results.json).
 *
 * Mascots: place PNGs under backend/media/mascots/ (e.g. garzoni-owl.png). They upload as
 * garzoni/mascots/garzoni-owl — used by @garzoni/core mascotImageUrl when VITE_CLOUDINARY_CLOUD_NAME
 * / EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME is set on web / mobile builds.
 */
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const ROOT = path.resolve(__dirname, "..");
/** Backend first so duplicate basenames prefer repo media (matches Django paths / migrate_cloudinary_images). */
const TARGET_DIRS = [
  path.join(ROOT, "backend", "media"),
  path.join(ROOT, "frontend", "src", "assets"),
  path.join(ROOT, "mobile", "assets"),
];

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

/** Replaced by Font Awesome (Navbar); do not upload legacy duplicates */
const SKIP_BASENAMES = new Set(["burger_menu.svg", "burgermenu.svg"]);

/**
 * Basename → canonical public_id (shared with @garzoni/core `Images` and web metadata).
 * When the same basename exists in multiple folders, this wins over path-based ids.
 */
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
  "garzoni-logo.png": "garzoni/logo/garzoni-logo-png",
  "garzoni-logo-rectangle-no-bg.png":
    "garzoni/logo/garzoni-logo-rectangle-no-bg",
  "garzoni-logo-square-no-bg.png": "garzoni/logo/garzoni-logo-square-no-bg",
  "garzoni-logo-white-bg.png": "garzoni/logo/garzoni-logo-white-bg",
  "garzoni-logo-white.png": "garzoni/logo/garzoni-logo-white",
  "garzoni-logo-black-rectangular.png":
    "garzoni/logo/garzoni-logo-black-rectangular",
  "garzoni-logo-white-rectangular.png":
    "garzoni/logo/garzoni-logo-white-rectangular",
};

/** Lower number = wins when two files map to the same public_id */
function sourcePriority(relPosix) {
  if (relPosix.startsWith("backend/media/")) return 0;
  if (relPosix.startsWith("frontend/")) return 1;
  if (relPosix.startsWith("mobile/")) return 2;
  return 3;
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    // Frontend logo source files are legacy artifacts and can look stale after rebrand.
    // Canonical logos come from backend/media/logo/*.
    if (rel.startsWith("frontend/src/assets/logo/")) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_BASENAMES.has(entry.name)) continue;
    if (ALLOWED_EXT.has(ext)) out.push(full);
  }
  return out;
}

function stripExtension(relPath) {
  const d = path.dirname(relPath);
  const base = path.basename(relPath, path.extname(relPath));
  return d === "." ? base : `${d}/${base}`.replace(/\\/g, "/");
}

/**
 * Canonical Cloudinary public_id (no leading slash, use slashes for folders).
 */
function resolvePublicId(absFilePath) {
  const rel = path.relative(ROOT, absFilePath).replace(/\\/g, "/");
  const base = path.basename(absFilePath);
  if (MARKETING_PUBLIC_IDS[base]) {
    return MARKETING_PUBLIC_IDS[base];
  }
  if (rel.startsWith("backend/media/")) {
    const inner = rel.slice("backend/media/".length);
    return `garzoni/${stripExtension(inner)}`;
  }
  if (rel.startsWith("frontend/src/assets/")) {
    const inner = rel.slice("frontend/src/assets/".length);
    return `garzoni/web/${stripExtension(inner)}`;
  }
  if (rel.startsWith("mobile/assets/")) {
    const inner = rel.slice("mobile/assets/".length);
    return `garzoni/mobile/${stripExtension(inner)}`;
  }
  return `garzoni/${stripExtension(rel)}`;
}

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  return { dryRun };
}

function pickUniqueUploads(files) {
  /** @type {Map<string, string>} publicId -> absolute path (winner) */
  const byId = new Map();
  /** @type {Map<string, string[]>} publicId -> all relative paths seen */
  const sources = new Map();

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const id = resolvePublicId(file);
    if (!sources.has(id)) sources.set(id, []);
    sources.get(id).push(rel);

    if (!byId.has(id)) {
      byId.set(id, file);
      continue;
    }
    const prev = byId.get(id);
    const prevRel = path.relative(ROOT, prev).replace(/\\/g, "/");
    if (sourcePriority(rel) < sourcePriority(prevRel)) {
      byId.set(id, file);
    }
  }

  for (const [id, paths] of sources) {
    if (paths.length > 1) {
      const win = path.relative(ROOT, byId.get(id)).replace(/\\/g, "/");
      const skipped = paths.filter((p) => p !== win);
      console.log(`[dedupe] ${id} ← ${win} (skipped: ${skipped.join(", ")})`);
    }
  }

  return byId;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

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

  if (!dryRun && (!cloudName || !apiKey || !apiSecret)) {
    console.error(
      "Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or CLOUDINARY_URL).",
    );
    process.exit(1);
  }

  if (!dryRun) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  const files = TARGET_DIRS.flatMap((dir) => walkFiles(dir));
  if (!files.length) {
    console.log("No images found in target folders.");
    return;
  }

  const byId = pickUniqueUploads(files);
  const uploads = [...byId.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  console.log(
    `${dryRun ? "[dry-run] Would upload" : "Uploading"} ${uploads.length} unique public_id(s) (from ${files.length} files)...`,
  );

  const results = [];
  for (const [publicId, file] of uploads) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (dryRun) {
      console.log(`DRY ${publicId} <= ${rel}`);
      results.push({ file: rel, public_id: publicId, dry_run: true });
      continue;
    }
    try {
      const uploaded = await cloudinary.uploader.upload(file, {
        public_id: publicId,
        resource_type: "auto",
        overwrite: true,
        invalidate: true,
      });
      results.push({
        file: rel,
        public_id: publicId,
        secure_url: uploaded.secure_url,
      });
      console.log(`OK  ${publicId} <= ${rel}`);
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      console.error(`ERR ${publicId} (${rel}): ${message}`);
    }
  }

  const outPath = path.join(ROOT, "scripts", "cloudinary-upload-results.json");
  if (!dryRun) {
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nSaved upload map: ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
