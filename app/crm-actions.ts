"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeNationalCode, parseTags } from "@/lib/crm";
import { normalizeMobile, toEnglishDigits } from "@/lib/format";
import { hasPermission, requirePermission } from "@/lib/permissions";
import type { ContactType, LeadStatus, Source } from "@prisma/client";
import { parseJalaliDate } from "@/lib/jalali";

function value(fd: FormData, key: string) {
  return String(fd.get(key) || "").trim();
}

export async function saveContactCrmProfile(fd: FormData) {
  const user = await requirePermission("contacts.manage");
  const contactId = value(fd, "contactId");
  const contact = await db.contact.findFirst({
    where: { id: contactId, agencyId: user.agencyId },
  });
  if (!contact) return;
  const fullName = value(fd, "fullName");
  const mobile = normalizeMobile(value(fd, "mobile"));
  const nationalCode = normalizeNationalCode(value(fd, "nationalCode")) || null;
  if (fullName.length < 3 || !/^09\d{9}$/.test(mobile)) return;
  if (nationalCode && nationalCode.length !== 10) return;
  const duplicate = await db.contact.findFirst({
    where: {
      agencyId: user.agencyId,
      id: { not: contact.id },
      OR: [{ mobile }, ...(nationalCode ? [{ nationalCode }] : [])],
    },
  });
  if (duplicate) redirect(`/contacts/${contact.id}?error=duplicate`);
  const assignedAgentId = value(fd, "assignedAgentId") || null;
  if (
    assignedAgentId &&
    !(await db.user.findFirst({
      where: { id: assignedAgentId, agencyId: user.agencyId, isActive: true },
    }))
  )
    return;
  const contactType = value(fd, "type");
  const source = value(fd, "source");
  if (!["OWNER", "APPLICANT", "BOTH"].includes(contactType)) return;
  if (
    ![
      "OWNER",
      "REFERRAL",
      "FIELD_RESEARCH",
      "WEBSITE",
      "SOCIAL_MEDIA",
      "OTHER",
    ].includes(source)
  )
    return;
  const leadStatus = value(fd, "leadStatus");
  if (
    ![
      "NEW",
      "CONTACTED",
      "QUALIFIED",
      "NEGOTIATING",
      "CUSTOMER",
      "LOST",
      "ARCHIVED",
    ].includes(leadStatus)
  )
    return;
  const leadScore = Number(toEnglishDigits(value(fd, "leadScore") || "0"));
  if (!Number.isInteger(leadScore) || leadScore < 0 || leadScore > 100) return;
  const tags = parseTags(value(fd, "tags"));
  const birthDateRaw = value(fd, "birthDate");
  const birthDate = birthDateRaw ? parseJalaliDate(birthDateRaw) : null;
  if (birthDateRaw && !birthDate) return;
  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contact.id },
      data: {
        fullName,
        type: contactType as ContactType,
        source: source as Source,
        mobile,
        alternatePhone: value(fd, "alternatePhone") || null,
        nationalCode,
        email: value(fd, "email").toLowerCase() || null,
        assignedAgentId,
        leadStatus: leadStatus as LeadStatus,
        leadScore,
        occupation: value(fd, "occupation") || null,
        companyName: value(fd, "companyName") || null,
        birthDate,
        address: value(fd, "address") || null,
        city: value(fd, "city") || null,
        province: value(fd, "province") || null,
        postalCode: value(fd, "postalCode") || null,
        preferredContactMethod:
          value(fd, "preferredContactMethod") || "تماس تلفنی",
        marketingConsent: fd.get("marketingConsent") === "on",
        doNotContact: fd.get("doNotContact") === "on",
        notes: value(fd, "notes") || null,
      },
    });
    await tx.contactTagAssignment.deleteMany({
      where: { contactId: contact.id },
    });
    for (const tagName of tags) {
      const tag = await tx.contactTag.upsert({
        where: { agencyId_name: { agencyId: user.agencyId, name: tagName } },
        create: { agencyId: user.agencyId, name: tagName },
        update: {},
      });
      await tx.contactTagAssignment.create({
        data: { contactId: contact.id, tagId: tag.id },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "Contact",
        entityId: contact.id,
        action: "UPDATE_CRM_PROFILE",
      },
    });
  });
  revalidatePath(`/contacts/${contact.id}`);
  revalidatePath("/owners");
  revalidatePath("/applicants");
  redirect(`/contacts/${contact.id}?saved=1`);
}

export async function setDocumentStatus(
  entityType: "CONTACT" | "PROPERTY",
  documentId: string,
  status: "VERIFIED" | "REJECTED",
) {
  const user = await requirePermission("documents.verify");
  const data = {
    status,
    verifiedById: status === "VERIFIED" ? user.id : null,
    verifiedAt: status === "VERIFIED" ? new Date() : null,
  } as const;
  if (entityType === "CONTACT") {
    const document = await db.contactDocument.findFirst({
      where: { id: documentId, agencyId: user.agencyId },
    });
    if (!document) return;
    await db.contactDocument.update({ where: { id: document.id }, data });
    revalidatePath(`/contacts/${document.contactId}`);
  } else {
    const document = await db.propertyDocument.findFirst({
      where: { id: documentId, agencyId: user.agencyId },
    });
    if (!document) return;
    await db.propertyDocument.update({ where: { id: document.id }, data });
    revalidatePath(`/properties/${document.propertyId}`);
  }
}

export async function setPropertyMediaCover(
  propertyId: string,
  mediaId: string,
) {
  const user = await requirePermission("properties.view");
  const canManageAll = await hasPermission(user, "properties.manage_all");
  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
  });
  if (!property) return;
  const media = await db.propertyMedia.findFirst({
    where: { id: mediaId, propertyId, agencyId: user.agencyId },
  });
  if (!media) return;
  await db.$transaction([
    db.propertyMedia.updateMany({
      where: { propertyId },
      data: { isCover: false },
    }),
    db.propertyMedia.update({
      where: { id: media.id },
      data: { isCover: true },
    }),
  ]);
  revalidatePath(`/properties/${propertyId}`);
}
