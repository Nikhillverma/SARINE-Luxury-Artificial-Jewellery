const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES = {
  "image/jpeg": buffer =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,
  "image/png": buffer =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": buffer =>
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
};

export function validateImageUpload({ fileName, mimeType, base64 }) {
  if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 255) {
    throw new Error("A valid image filename is required.");
  }

  if (!Object.hasOwn(SIGNATURES, mimeType)) {
    throw new Error("Only JPEG, PNG and WebP images are allowed.");
  }

  if (typeof base64 !== "string" || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new Error("The image data is invalid.");
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Optimised images must be 2 MB or smaller.");
  }

  if (!SIGNATURES[mimeType](buffer)) {
    throw new Error("The uploaded file content does not match its image type.");
  }

  return {
    buffer,
    fileName: fileName.replace(/[\\/\\0-\\x1f\\x7f]/g, "_").trim().slice(0, 255),
    mimeType
  };
}
