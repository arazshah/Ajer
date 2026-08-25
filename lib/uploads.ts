import { createHash, createHmac } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const mimeExtensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function extensionForMime(mimeType: string) {
  return mimeExtensions[mimeType] ?? null;
}

export function detectedMime(buffer: Uint8Array) {
  if (
    buffer.length >= 4 &&
    String.fromCharCode(...buffer.slice(0, 4)) === "%PDF"
  )
    return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "image/png";
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...buffer.slice(start, end));
  if (buffer.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return "image/webp";
  if (buffer.length >= 12 && ascii(4, 8) === "ftyp") return "video/mp4";
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  )
    return "video/webm";
  return null;
}

export function uploadRoot() {
  return path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"),
  );
}

export function resolveStorageKey(storageKey: string) {
  const root = uploadRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`))
    throw new Error("Invalid storage key.");
  return resolved;
}

export type StorageDriver = "local" | "s3";

export function storageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER?.toLowerCase() === "s3" ? "s3" : "local";
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function s3Config() {
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || "us-east-1";
  if (!endpoint || !bucket || !accessKey || !secretKey)
    throw new Error("S3 storage is selected but its configuration is incomplete.");
  return { endpoint, bucket, accessKey, secretKey, region };
}

function objectUrl(storageKey = "") {
  const config = s3Config();
  const endpoint = new URL(config.endpoint);
  const segments = [
    ...endpoint.pathname.split("/").filter(Boolean),
    config.bucket,
    ...storageKey.split("/").filter(Boolean),
  ];
  endpoint.pathname = `/${segments.map(encodeURIComponent).join("/")}`;
  return endpoint;
}

function amzDate(now: Date) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signedS3Headers(
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  url: URL,
  body: Uint8Array,
  contentType?: string,
) {
  const config = s3Config();
  const now = new Date();
  const timestamp = amzDate(now);
  const date = timestamp.slice(0, 8);
  const payloadHash = sha256(body);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${date}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretKey}`, date);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

async function s3Request(
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  storageKey: string,
  body: Uint8Array<ArrayBufferLike> = new Uint8Array(),
  contentType?: string,
) {
  const url = objectUrl(storageKey);
  const response = await fetch(url, {
    method,
    headers: signedS3Headers(method, url, body, contentType),
    ...(method === "PUT" ? { body: Buffer.from(body) } : {}),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Object storage request failed with status ${response.status}.`);
  return response;
}

export async function storePrivateObject(
  storageKey: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  if (storageDriver() === "s3") {
    await s3Request("PUT", storageKey, bytes, mimeType);
    return;
  }
  const absolutePath = resolveStorageKey(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await mkdir(uploadRoot(), { recursive: true });
  await writeFile(absolutePath, bytes, { flag: "wx" });
}

export async function readPrivateObject(storageKey: string) {
  if (storageDriver() === "s3") {
    const response = await s3Request("GET", storageKey);
    return new Uint8Array(await response.arrayBuffer());
  }
  return new Uint8Array(await readFile(resolveStorageKey(storageKey)));
}

export async function deletePrivateObject(storageKey: string) {
  if (storageDriver() === "s3") {
    await s3Request("DELETE", storageKey).catch(() => undefined);
    return;
  }
  await unlink(resolveStorageKey(storageKey)).catch(() => undefined);
}

export async function checkPrivateStorage() {
  if (storageDriver() === "s3") {
    await s3Request("HEAD", "");
    return { driver: "s3" as const };
  }
  await access(uploadRoot());
  return { driver: "local" as const };
}
