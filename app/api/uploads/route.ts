import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hasPermission, requirePermission } from "@/lib/permissions";
import {
  detectedMime,
  deletePrivateObject,
  extensionForMime,
  MAX_UPLOAD_BYTES,
  storePrivateObject,
} from "@/lib/uploads";
import { parseJalaliDate } from "@/lib/jalali";

export const runtime = "nodejs";

function redirectTo(location: string, error?: string) {
  const target = error
    ? `${location}${location.includes("?") ? "&" : "?"}uploadError=${encodeURIComponent(error)}`
    : `${location}${location.includes("?") ? "&" : "?"}uploaded=1`;
  return new Response(null, { status: 303, headers: { Location: target } });
}

function text(form: FormData, key: string, max = 120) {
  return String(form.get(key) || "")
    .trim()
    .slice(0, max);
}

function optionalDate(form: FormData, key: string) {
  const raw = text(form, key, 20);
  if (!raw) return null;
  return parseJalaliDate(raw) ?? undefined;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const entityType = text(form, "entityType");
  const entityId = text(form, "entityId");
  const kind = text(form, "kind");
  const issuedAt = optionalDate(form, "issuedAt");
  const expiresAt = optionalDate(form, "expiresAt");
  const user = await requirePermission(
    entityType === "CONTACT"
      ? "contacts.manage"
      : entityType === "CONTRACT"
        ? "deals.finance"
        : "properties.view",
  );
  const contract =
    entityType === "CONTRACT"
      ? await db.dealContract.findFirst({
          where: { id: entityId, deal: { agencyId: user.agencyId } },
          select: { id: true, dealId: true },
        })
      : null;
  const returnTo =
    entityType === "CONTACT"
      ? `/contacts/${entityId}`
      : entityType === "CONTRACT" && contract
        ? `/deals/${contract.dealId}/legal`
        : `/properties/${entityId}`;
  if (!entityId || !["CONTACT", "PROPERTY", "CONTRACT"].includes(entityType))
    return redirectTo("/dashboard", "درخواست بارگذاری معتبر نیست.");
  if (issuedAt === undefined || expiresAt === undefined)
    return redirectTo(returnTo, "تاریخ مدرک معتبر نیست.");
  if (issuedAt && expiresAt && expiresAt < issuedAt)
    return redirectTo(
      returnTo,
      "تاریخ انقضا نمی‌تواند پیش از تاریخ صدور باشد.",
    );

  if (entityType === "CONTRACT") {
    if (!contract) return redirectTo("/deals", "پرونده قرارداد پیدا نشد.");
  } else if (entityType === "CONTACT") {
    if (
      !(await db.contact.findFirst({
        where: { id: entityId, agencyId: user.agencyId },
      }))
    )
      return redirectTo("/dashboard", "مخاطب پیدا نشد.");
  } else {
    const canManageAll = await hasPermission(user, "properties.manage_all");
    if (
      !(await db.property.findFirst({
        where: {
          id: entityId,
          agencyId: user.agencyId,
          ...(!canManageAll ? { assignedAgentId: user.id } : {}),
        },
      }))
    )
      return redirectTo(
        "/properties",
        "اجازه بارگذاری برای این فایل را ندارید.",
      );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return redirectTo(returnTo, "فایلی انتخاب نشده است.");
  if (file.size > MAX_UPLOAD_BYTES)
    return redirectTo(returnTo, "حجم فایل بیشتر از ۲۵ مگابایت است.");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectedMime(buffer);
  const extension = mimeType ? extensionForMime(mimeType) : null;
  if (!mimeType || !extension)
    return redirectTo(
      returnTo,
      "فقط PDF، تصویر و ویدئوی معتبر پذیرفته می‌شود.",
    );
  if (
    kind === "MEDIA" &&
    !mimeType.startsWith("image/") &&
    !mimeType.startsWith("video/")
  )
    return redirectTo(returnTo, "رسانه ملک باید تصویر یا ویدئو باشد.");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (
    await db.fileAsset.findFirst({ where: { agencyId: user.agencyId, sha256 } })
  )
    return redirectTo(returnTo, "این فایل قبلاً در دفتر بارگذاری شده است.");

  const storageKey = `${user.agencyId}/${randomUUID()}.${extension}`;
  await storePrivateObject(storageKey, buffer, mimeType);
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
          sha256,
        },
      });
      if (entityType === "CONTRACT") {
        const versionId = text(form, "versionId", 80) || null;
        if (
          versionId &&
          !(await tx.contractVersion.findFirst({
            where: { id: versionId, contractId: contract!.id },
          }))
        )
          throw new Error("نسخه قرارداد معتبر نیست.");
        const requestedKind = text(form, "attachmentKind", 30);
        const kind = [
          "DRAFT",
          "SIGNED_COPY",
          "IDENTITY",
          "OWNERSHIP",
          "PAYMENT",
          "OTHER",
        ].includes(requestedKind)
          ? (requestedKind as
              | "DRAFT"
              | "SIGNED_COPY"
              | "IDENTITY"
              | "OWNERSHIP"
              | "PAYMENT"
              | "OTHER")
          : "OTHER";
        await tx.contractAttachment.create({
          data: {
            contractId: contract!.id,
            versionId,
            assetId: asset.id,
            kind,
            title: text(form, "title") || file.name.slice(0, 120),
            notes: text(form, "notes", 500) || null,
          },
        });
      } else if (entityType === "CONTACT") {
        await tx.contactDocument.create({
          data: {
            agencyId: user.agencyId,
            contactId: entityId,
            assetId: asset.id,
            documentType: text(form, "documentType", 60) || "OTHER",
            title: text(form, "title") || file.name.slice(0, 120),
            documentNumber: text(form, "documentNumber", 80) || null,
            issuedAt,
            expiresAt,
          },
        });
      } else if (kind === "MEDIA") {
        const requestedType = text(form, "mediaType");
        const mediaType = [
          "IMAGE",
          "VIDEO",
          "FLOOR_PLAN",
          "VIRTUAL_TOUR",
        ].includes(requestedType)
          ? (requestedType as "IMAGE" | "VIDEO" | "FLOOR_PLAN" | "VIRTUAL_TOUR")
          : mimeType.startsWith("video/")
            ? "VIDEO"
            : "IMAGE";
        const hasImageCover =
          mimeType.startsWith("image/") &&
          Boolean(
            await tx.propertyMedia.findFirst({
              where: {
                propertyId: entityId,
                isCover: true,
                asset: { mimeType: { startsWith: "image/" } },
              },
              select: { id: true },
            }),
          );
        await tx.propertyMedia.create({
          data: {
            agencyId: user.agencyId,
            propertyId: entityId,
            assetId: asset.id,
            mediaType,
            title: text(form, "title") || file.name.slice(0, 120),
            alt: text(form, "alt", 160) || null,
            isCover: mimeType.startsWith("image/") && !hasImageCover,
          },
        });
      } else {
        await tx.propertyDocument.create({
          data: {
            agencyId: user.agencyId,
            propertyId: entityId,
            assetId: asset.id,
            documentType: text(form, "documentType", 60) || "OTHER",
            title: text(form, "title") || file.name.slice(0, 120),
            documentNumber: text(form, "documentNumber", 80) || null,
            issuedAt,
            expiresAt,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          agencyId: user.agencyId,
          userId: user.id,
          entityType,
          entityId,
          action: kind === "MEDIA" ? "UPLOAD_MEDIA" : "UPLOAD_DOCUMENT",
        },
      });
    });
  } catch (error) {
    await deletePrivateObject(storageKey);
    throw error;
  }
  return redirectTo(returnTo);
}
