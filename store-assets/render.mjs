#!/usr/bin/env node
// Renders App Store + Google Play screenshots and the Play feature graphic.
//
//   node store-assets/render.mjs                 # en + ro, every slot, every size
//   node store-assets/render.mjs --lang ro       # one language
//   node store-assets/render.mjs --only slot2    # one slot (feature graphic still renders)
//
// Output: store-assets/out/<lang>/{ios,play}/slotN.png and out/<lang>/feature-graphic.png.
// No npm dependencies: it drives an installed Google Chrome (or CHROME_PATH), falling back
// to `npx -y playwright@latest screenshot` when no Chrome is found. PNGs are rewritten as
// 24-bit RGB because Play rejects screenshots and feature graphics with an alpha channel.
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { deflateSync, inflateSync } from "node:zlib";

const run = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const BUILD = join(OUT, ".build");

const SIZES = {
  ios: { w: 1290, h: 2796 }, // iPhone 6.9" / 6.7" portrait
  play: { w: 1080, h: 1920 }, // Play phone, 9:16 (long side must be <= 2x short side)
};
const FEATURE = { w: 1024, h: 500 };

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const langs = (flag("--lang") ?? "en,ro").split(",");
const only = flag("--only");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));

function buildPage(templateFile, data, name) {
  const html = readFileSync(join(ROOT, templateFile), "utf8")
    .replace("<!--BASE-->", `<base href="${pathToFileURL(ROOT + "/").href}" />`)
    .replace(
      /(<script id="slot-data" type="application\/json">)[\s\S]*?(<\/script>)/,
      (_, open, close) => `${open}${JSON.stringify(data).replace(/</g, "\\u003c")}${close}`,
    );
  const file = join(BUILD, `${name}.html`);
  writeFileSync(file, html);
  return pathToFileURL(file).href;
}

async function screenshot(url, { w, h }, outFile) {
  mkdirSync(dirname(outFile), { recursive: true });
  if (chrome) {
    const profile = mkdtempSync(join(tmpdir(), "garzoni-store-"));
    rmSync(outFile, { force: true });
    try {
      await runChrome(
        [
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          "--force-device-scale-factor=1",
          "--no-first-run",
          "--no-default-browser-check",
          "--allow-file-access-from-files",
          `--user-data-dir=${profile}`,
          "--virtual-time-budget=6000",
          `--window-size=${w},${h}`,
          `--screenshot=${outFile}`,
          url,
        ],
        outFile,
      );
    } finally {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    }
  } else {
    await run(
      "npx",
      [
        "-y",
        "playwright@latest",
        "screenshot",
        "--browser=chromium",
        `--viewport-size=${w},${h}`,
        "--wait-for-timeout=2500",
        url,
        outFile,
      ],
      { timeout: 180_000 },
    );
  }
  stripAlpha(outFile, { w, h });
}

// Some Chrome builds keep the headless process alive after writing --screenshot, so wait
// for the file to appear and stop growing, then stop Chrome ourselves.
function runChrome(chromeArgs, outFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, chromeArgs, { stdio: "ignore" });
    let lastSize = -1;
    const poll = setInterval(() => {
      if (!existsSync(outFile)) return;
      const size = statSync(outFile).size;
      if (size > 0 && size === lastSize) child.kill();
      lastSize = size;
    }, 250);
    const deadline = setTimeout(() => child.kill(), 90_000);
    child.on("exit", () => {
      clearInterval(poll);
      clearTimeout(deadline);
      if (existsSync(outFile) && statSync(outFile).size > 0) resolve();
      else reject(new Error(`Chrome did not write ${outFile}`));
    });
    child.on("error", reject);
  });
}

// Minimal PNG rewrite: RGBA (colour type 6) -> RGB (colour type 2), and a size check.
function stripAlpha(file, expected) {
  const buf = readFileSync(file);
  let pos = 8;
  let ihdr;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") ihdr = body;
    if (type === "IDAT") idat.push(body);
    pos += 12 + len;
  }
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  if (w !== expected.w || h !== expected.h) {
    throw new Error(`${file}: rendered ${w}x${h}, expected ${expected.w}x${expected.h}`);
  }
  const [depth, colour, , , interlace] = ihdr.subarray(8);
  if (colour === 2) return;
  if (colour !== 6 || depth !== 8 || interlace !== 0) {
    throw new Error(`${file}: unsupported PNG (colour ${colour}, depth ${depth}, interlace ${interlace})`);
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const rgba = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = rgba.subarray(y * stride, (y + 1) * stride);
    const prev = y ? rgba.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0;
      const b = prev[x];
      const c = x >= 4 ? prev[x - 4] : 0;
      let p;
      if (filter === 0) p = 0;
      else if (filter === 1) p = a;
      else if (filter === 2) p = b;
      else if (filter === 3) p = (a + b) >> 1;
      else {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = (src[x] + p) & 0xff;
    }
  }

  const rgbStride = w * 3;
  const out = Buffer.alloc(h * (rgbStride + 1));
  let prevRow = Buffer.alloc(rgbStride);
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(rgbStride);
    for (let x = 0; x < w; x++) rgba.copy(row, x * 3, y * stride + x * 4, y * stride + x * 4 + 3);
    const o = y * (rgbStride + 1);
    out[o] = 2; // "Up" filter: the canvases are mostly vertical gradients
    for (let x = 0; x < rgbStride; x++) out[o + 1 + x] = (row[x] - prevRow[x]) & 0xff;
    prevRow = row;
  }

  const newIhdr = Buffer.from(ihdr);
  newIhdr[9] = 2;
  writeFileSync(
    file,
    Buffer.concat([buf.subarray(0, 8), chunk("IHDR", newIhdr), chunk("IDAT", deflateSync(out, { level: 9 })), chunk("IEND", Buffer.alloc(0))]),
  );
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([head.subarray(4), data])) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([head, data, tail]);
}

async function pool(jobs, size) {
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) await queue.shift()();
    }),
  );
}

mkdirSync(BUILD, { recursive: true });
console.log(chrome ? `Chrome: ${chrome}` : "Chrome not found, using npx playwright");

const jobs = [];
const pending = [];
for (const lang of langs) {
  const captions = JSON.parse(readFileSync(join(ROOT, `captions.${lang}.json`), "utf8"));

  const fgUrl = buildPage("feature-graphic.html", { lang, ...captions.featureGraphic }, `${lang}-feature-graphic`);
  jobs.push(() => screenshot(fgUrl, FEATURE, join(OUT, lang, "feature-graphic.png")));

  for (const slot of captions.slots) {
    if (only && slot.id !== only) continue;
    const hasImage = existsSync(join(ROOT, slot.image));
    if (!hasImage) pending.push(`${lang}/${slot.id}`);
    for (const [size, dims] of Object.entries(SIZES)) {
      const data = { lang, size, ...slot, image: hasImage ? slot.image : null, imagePath: slot.image };
      const url = buildPage("template.html", data, `${lang}-${slot.id}-${size}`);
      jobs.push(() => screenshot(url, dims, join(OUT, lang, size, `${slot.id}.png`)));
    }
  }
}

const started = Date.now();
await pool(jobs, 4);
console.log(`Rendered ${jobs.length} images into ${OUT} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
if (pending.length) console.log(`Placeholder panels (no capture yet): ${pending.join(", ")}`);
