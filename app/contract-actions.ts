"use server";

import type {
  ContractChecklistStatus,
  ContractObligationStatus,
  ContractPartyRole,
  ContractVersionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buildInitialContractBody,
  canTransitionContractVersion,
  DEFAULT_CONTRACT_CHECKLIST,
  primaryPartyRoles,
} from "@/lib/contracts";
import { normalizeNationalCode } from "@/lib/crm";
import { db } from "@/lib/db";
import { normalizeMobile, parseMoney, toEnglishDigits } from "@/lib/format";
import { parseJalaliDate } from "@/lib/jalali";
import { requirePermission } from "@/lib/permissions";

function value(fd: FormData, key: string, max = 4_000) {
  return String(fd.get(key) || "")
    .trim()
    .slice(0, max);
}

function optionalMoney(fd: FormData, key: string) {
  try {
    return parseMoney(value(fd, key, 80));
  } catch {
    return undefined;
  }
}

function basisPoints(raw: string) {
  const percent = Number(toEnglishDigits(raw).replace("٫", "."));
  return Number.isFinite(percent) && percent >= 0 && percent <= 100
    ? Math.round(percent * 100)
    : null;
}

async function managedContract(contractId: string, agencyId: string) {
  return db.dealContract.findFirst({
    where: { id: contractId, deal: { agencyId } },
    include: { deal: true },
  });
}

function refresh(dealId: string) {
  revalidatePath(`/deals/${dealId}`);
  revalidatePath(`/deals/${dealId}/legal`);
  revalidatePath(`/deals/${dealId}/contract/print`);
}

export async function initializeContractWorkflow(dealId: string) {
  const user = await requirePermission("deals.finance");
  const deal = await db.deal.findFirst({
    where: { id: dealId, agencyId: user.agencyId },
    include: { owner: true, applicant: true, property: true, contract: true },
  });
  if (!deal) return;
  const contract = await db.$transaction(async (tx) => {
    const record =
      deal.contract ||
      (await tx.dealContract.create({
        data: {
          dealId: deal.id,
          contractNumber: deal.contractNumber,
          contractDate: deal.contractDate,
          terms: deal.notes,
          contractType:
            deal.type === "SALE"
              ? "مبایعه‌نامه"
              : deal.type === "PRESALE"
                ? "پیش‌فروش"
                : "اجاره‌نامه",
          subject: deal.property.title,
        },
      }));
    if (
      (await tx.contractParty.count({ where: { contractId: record.id } })) === 0
    ) {
      const [firstRole, secondRole] = primaryPartyRoles(deal.type);
      await tx.contractParty.createMany({
        data: [
          {
            contractId: record.id,
            contactId: deal.owner.id,
            role: firstRole,
            fullName: deal.owner.fullName,
            nationalCode: deal.owner.nationalCode,
            mobile: deal.owner.mobile,
            address: deal.owner.address,
            postalCode: deal.owner.postalCode,
          },
          {
            contractId: record.id,
            contactId: deal.applicant.id,
            role: secondRole,
            fullName: deal.applicant.fullName,
            nationalCode: deal.applicant.nationalCode,
            mobile: deal.applicant.mobile,
            address: deal.applicant.address,
            postalCode: deal.applicant.postalCode,
          },
        ],
      });
    }
    await tx.contractChecklistItem.createMany({
      data: DEFAULT_CONTRACT_CHECKLIST.map((item) => ({
        contractId: record.id,
        ...item,
      })),
      skipDuplicates: true,
    });
    if (
      (await tx.contractVersion.count({ where: { contractId: record.id } })) ===
      0
    ) {
      await tx.contractVersion.create({
        data: {
          contractId: record.id,
          version: 1,
          title: "پیش‌نویس اولیه قرارداد",
          body: buildInitialContractBody({
            contractNumber: record.contractNumber,
            ownerName: deal.owner.fullName,
            applicantName: deal.applicant.fullName,
            propertyTitle: deal.property.title,
            propertyAddress: deal.property.address,
            agreedPrice: deal.agreedPrice,
            depositAmount: deal.depositAmount,
            monthlyRent: deal.monthlyRent,
            terms: record.terms,
          }),
          changeSummary: "ایجاد خودکار از اطلاعات معامله",
          createdById: user.id,
        },
      });
      await tx.dealContract.update({
        where: { id: record.id },
        data: { currentVersion: 1 },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "DealContract",
        entityId: record.id,
        action: "INITIALIZE_LEGAL_WORKFLOW",
      },
    });
    return record;
  });
  refresh(deal.id);
  redirect(`/deals/${deal.id}/legal?initialized=${contract.id}`);
}

export async function saveLegalContractCore(contractId: string, fd: FormData) {
  const user = await requirePermission("deals.finance");
  const contract = await managedContract(contractId, user.agencyId);
  if (!contract) return;
  const contractDateRaw = value(fd, "contractDate", 20);
  const deliveryAtRaw = value(fd, "deliveryAt", 20);
  const contractDate = contractDateRaw
    ? parseJalaliDate(contractDateRaw)
    : null;
  const deliveryAt = deliveryAtRaw ? parseJalaliDate(deliveryAtRaw) : null;
  if ((contractDateRaw && !contractDate) || (deliveryAtRaw && !deliveryAt))
    redirect(`/deals/${contract.dealId}/legal?error=date`);
  const contractNumber = value(fd, "contractNumber", 100) || null;
  await db.$transaction([
    db.dealContract.update({
      where: { id: contract.id },
      data: {
        contractNumber,
        contractDate,
        contractType: value(fd, "contractType", 100) || null,
        subject: value(fd, "subject", 300) || null,
        deliveryAt,
        registrySystem: value(fd, "registrySystem", 100) || "کاتب",
        registryReference: value(fd, "registryReference", 120) || null,
        registrationStatus: z
          .enum([
            "NOT_SUBMITTED",
            "DRAFT",
            "SUBMITTED",
            "REGISTERED",
            "REJECTED",
          ])
          .parse(value(fd, "registrationStatus")),
        terms: value(fd, "terms") || null,
      },
    }),
    db.deal.update({
      where: { id: contract.dealId },
      data: { contractNumber, contractDate },
    }),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "DealContract",
        entityId: contract.id,
        action: "UPDATE_LEGAL_CORE",
      },
    }),
  ]);
  refresh(contract.dealId);
  redirect(`/deals/${contract.dealId}/legal?saved=core`);
}

export async function createContractVersion(contractId: string, fd: FormData) {
  const user = await requirePermission("deals.finance");
  const contract = await managedContract(contractId, user.agencyId);
  if (!contract) return;
  const title = value(fd, "title", 160);
  const body = value(fd, "body", 50_000);
  if (title.length < 3 || body.length < 20)
    redirect(`/deals/${contract.dealId}/legal?error=version`);
  await db.$transaction(async (tx) => {
    const updated = await tx.dealContract.update({
      where: { id: contract.id },
      data: { currentVersion: { increment: 1 } },
      select: { currentVersion: true },
    });
    const version = await tx.contractVersion.create({
      data: {
        contractId: contract.id,
        version: updated.currentVersion,
        title,
        body,
        changeSummary: value(fd, "changeSummary", 500) || null,
        createdById: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "ContractVersion",
        entityId: version.id,
        action: "CREATE_CONTRACT_VERSION",
      },
    });
  });
  refresh(contract.dealId);
  redirect(`/deals/${contract.dealId}/legal?created=version`);
}

export async function updateContractVersionStatus(
  versionId: string,
  nextStatus: ContractVersionStatus,
) {
  const user = await requirePermission("deals.finance");
  const version = await db.contractVersion.findFirst({
    where: { id: versionId, contract: { deal: { agencyId: user.agencyId } } },
    include: {
      contract: { include: { parties: true, checklist: true } },
    },
  });
  if (!version || !canTransitionContractVersion(version.status, nextStatus))
    return;
  if (nextStatus === "SIGNED") {
    const checklistReady = version.contract.checklist
      .filter((item) => item.required)
      .every((item) => ["VERIFIED", "NOT_APPLICABLE"].includes(item.status));
    const partiesSigned =
      version.contract.parties.filter((party) => party.isPrimary).length >= 2 &&
      version.contract.parties
        .filter((party) => party.isPrimary)
        .every((party) => party.signedAt);
    if (
      !version.contract.contractNumber ||
      !version.contract.contractDate ||
      !checklistReady ||
      !partiesSigned
    )
      redirect(`/deals/${version.contract.dealId}/legal?error=sign-readiness`);
  }
  await db.$transaction([
    db.contractVersion.update({
      where: { id: version.id },
      data: {
        status: nextStatus,
        finalizedAt: ["FINAL", "SIGNED"].includes(nextStatus)
          ? new Date()
          : version.finalizedAt,
      },
    }),
    ...(["FINAL", "SIGNED"].includes(nextStatus)
      ? [
          db.dealContract.update({
            where: { id: version.contractId },
            data: {
              currentVersion: version.version,
              signedAt: nextStatus === "SIGNED" ? new Date() : undefined,
            },
          }),
        ]
      : []),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "ContractVersion",
        entityId: version.id,
        action: `CONTRACT_VERSION_${nextStatus}`,
      },
    }),
  ]);
  refresh(version.contract.dealId);
}

export async function saveContractParty(contractId: string, fd: FormData) {
  const user = await requirePermission("deals.finance");
  const contract = await managedContract(contractId, user.agencyId);
  if (!contract) return;
  const partyId = value(fd, "partyId", 80) || null;
  const contactId = value(fd, "contactId", 80) || null;
  if (
    contactId &&
    !(await db.contact.findFirst({
      where: { id: contactId, agencyId: user.agencyId },
    }))
  )
    return;
  if (
    partyId &&
    !(await db.contractParty.findFirst({
      where: { id: partyId, contractId: contract.id },
    }))
  )
    return;
  const role = z
    .enum([
      "SELLER",
      "BUYER",
      "LANDLORD",
      "TENANT",
      "OWNER",
      "APPLICANT",
      "GUARANTOR",
      "OTHER",
    ])
    .parse(value(fd, "role")) as ContractPartyRole;
  const fullName = value(fd, "fullName", 160);
  const share = basisPoints(value(fd, "sharePercent", 20) || "100");
  if (fullName.length < 3 || share === null)
    redirect(`/deals/${contract.dealId}/legal?error=party`);
  const nationalCode = normalizeNationalCode(value(fd, "nationalCode")) || null;
  const mobileRaw = value(fd, "mobile", 30);
  const mobile = mobileRaw ? normalizeMobile(mobileRaw) : null;
  const data = {
    contactId,
    role,
    fullName,
    fatherName: value(fd, "fatherName", 100) || null,
    nationalCode,
    identityNumber: value(fd, "identityNumber", 50) || null,
    mobile,
    address: value(fd, "address", 500) || null,
    postalCode: value(fd, "postalCode", 20) || null,
    shareBasisPoints: share,
    isPrimary: fd.get("isPrimary") === "on",
  };
  const party = partyId
    ? await db.contractParty.update({ where: { id: partyId }, data })
    : await db.contractParty.create({
        data: { contractId: contract.id, ...data },
      });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "ContractParty",
      entityId: party.id,
      action: partyId ? "UPDATE_CONTRACT_PARTY" : "CREATE_CONTRACT_PARTY",
    },
  });
  refresh(contract.dealId);
}

export async function toggleContractPartySigned(partyId: string) {
  const user = await requirePermission("deals.finance");
  const party = await db.contractParty.findFirst({
    where: { id: partyId, contract: { deal: { agencyId: user.agencyId } } },
    include: { contract: true },
  });
  if (!party) return;
  await db.$transaction([
    db.contractParty.update({
      where: { id: party.id },
      data: { signedAt: party.signedAt ? null : new Date() },
    }),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "ContractParty",
        entityId: party.id,
        action: party.signedAt
          ? "REVOKE_PARTY_SIGNATURE"
          : "RECORD_PARTY_SIGNATURE",
      },
    }),
  ]);
  refresh(party.contract.dealId);
}

export async function addContractWitness(contractId: string, fd: FormData) {
  const user = await requirePermission("deals.finance");
  const contract = await managedContract(contractId, user.agencyId);
  if (!contract) return;
  const fullName = value(fd, "fullName", 160);
  if (fullName.length < 3) return;
  const witness = await db.contractWitness.create({
    data: {
      contractId: contract.id,
      fullName,
      fatherName: value(fd, "fatherName", 100) || null,
      nationalCode: normalizeNationalCode(value(fd, "nationalCode")) || null,
      identityNumber: value(fd, "identityNumber", 50) || null,
      mobile: value(fd, "mobile", 30)
        ? normalizeMobile(value(fd, "mobile", 30))
        : null,
      address: value(fd, "address", 500) || null,
    },
  });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "ContractWitness",
      entityId: witness.id,
      action: "CREATE_CONTRACT_WITNESS",
    },
  });
  refresh(contract.dealId);
}

export async function toggleContractWitnessSigned(witnessId: string) {
  const user = await requirePermission("deals.finance");
  const witness = await db.contractWitness.findFirst({
    where: { id: witnessId, contract: { deal: { agencyId: user.agencyId } } },
    include: { contract: true },
  });
  if (!witness) return;
  await db.$transaction([
    db.contractWitness.update({
      where: { id: witness.id },
      data: { signedAt: witness.signedAt ? null : new Date() },
    }),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "ContractWitness",
        entityId: witness.id,
        action: witness.signedAt
          ? "REVOKE_WITNESS_SIGNATURE"
          : "RECORD_WITNESS_SIGNATURE",
      },
    }),
  ]);
  refresh(witness.contract.dealId);
}

export async function addContractObligation(contractId: string, fd: FormData) {
  const user = await requirePermission("deals.finance");
  const contract = await managedContract(contractId, user.agencyId);
  if (!contract) return;
  const dueAtRaw = value(fd, "dueAt", 20);
  const dueAt = parseJalaliDate(dueAtRaw);
  const amountToman = optionalMoney(fd, "amountToman");
  const responsiblePartyId = value(fd, "responsiblePartyId", 80) || null;
  if (
    !dueAt ||
    amountToman === undefined ||
    (responsiblePartyId &&
      !(await db.contractParty.findFirst({
        where: { id: responsiblePartyId, contractId: contract.id },
      })))
  )
    redirect(`/deals/${contract.dealId}/legal?error=obligation`);
  const obligation = await db.contractObligation.create({
    data: {
      contractId: contract.id,
      responsiblePartyId,
      title: value(fd, "title", 200),
      description: value(fd, "description", 1_000) || null,
      amountToman,
      dueAt,
      notes: value(fd, "notes", 500) || null,
    },
  });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "ContractObligation",
      entityId: obligation.id,
      action: "CREATE_CONTRACT_OBLIGATION",
    },
  });
  refresh(contract.dealId);
}

export async function updateContractObligationStatus(
  obligationId: string,
  status: ContractObligationStatus,
) {
  const user = await requirePermission("deals.finance");
  const obligation = await db.contractObligation.findFirst({
    where: {
      id: obligationId,
      contract: { deal: { agencyId: user.agencyId } },
    },
    include: { contract: true },
  });
  if (
    !obligation ||
    !["PENDING", "COMPLETED", "WAIVED", "DISPUTED"].includes(status)
  )
    return;
  await db.$transaction([
    db.contractObligation.update({
      where: { id: obligation.id },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    }),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "ContractObligation",
        entityId: obligation.id,
        action: `CONTRACT_OBLIGATION_${status}`,
      },
    }),
  ]);
  refresh(obligation.contract.dealId);
}

export async function addContractChecklistItem(
  contractId: string,
  fd: FormData,
) {
  const user = await requirePermission("deals.finance");
  const contract = await managedContract(contractId, user.agencyId);
  if (!contract) return;
  const title = value(fd, "title", 200);
  if (title.length < 3) return;
  const item = await db.contractChecklistItem.upsert({
    where: { contractId_title: { contractId: contract.id, title } },
    create: {
      contractId: contract.id,
      title,
      category: value(fd, "category", 80) || "سایر",
      required: fd.get("required") === "on",
    },
    update: {},
  });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "ContractChecklistItem",
      entityId: item.id,
      action: "CREATE_CONTRACT_CHECKLIST_ITEM",
    },
  });
  refresh(contract.dealId);
}

export async function updateContractChecklistStatus(
  itemId: string,
  status: ContractChecklistStatus,
) {
  const user = await requirePermission("deals.finance");
  const item = await db.contractChecklistItem.findFirst({
    where: { id: itemId, contract: { deal: { agencyId: user.agencyId } } },
    include: { contract: true },
  });
  if (
    !item ||
    !["PENDING", "PROVIDED", "VERIFIED", "REJECTED", "NOT_APPLICABLE"].includes(
      status,
    )
  )
    return;
  await db.$transaction([
    db.contractChecklistItem.update({
      where: { id: item.id },
      data: {
        status,
        verifiedById: status === "VERIFIED" ? user.id : null,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
      },
    }),
    db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "ContractChecklistItem",
        entityId: item.id,
        action: `CONTRACT_CHECKLIST_${status}`,
      },
    }),
  ]);
  refresh(item.contract.dealId);
}
