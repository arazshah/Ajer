import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  buildInitialContractBody,
  DEFAULT_CONTRACT_CHECKLIST,
} from "../lib/contracts";

const db = new PrismaClient();

async function main() {
  const agency = await db.agency.findFirst({ include: { users: true } });
  const user =
    agency?.users.find((item) => item.role === "ADMIN") || agency?.users[0];
  if (!agency || !user)
    throw new Error("ابتدا bootstrap یا seed را اجرا کنید.");
  const marker = `LEGAL-${Date.now()}`;
  let dealId: string | null = null;
  let propertyId: string | null = null;
  const contactIds: string[] = [];
  try {
    const [owner, applicant] = await Promise.all([
      db.contact.create({
        data: {
          agencyId: agency.id,
          type: "OWNER",
          fullName: `${marker} مالک`,
          mobile: `0911${String(Date.now()).slice(-7)}`,
        },
      }),
      db.contact.create({
        data: {
          agencyId: agency.id,
          type: "APPLICANT",
          fullName: `${marker} خریدار`,
          mobile: `0921${String(Date.now() + 1).slice(-7)}`,
        },
      }),
    ]);
    contactIds.push(owner.id, applicant.id);
    const property = await db.property.create({
      data: {
        agencyId: agency.id,
        assignedAgentId: user.id,
        ownerId: owner.id,
        code: marker,
        title: "ملک تست قرارداد",
        description: marker,
        transactionType: "SALE",
        propertyType: "APARTMENT",
        status: "RESERVED",
        city: agency.city,
        district: "تست",
        neighborhood: "تست",
        address: "نشانی تست قرارداد",
        latitude: 37.55,
        longitude: 45.07,
        area: 100,
        fingerprint: randomUUID(),
      },
    });
    propertyId = property.id;
    const deal = await db.deal.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        applicantId: applicant.id,
        ownerId: owner.id,
        assignedAgentId: user.id,
        type: "SALE",
        status: "AGREED",
        agreedPrice: 10_000_000_000n,
      },
    });
    dealId = deal.id;
    const contract = await db.dealContract.create({
      data: {
        dealId: deal.id,
        contractNumber: marker,
        contractDate: new Date(),
        contractType: "مبایعه‌نامه",
        subject: property.title,
        currentVersion: 1,
        parties: {
          create: [
            { contactId: owner.id, role: "SELLER", fullName: owner.fullName },
            {
              contactId: applicant.id,
              role: "BUYER",
              fullName: applicant.fullName,
            },
          ],
        },
        checklist: {
          create: DEFAULT_CONTRACT_CHECKLIST.map((item) => ({
            ...item,
            status: "VERIFIED",
            verifiedById: user.id,
            verifiedAt: new Date(),
          })),
        },
        versions: {
          create: {
            version: 1,
            title: "نسخه تست",
            body: buildInitialContractBody({
              contractNumber: marker,
              ownerName: owner.fullName,
              applicantName: applicant.fullName,
              propertyTitle: property.title,
              propertyAddress: property.address,
              agreedPrice: deal.agreedPrice,
            }),
            createdById: user.id,
          },
        },
      },
      include: { parties: true, versions: true },
    });
    await db.$transaction([
      db.contractParty.updateMany({
        where: { contractId: contract.id },
        data: { signedAt: new Date() },
      }),
      db.contractVersion.update({
        where: { id: contract.versions[0].id },
        data: { status: "SIGNED", finalizedAt: new Date() },
      }),
      db.dealContract.update({
        where: { id: contract.id },
        data: { signedAt: new Date() },
      }),
      db.contractWitness.create({
        data: {
          contractId: contract.id,
          fullName: `${marker} شاهد`,
          signedAt: new Date(),
        },
      }),
      db.contractObligation.create({
        data: {
          contractId: contract.id,
          responsiblePartyId: contract.parties[0].id,
          title: "تحویل ملک",
          dueAt: new Date(Date.now() + 86_400_000),
          status: "COMPLETED",
          completedAt: new Date(),
        },
      }),
    ]);
    const result = await db.dealContract.findUnique({
      where: { id: contract.id },
      include: {
        versions: true,
        parties: true,
        witnesses: true,
        obligations: true,
        checklist: true,
      },
    });
    if (
      !result?.signedAt ||
      result.versions[0]?.status !== "SIGNED" ||
      result.parties.some((party) => !party.signedAt) ||
      result.checklist.some((item) => item.status !== "VERIFIED") ||
      result.witnesses.length !== 1 ||
      result.obligations[0]?.status !== "COMPLETED"
    )
      throw new Error("گردش پرونده حقوقی با نتیجه مورد انتظار تطبیق ندارد.");
    console.log(
      "Legal contract smoke test passed: parties → checklist → version → signatures → obligation → printable record.",
    );
  } finally {
    if (dealId) await db.deal.deleteMany({ where: { id: dealId } });
    if (propertyId) await db.property.deleteMany({ where: { id: propertyId } });
    if (contactIds.length)
      await db.contact.deleteMany({ where: { id: { in: contactIds } } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
