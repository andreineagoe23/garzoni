const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
const UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();

export function isCloudinaryUploadConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export type CloudinaryUploadResult = { secureUrl: string };

export async function uploadImageToCloudinary(
  fileUri: string,
  filename = "avatar.jpg",
  mimeType = "image/jpeg",
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("cloudinary_not_configured");
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const body = new FormData();
  body.append("file", {
    uri: fileUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
  body.append("upload_preset", UPLOAD_PRESET);
  body.append("folder", "garzoni/avatars");

  const response = await fetch(endpoint, { method: "POST", body });
  if (!response.ok) {
    throw new Error(`cloudinary_upload_failed_${response.status}`);
  }
  const data = (await response.json()) as { secure_url?: string };
  if (!data.secure_url) {
    throw new Error("cloudinary_missing_secure_url");
  }
  return { secureUrl: data.secure_url };
}
