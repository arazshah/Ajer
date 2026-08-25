import "server-only";

import { readPrivateObject } from "@/lib/uploads";

export async function privateAssetResponse(asset: {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}) {
  try {
    const bytes = await readPrivateObject(asset.storageKey);
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.sizeBytes),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
