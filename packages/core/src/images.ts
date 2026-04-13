import { readPublicEnv } from "./runtime/publicEnv";
import { getMediaBaseUrl } from "./services/backendUrl";

/** Mascot stills (owl / bull / bear); same keys as web `MascotMedia` / mobile `MascotImage`. */
export type MascotImageId = "owl" | "bull" | "bear";

const MASCOT_MEDIA_FILES: Record<MascotImageId, string> = {
  owl: "garzoni-owl.png",
  bull: "garzoni-bull.png",
  bear: "garzoni-bear.png",
};

let cloudNameOverride: string | null = null;

/** Override Cloudinary cloud name at runtime (e.g. Expo `extra` before first image read). */
export function configureCloudinaryCloudName(name: string): void {
  const t = name.trim();
  cloudNameOverride = t || null;
}

function getCloudName(): string {
  if (cloudNameOverride) return cloudNameOverride;
  return (
    readPublicEnv(
      "VITE_CLOUDINARY_CLOUD_NAME",
      "REACT_APP_CLOUDINARY_CLOUD_NAME",
    ) || ""
  );
}

/** Build a Cloudinary delivery URL. `publicId` uses folder/id form, e.g. `garzoni/login-bg`. */
export function cloudinaryImageUrl(
  publicId: string,
  transforms = "f_auto,q_auto",
): string {
  const cloud = getCloudName();
  if (!cloud) return "";
  const id = publicId.replace(/^\/+/, "");
  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms}/${id}`;
}

/**
 * Delivery URL for mascot PNGs (owl, bull, bear).
 *
 * When Cloudinary is configured (`VITE_CLOUDINARY_CLOUD_NAME` / `REACT_APP_*` /
 * `EXPO_PUBLIC_*` via {@link readPublicEnv}, or {@link configureCloudinaryCloudName} on native),
 * uses public IDs `garzoni/mascots/<basename-without-ext>` — the shape produced by
 * `node scripts/upload-cloudinary-images.js` for files under `backend/media/mascots/`.
 *
 * Otherwise falls back to Django `{@link getMediaBaseUrl}/media/mascots/...` (typical local dev).
 */
export function mascotImageUrl(
  mascot: MascotImageId,
  opts?: { width?: number },
): string {
  const file = MASCOT_MEDIA_FILES[mascot];
  const publicId = `garzoni/mascots/${file.replace(/\.[^.]+$/, "")}`;
  const w = opts?.width;
  const transforms =
    w != null && Number.isFinite(w) && w > 0
      ? `f_auto,q_auto,w_${Math.min(2048, Math.round(w))}`
      : "f_auto,q_auto";
  const cdn = cloudinaryImageUrl(publicId, transforms);
  if (cdn) return cdn;
  return `${getMediaBaseUrl()}/media/mascots/${file}`;
}

/**
 * Shared marketing / auth image URLs (upload public IDs under `garzoni/` in Cloudinary).
 * Set `VITE_CLOUDINARY_CLOUD_NAME` (web) or `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` (native).
 */
export const Images = {
  get loginBg() {
    return cloudinaryImageUrl("garzoni/login-bg", "f_auto,q_auto,w_1200");
  },
  get registerBg() {
    return cloudinaryImageUrl("garzoni/register-bg", "f_auto,q_auto,w_1200");
  },
  get basicFinance() {
    return cloudinaryImageUrl("garzoni/basicfinance", "f_auto,q_auto,w_800");
  },
  get crypto() {
    return cloudinaryImageUrl("garzoni/crypto", "f_auto,q_auto,w_800");
  },
  get forex() {
    return cloudinaryImageUrl("garzoni/forex", "f_auto,q_auto,w_800");
  },
  get mindset() {
    return cloudinaryImageUrl("garzoni/mindset", "f_auto,q_auto,w_800");
  },
  get personalFinance() {
    return cloudinaryImageUrl("garzoni/personalfinance", "f_auto,q_auto,w_800");
  },
  get realEstate() {
    return cloudinaryImageUrl("garzoni/realestate", "f_auto,q_auto,w_800");
  },
  get mobile1() {
    return cloudinaryImageUrl("garzoni/mobile-1", "f_auto,q_auto,w_600");
  },
  get mobile2() {
    return cloudinaryImageUrl("garzoni/mobile-2", "f_auto,q_auto,w_600");
  },
  get mobile3() {
    return cloudinaryImageUrl("garzoni/mobile-3", "f_auto,q_auto,w_600");
  },
} as const;
