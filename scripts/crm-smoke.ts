import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveStorageKey } from "../lib/uploads";

const db = new PrismaClient();
const assetIds: string[] = [];
const storagePaths: string[] = [];
let contactId: string | undefined;
let tagId: string | undefined;
let propertyMediaId: string | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createAsset(input: {
  agencyId: string;
  userId: string;
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  originalName: string;
}) {
  const storageKey = `${input.agencyId}/smoke-${randomUUID()}.${input.extension}`;
  const absolutePath = resolveStorageKey(storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes, { flag: "wx" });
  storagePaths.push(absolutePath);
  const asset = await db.fileAsset.create({
    data: {
      agencyId: input.agencyId,
      uploadedById: input.userId,
      originalName: input.originalName,
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
    },
  });
  assetIds.push(asset.id);
  return asset;
}

async function main() {
  const agency = await db.agency.findFirst({
    include: {
      users: { where: { isActive: true }, take: 1 },
      properties: { take: 1 },
    },
  });
  assert(agency?.users[0] && agency.properties[0], "داده پایه CRM موجود نیست.");
  const user = agency.users[0];
  const property = agency.properties[0];
  const suffix = String(Date.now()).slice(-8);
  const contact = await db.contact.create({
    data: {
      agencyId: agency.id,
      assignedAgentId: user.id,
      type: "BOTH",
      fullName: "مخاطب تست خودکار CRM",
      mobile: `099${suffix}`,
      nationalCode: `88${suffix}`,
      leadStatus: "QUALIFIED",
      leadScore: 75,
      source: "OTHER",
      marketingConsent: true,
    },
  });
  contactId = contact.id;
  const tag = await db.contactTag.create({
    data: { agencyId: agency.id, name: `تست-${suffix}` },
  });
  tagId = tag.id;
  await db.contactTagAssignment.create({
    data: { contactId: contact.id, tagId: tag.id },
  });

  const pdf = await createAsset({
    agencyId: agency.id,
    userId: user.id,
    bytes: new TextEncoder().encode("%PDF-1.7\nAjer CRM smoke document"),
    mimeType: "application/pdf",
    extension: "pdf",
    originalName: "crm-smoke.pdf",
  });
  await db.contactDocument.create({
    data: {
      agencyId: agency.id,
      contactId: contact.id,
      assetId: pdf.id,
      documentType: "NATIONAL_CARD",
      title: "مدرک تست CRM",
      status: "VERIFIED",
      verifiedById: user.id,
      verifiedAt: new Date(),
    },
  });

  const image = await createAsset({
    agencyId: agency.id,
    userId: user.id,
    bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    mimeType: "image/jpeg",
    extension: "jpg",
    originalName: "property-smoke.jpg",
  });
  const media = await db.propertyMedia.create({
    data: {
      agencyId: agency.id,
      propertyId: property.id,
      assetId: image.id,
      mediaType: "IMAGE",
      title: "رسانه تست CRM",
      isCover: true,
    },
  });
  propertyMediaId = media.id;

  const result = await db.contact.findUnique({
    where: { id: contact.id },
    include: { tagAssignments: true, documents: true },
  });
  assert(result?.leadScore === 75, "امتیاز سرنخ ذخیره نشد.");
  assert(result.tagAssignments.length === 1, "برچسب مخاطب ذخیره نشد.");
  assert(result.documents[0]?.status === "VERIFIED", "مدرک مخاطب تأیید نشد.");
  assert(
    await db.propertyMedia.findUnique({ where: { id: media.id } }),
    "رسانه ملک ذخیره نشد.",
  );
  console.log(
    "CRM smoke test passed: contact → tag → private document → verification → property media.",
  );
}

main()
  .finally(async () => {
    if (propertyMediaId)
      await db.propertyMedia
        .delete({ where: { id: propertyMediaId } })
        .catch(() => undefined);
    if (contactId)
      await db.contactDocument
        .deleteMany({ where: { contactId } })
        .catch(() => undefined);
    if (contactId)
      await db.contact
        .delete({ where: { id: contactId } })
        .catch(() => undefined);
    if (tagId)
      await db.contactTag
        .delete({ where: { id: tagId } })
        .catch(() => undefined);
    if (assetIds.length)
      await db.fileAsset
        .deleteMany({ where: { id: { in: assetIds } } })
        .catch(() => undefined);
    for (const filePath of storagePaths)
      await unlink(filePath).catch(() => undefined);
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
