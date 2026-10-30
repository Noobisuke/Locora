import crypto from "crypto";
import multer from "multer";
import { config } from "../config";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

// Server-side check of the real file signature (the client-sent mimetype can be faked).
export function isRealImage(buf: Buffer): boolean {
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return jpeg || png || webp;
}

export const storageConfigured = () =>
  !!(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET);

const sign = (params: Record<string, string>) =>
  crypto.createHash("sha1")
    .update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + config.CLOUDINARY_API_SECRET)
    .digest("hex");

// Signed upload straight to Cloudinary's REST API. The secret never leaves the server.
export async function uploadToCloudinary(buf: Buffer, mime: string): Promise<{ url: string; publicId: string }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const folder = "locora/products";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), "upload");
  form.append("api_key", config.CLOUDINARY_API_KEY!);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", sign({ folder, timestamp }));
  const r = await fetch(`https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: form });
  if (!r.ok) throw new Error(`Cloudinary upload failed (${r.status})`);
  const data = (await r.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!storageConfigured()) return;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", config.CLOUDINARY_API_KEY!);
  form.append("timestamp", timestamp);
  form.append("signature", sign({ public_id: publicId, timestamp }));
  await fetch(`https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: "POST", body: form }).catch(() => {});
}
