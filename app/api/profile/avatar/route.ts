import { createHash, randomUUID } from "node:crypto";
import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deletePrivateObject,
  detectedMime,
  extensionForMime,
  storePrivateObject,
} from "@/lib/uploads";

export const runtime = "nodejs";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function redirectTo(error?: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: error
        ? `/profile?uploadError=${encodeURIComponent(error)}`
        : "/profile?avatar=1",
    },
  });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser();
  const form = await request.formData();
  const file = form.get("avatar");
  if (!(file instanceof File) || !file.size) return redirectTo("تصویری انتخاب نشده است.");
  if (file.size > MAX_AVATAR_BYTES) return redirectTo("حجم تصویر بیشتر از ۵ مگابایت است.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectedMime(bytes);
  const extension = mimeType ? extensionForMime(mimeType) : null;
  if (!mimeType?.startsWith("image/") || !extension)
    return redirectTo("فقط تصویر JPG، PNG یا WebP معتبر پذیرفته می‌شود.");
  const storageKey = `${user.agencyId}/avatars/${randomUUID()}.${extension}`;
  await storePrivateObject(storageKey, bytes, mimeType);
  let oldAsset: { id: string; storageKey: string } | null = null;
  const oldId = user.avatarUrl?.match(/^\/api\/files\/(.+)$/)?.[1];
  if (oldId)
    oldAsset = await db.fileAsset.findFirst({ where: { id: oldId, agencyId: user.agencyId }, select: { id: true, storageKey: true } });
  try {
    await db.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: {
          agencyId: user.agencyId,
          uploadedById: user.id,
          originalName: file.name.slice(0, 240),
          storageKey,
          mimeType,
          sizeBytes: file.size,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { avatarUrl: `/api/files/${asset.id}` },
      });
    });
  } catch {
    await deletePrivateObject(storageKey);
    return redirectTo("ذخیره تصویر انجام نشد.");
  }
  if (oldAsset) {
    await db.fileAsset.delete({ where: { id: oldAsset.id } }).catch(() => undefined);
    await deletePrivateObject(oldAsset.storageKey);
  }
  return redirectTo();
}
