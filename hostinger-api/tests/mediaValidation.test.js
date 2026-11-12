import test from "node:test";
import assert from "node:assert/strict";
import { validateImageUpload } from "../mediaValidation.js";

const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);

test("accepts valid PNG data", () => {
  const result = validateImageUpload({
    fileName: "product.png",
    mimeType: "image/png",
    base64: png.toString("base64")
  });
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(result.buffer, png);
});

test("accepts valid JPEG signature", () => {
  const data = Buffer.from([0xff,0xd8,0xff,0x00]);
  assert.equal(validateImageUpload({
    fileName: "photo.jpg", mimeType: "image/jpeg", base64: data.toString("base64")
  }).buffer.length, 4);
});

test("accepts valid WebP signature", () => {
  const data = Buffer.from("RIFFxxxxWEBP", "ascii");
  assert.equal(validateImageUpload({
    fileName: "photo.webp", mimeType: "image/webp", base64: data.toString("base64")
  }).mimeType, "image/webp");
});

test("rejects unsupported MIME types", () => {
  assert.throws(() => validateImageUpload({
    fileName: "image.svg", mimeType: "image/svg+xml", base64: Buffer.from("<svg/>").toString("base64")
  }), /Only JPEG, PNG and WebP/);
});

test("rejects MIME spoofing", () => {
  assert.throws(() => validateImageUpload({
    fileName: "fake.png", mimeType: "image/png", base64: Buffer.from("not an image").toString("base64")
  }), /does not match/);
});

test("rejects invalid base64 and oversized data", () => {
  assert.throws(() => validateImageUpload({ fileName: "x.png", mimeType: "image/png", base64: "%%%!" }), /invalid/);
  const large = Buffer.alloc(2 * 1024 * 1024 + 1, 1);
  assert.throws(() => validateImageUpload({
    fileName: "large.png", mimeType: "image/png", base64: large.toString("base64")
  }), /2 MB or smaller/);
});

test("sanitises filename path characters", () => {
  const result = validateImageUpload({
    fileName: "../private\\item.png", mimeType: "image/png", base64: png.toString("base64")
  });
  assert.equal(result.fileName.includes("/"), false);
  assert.equal(result.fileName.includes("\\"), false);
});
