import { readPublicEnv } from "./runtime/publicEnv";

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
