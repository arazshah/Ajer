import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPrivateObject } from "@/lib/uploads";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const asset = await db.fileAsset.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      contactDocs: { select: { id: true }, take: 1 },
      propertyDocs: { select: { id: true }, take: 1 },
      propertyMedia: { select: { id: true }, take: 1 },
      contractAttachments: {
        select: {
          contract: {
            select: { deal: { select: { assignedAgentId: true } } },
          },
        },
        take: 1,
      },
    },
  });
  if (!asset) return new Response("Not found", { status: 404 });
  const avatarOwner = await db.user.findFirst({
    where: { agencyId: user.agencyId, avatarUrl: `/api/files/${asset.id}` },
    select: { id: true },
  });
  const permitted = asset.contractAttachments.length
    ? (await hasPermission(user, "deals.view")) &&
      ((await hasPermission(user, "deals.manage_all")) ||
        asset.contractAttachments[0].contract.deal.assignedAgentId === user.id)
    : asset.contactDocs.length
      ? await hasPermission(user, "contacts.view")
      : asset.propertyDocs.length || asset.propertyMedia.length
        ? await hasPermission(user, "properties.view")
        : Boolean(avatarOwner);
  if (!permitted) return new Response("Not found", { status: 404 });
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
