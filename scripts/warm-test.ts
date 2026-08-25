import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultAccounting, newFinanceTransactionNumber } from "../lib/accounting";
import { calculateAllocation, calculateCommission } from "../lib/commission";
import { buildInitialContractBody, DEFAULT_CONTRACT_CHECKLIST } from "../lib/contracts";
import { resolveStorageKey } from "../lib/uploads";

const db = new PrismaClient();
const baseUrl = process.env.WARM_TEST_BASE_URL || "http://127.0.0.1:3003";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createPrivateAsset(input: {
  agencyId: string;
  userId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const absolutePath = resolveStorageKey(input.storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes, { flag: "wx" });
  const asset = await db.fileAsset.create({
    data: {
      agencyId: input.agencyId,
      uploadedById: input.userId,
      originalName: input.originalName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
    },
  });
  return { asset, absolutePath };
}

async function main() {
  const marker = `WARM-${Date.now()}-${randomUUID().slice(0, 5)}`;
  const passwordHash = await bcrypt.hash("Ajer-Warm-Test-2026!", 4);
  const storagePaths: string[] = [];
  let agencyId: string | undefined;
  try {
    const agency = await db.agency.create({
      data: {
        slug: marker.toLowerCase(),
        name: `دفتر تست گرم آجر ${marker.slice(-5)}`,
        phone: `021${String(Date.now()).slice(-8)}`,
        address: "تهران، نشانی دفتر آزمایشی آجر",
        city: "تهران",
        trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
        users: {
          create: [
            {
              fullName: "مدیر دفتر تست گرم",
              email: `${marker.toLowerCase()}-admin@example.test`,
              mobile: "09120000001",
              passwordHash,
              role: "ADMIN",
            },
            {
              fullName: "مشاور فروش تست گرم",
              email: `${marker.toLowerCase()}-agent@example.test`,
              mobile: "09120000002",
              passwordHash,
              role: "AGENT",
            },
          ],
        },
      },
      include: { users: true },
    });
    agencyId = agency.id;
    const admin = agency.users.find((user) => user.role === "ADMIN");
    const agent = agency.users.find((user) => user.role === "AGENT");
    assert(admin && agent, "ساخت مدیر و مشاور دفتر ناموفق بود.");

    await db.employeeProfile.create({
      data: {
        agencyId: agency.id,
        userId: agent.id,
        managerId: admin.id,
        employeeCode: `${marker}-AGENT`,
        personnelType: "AGENT",
        jobTitle: "مشاور فروش",
        defaultCommissionBasisPoints: 5_000,
      },
    });
    const [owner, applicant] = await Promise.all([
      db.contact.create({
        data: {
          agencyId: agency.id,
          assignedAgentId: agent.id,
          type: "OWNER",
          fullName: `مالک ${marker}`,
          mobile: "09350000001",
          city: "تهران",
          source: "OWNER",
          leadStatus: "QUALIFIED",
          notes: marker,
        },
      }),
      db.contact.create({
        data: {
          agencyId: agency.id,
          assignedAgentId: agent.id,
          type: "APPLICANT",
          fullName: `خریدار ${marker}`,
          mobile: "09350000002",
          city: "تهران",
          source: "WEBSITE",
          leadStatus: "QUALIFIED",
          leadScore: 90,
          notes: marker,
        },
      }),
    ]);
    console.log("✓ دفتر، پرسنل، مالک و متقاضی ثبت شدند.");

    const property = await db.property.create({
      data: {
        agencyId: agency.id,
        assignedAgentId: agent.id,
        ownerId: owner.id,
        code: marker,
        title: `آپارتمان تست گرم ${marker}`,
        description: "آپارتمان دوخوابه نورگیر برای سناریوی کامل تست گرم آجر",
        transactionType: "SALE",
        propertyType: "APARTMENT",
        status: "ACTIVE",
        exclusivity: "EXCLUSIVE",
        source: "OWNER",
        city: "تهران",
        district: "۲",
        neighborhood: "سعادت‌آباد",
        address: "تهران، سعادت‌آباد، نشانی آزمایشی",
        latitude: 35.786,
        longitude: 51.376,
        area: 120,
        bedrooms: 2,
        parking: true,
        elevator: true,
        storage: true,
        priceTotal: 10_000_000_000n,
        lastContactAt: new Date(),
        fingerprint: randomUUID(),
      },
    });
    const propertyFile = await createPrivateAsset({
      agencyId: agency.id,
      userId: agent.id,
      storageKey: `${agency.id}/${marker}-property.png`,
      originalName: "warm-property.png",
      mimeType: "image/png",
      bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    });
    storagePaths.push(propertyFile.absolutePath);
    await db.propertyMedia.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        assetId: propertyFile.asset.id,
        title: "تصویر اصلی فایل تست گرم",
        isCover: true,
      },
    });
    const requirement = await db.requirement.create({
      data: {
        agencyId: agency.id,
        applicantId: applicant.id,
        assignedAgentId: agent.id,
        title: `تقاضای خرید ${marker}`,
        transactionType: "SALE",
        propertyTypesJson: '["APARTMENT"]',
        city: "تهران",
        neighborhoodsJson: '["سعادت‌آباد"]',
        minArea: 100,
        maxArea: 140,
        minBedrooms: 2,
        maxBudget: 10_500_000_000n,
        parkingRequired: true,
        elevatorRequired: true,
        urgency: "HIGH",
      },
    });
    await db.activity.create({
      data: {
        agencyId: agency.id,
        userId: agent.id,
        contactId: applicant.id,
        propertyId: property.id,
        requirementId: requirement.id,
        type: "CALL",
        subject: "هماهنگی بازدید تست گرم",
        description: marker,
        occurredAt: new Date(),
        completed: true,
        priority: "HIGH",
      },
    });
    console.log("✓ فایل، رسانه خصوصی، تقاضا و پیگیری ثبت شدند.");

    const visit = await db.visit.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        applicantId: applicant.id,
        requirementId: requirement.id,
        assignedAgentId: agent.id,
        scheduledAt: new Date(),
        status: "COMPLETED",
        checkedInAt: new Date(),
        completedAt: new Date(),
        feedback: "ملک مورد پسند خریدار بود.",
        ownerFeedback: "خریدار واجد شرایط است.",
        applicantRating: 5,
        interestLevel: 5,
      },
    });
    await db.workTask.create({
      data: {
        agencyId: agency.id,
        assignedToId: agent.id,
        createdById: admin.id,
        contactId: applicant.id,
        propertyId: property.id,
        visitId: visit.id,
        title: "پیگیری نتیجه بازدید تست گرم",
        description: marker,
        priority: "HIGH",
        status: "COMPLETED",
        dueAt: new Date(),
        completedAt: new Date(),
      },
    });
    const offer = await db.salesOffer.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        applicantId: applicant.id,
        visitId: visit.id,
        createdById: agent.id,
        status: "ACCEPTED",
        round: 1,
        priceToman: 10_000_000_000n,
        terms: "تسویه کامل هنگام تنظیم سند",
        submittedAt: new Date(),
        respondedAt: new Date(),
      },
    });
    await db.property.update({
      where: { id: property.id },
      data: { status: "RESERVED" },
    });
    console.log("✓ بازدید، بازخورد، وظیفه و پیشنهاد پذیرفته‌شده تکمیل شدند.");

    const policy = await db.commissionPolicy.create({
      data: {
        agencyId: agency.id,
        name: `تعرفه فروش ${marker}`,
        transactionType: "SALE",
        calculationBase: "AGREED_PRICE",
        ownerRateBasisPoints: 50,
        applicantRateBasisPoints: 50,
        taxRateBasisPoints: 1_000,
      },
    });
    const commission = calculateCommission({
      baseToman: offer.priceToman!,
      policy,
    });
    const deal = await db.deal.create({
      data: {
        agencyId: agency.id,
        propertyId: property.id,
        applicantId: applicant.id,
        ownerId: owner.id,
        assignedAgentId: agent.id,
        type: "SALE",
        status: "AGREED",
        agreedPrice: offer.priceToman,
        commissionAmount: commission.totalAmountToman,
        notes: marker,
        statusHistory: {
          create: { changedById: agent.id, toStatus: "AGREED", note: marker },
        },
        commission: {
          create: {
            policyId: policy.id,
            calculationBase: "AGREED_PRICE",
            calculationBaseToman: offer.priceToman!,
            ownerAmountToman: commission.ownerAmountToman,
            applicantAmountToman: commission.applicantAmountToman,
            discountToman: commission.discountToman,
            taxAmountToman: commission.taxAmountToman,
            totalAmountToman: commission.totalAmountToman,
            status: "APPROVED",
            approvedById: admin.id,
            approvedAt: new Date(),
            allocations: {
              create: [
                {
                  userId: agent.id,
                  title: "سهم مشاور فروش تست گرم",
                  basisPoints: 5_000,
                  amountToman: calculateAllocation(
                    commission.distributableAmountToman,
                    5_000,
                  ),
                  status: "APPROVED",
                  approvedAt: new Date(),
                },
                {
                  title: "سهم دفتر تست گرم",
                  basisPoints: 5_000,
                  amountToman: calculateAllocation(
                    commission.distributableAmountToman,
                    5_000,
                  ),
                  status: "APPROVED",
                  approvedAt: new Date(),
                },
              ],
            },
          },
        },
      },
      include: { commission: { include: { allocations: true } } },
    });
    assert(deal.commission, "محاسبه کمیسیون معامله ذخیره نشد.");
    console.log("✓ معامله، کمیسیون و سهم مشاور/دفتر محاسبه و تأیید شدند.");

    const contract = await db.dealContract.create({
      data: {
        dealId: deal.id,
        contractNumber: marker,
        contractDate: new Date(),
        contractType: "مبایعه‌نامه",
        subject: property.title,
        registrySystem: "کاتب",
        registrationStatus: "REGISTERED",
        registryReference: `KATEB-${marker}`,
        signedAt: new Date(),
        currentVersion: 1,
        parties: {
          create: [
            {
              contactId: owner.id,
              role: "SELLER",
              fullName: owner.fullName,
              mobile: owner.mobile,
              signedAt: new Date(),
            },
            {
              contactId: applicant.id,
              role: "BUYER",
              fullName: applicant.fullName,
              mobile: applicant.mobile,
              signedAt: new Date(),
            },
          ],
        },
        checklist: {
          create: DEFAULT_CONTRACT_CHECKLIST.map((item) => ({
            ...item,
            status: "VERIFIED" as const,
            verifiedById: admin.id,
            verifiedAt: new Date(),
          })),
        },
        versions: {
          create: {
            version: 1,
            status: "SIGNED",
            title: "نسخه امضاشده تست گرم",
            body: buildInitialContractBody({
              contractNumber: marker,
              ownerName: owner.fullName,
              applicantName: applicant.fullName,
              propertyTitle: property.title,
              propertyAddress: property.address,
              agreedPrice: deal.agreedPrice,
              terms: "تحویل و تنظیم سند طبق توافق طرفین انجام می‌شود.",
            }),
            createdById: admin.id,
            finalizedAt: new Date(),
          },
        },
        witnesses: {
          create: {
            fullName: "شاهد قرارداد تست گرم",
            mobile: "09120000003",
            signedAt: new Date(),
          },
        },
        obligations: {
          create: {
            title: "تحویل ملک و تنظیم سند",
            description: marker,
            dueAt: new Date(Date.now() + 30 * 86_400_000),
            status: "COMPLETED",
            completedAt: new Date(),
          },
        },
      },
      include: { versions: true },
    });
    const contractFile = await createPrivateAsset({
      agencyId: agency.id,
      userId: admin.id,
      storageKey: `${agency.id}/${marker}-contract.pdf`,
      originalName: "warm-contract.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.7\nAjer warm contract"),
    });
    storagePaths.push(contractFile.absolutePath);
    await db.contractAttachment.create({
      data: {
        contractId: contract.id,
        versionId: contract.versions[0].id,
        assetId: contractFile.asset.id,
        kind: "SIGNED_COPY",
        title: "نسخه امضاشده تست گرم",
      },
    });
    await db.$transaction([
      db.deal.update({ where: { id: deal.id }, data: { status: "CONTRACTED" } }),
      db.dealStatusHistory.create({
        data: {
          dealId: deal.id,
          changedById: admin.id,
          fromStatus: "AGREED",
          toStatus: "CONTRACTED",
          note: marker,
        },
      }),
    ]);
    console.log("✓ پرونده حقوقی، چک‌لیست، امضا، شاهد، تعهد و پیوست تکمیل شدند.");

    await ensureDefaultAccounting(agency.id);
    const [bank, cash, incomeCategory, commissionCategory] = await Promise.all([
      db.financialAccount.findUnique({
        where: { agencyId_code: { agencyId: agency.id, code: "BANK" } },
      }),
      db.financialAccount.findUnique({
        where: { agencyId_code: { agencyId: agency.id, code: "CASH" } },
      }),
      db.financeCategory.findFirst({
        where: { agencyId: agency.id, name: "درآمد کمیسیون", type: "INCOME" },
      }),
      db.financeCategory.findFirst({
        where: { agencyId: agency.id, name: "پورسانت پرسنل", type: "EXPENSE" },
      }),
    ]);
    assert(bank && cash && incomeCategory, "حساب‌های مالی پایه ساخته نشدند.");
    const receipt = await db.dealReceipt.create({
      data: {
        agencyId: agency.id,
        dealId: deal.id,
        payerContactId: applicant.id,
        receiptNumber: `RC-${marker}`,
        type: "COMMISSION",
        status: "CLEARED",
        method: "TRANSFER",
        amountToman: commission.totalAmountToman,
        paidAt: new Date(),
        reference: marker,
      },
    });
    await db.financeTransaction.create({
      data: {
        agencyId: agency.id,
        transactionNumber: newFinanceTransactionNumber("WARM-IN"),
        type: "INCOME",
        amountToman: commission.totalAmountToman,
        destinationAccountId: bank.id,
        categoryId: incomeCategory.id,
        contactId: applicant.id,
        propertyId: property.id,
        dealId: deal.id,
        dealReceiptId: receipt.id,
        createdById: admin.id,
        occurredAt: new Date(),
        description: `وصول کمیسیون ${marker}`,
      },
    });
    const agentAllocation = deal.commission.allocations.find(
      (allocation) => allocation.userId === agent.id,
    );
    assert(agentAllocation, "سهم مشاور برای تسویه پیدا نشد.");
    await db.$transaction([
      db.commissionAllocation.update({
        where: { id: agentAllocation.id },
        data: { status: "PAID", paidAt: new Date() },
      }),
      db.financeTransaction.create({
        data: {
          agencyId: agency.id,
          transactionNumber: newFinanceTransactionNumber("WARM-COM"),
          type: "COMMISSION",
          amountToman: agentAllocation.amountToman,
          sourceAccountId: cash.id,
          categoryId: commissionCategory?.id,
          employeeId: agent.id,
          dealId: deal.id,
          commissionAllocationId: agentAllocation.id,
          createdById: admin.id,
          occurredAt: new Date(),
          description: `تسویه سهم مشاور ${marker}`,
        },
      }),
      db.dealCommission.update({
        where: { id: deal.commission.id },
        data: {
          status: "RECEIVED",
          receivedAmountToman: commission.totalAmountToman,
        },
      }),
    ]);
    await db.$transaction([
      db.deal.update({ where: { id: deal.id }, data: { status: "COMPLETED" } }),
      db.dealStatusHistory.create({
        data: {
          dealId: deal.id,
          changedById: admin.id,
          fromStatus: "CONTRACTED",
          toStatus: "COMPLETED",
          note: marker,
        },
      }),
      db.property.update({ where: { id: property.id }, data: { status: "SOLD" } }),
      db.requirement.update({
        where: { id: requirement.id },
        data: { status: "FULFILLED" },
      }),
    ]);
    console.log("✓ کمیسیون وصول، سهم مشاور تسویه و معامله نهایی شد.");

    const token = randomUUID().replaceAll("-", "");
    await db.authSession.create({
      data: {
        tokenHash: hashToken(token),
        agencyId: agency.id,
        userId: admin.id,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const headers = { Cookie: `ajer_session=${token}` };
    const pages = [
      "/dashboard",
      `/contacts/${owner.id}`,
      `/properties/${property.id}`,
      "/visits",
      "/offers",
      `/deals/${deal.id}`,
      `/deals/${deal.id}/legal`,
      `/deals/${deal.id}/contract/print`,
      "/commissions",
      "/accounting",
      "/reports?period=30",
    ];
    for (const page of pages) {
      const response = await fetch(`${baseUrl}${page}`, {
        headers,
        redirect: "manual",
      });
      if (response.status !== 200)
        throw new Error(`صفحه ${page} پاسخ ${response.status} داد.`);
    }
    const exportResponse = await fetch(`${baseUrl}/api/export/properties`, {
      headers,
      redirect: "manual",
    });
    const csv = await exportResponse.text();
    assert(
      exportResponse.status === 200 && csv.includes(marker),
      "خروجی پرونده تست گرم ناموفق بود.",
    );

    const result = await db.deal.findUnique({
      where: { id: deal.id },
      include: {
        property: true,
        commission: { include: { allocations: true } },
        contract: {
          include: {
            parties: true,
            checklist: true,
            versions: true,
            witnesses: true,
            obligations: true,
            attachments: true,
          },
        },
        receipts: true,
        statusHistory: true,
        financeTransactions: true,
      },
    });
    assert(result?.status === "COMPLETED", "وضعیت معامله نهایی نیست.");
    assert(result.property.status === "SOLD", "فایل ملک فروخته‌شده نیست.");
    assert(result.commission?.status === "RECEIVED", "کمیسیون وصول نشده است.");
    assert(
      result.commission.allocations.some(
        (allocation) => allocation.userId === agent.id && allocation.status === "PAID",
      ),
      "سهم مشاور تسویه نشده است.",
    );
    assert(result.contract?.signedAt, "قرارداد امضا نشده است.");
    assert(result.contract.checklist.every((item) => item.status === "VERIFIED"), "چک‌لیست حقوقی ناقص است.");
    assert(result.receipts.length === 1, "رسید وصول معامله ناقص است.");
    assert(result.financeTransactions.length === 2, "گردش مالی معامله ناقص است.");
    assert(result.statusHistory.length === 3, "تاریخچه وضعیت معامله ناقص است.");
    console.log("✓ صفحات واقعی داشبورد، CRM، معامله، حقوقی، مالی و گزارش با موفقیت رندر شدند.");
    console.log(`Warm test passed: ${marker}`);
  } finally {
    if (agencyId) {
      await db.financeTransaction.deleteMany({ where: { agencyId } });
      await db.deal.deleteMany({ where: { agencyId } });
      await db.smsDispatch.deleteMany({ where: { agencyId } });
      await db.workTask.deleteMany({ where: { agencyId } });
      await db.salesOffer.deleteMany({ where: { agencyId } });
      await db.visit.deleteMany({ where: { agencyId } });
      await db.activity.deleteMany({ where: { agencyId } });
      await db.requirement.deleteMany({ where: { agencyId } });
      await db.propertyMedia.deleteMany({ where: { agencyId } });
      await db.fileAsset.deleteMany({ where: { agencyId } });
      await db.property.deleteMany({ where: { agencyId } });
      await db.contact.deleteMany({ where: { agencyId } });
      await db.commissionPolicy.deleteMany({ where: { agencyId } });
      await db.auditLog.deleteMany({ where: { agencyId } });
      await db.user.deleteMany({ where: { agencyId } });
      await db.agency.deleteMany({ where: { id: agencyId } });
    }
    for (const storagePath of storagePaths)
      await unlink(storagePath).catch(() => undefined);
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
