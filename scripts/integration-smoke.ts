import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.INTEGRATION_BASE_URL || "http://127.0.0.1:3003";

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const token = randomUUID().replaceAll("-", "");
  const passwordHash = await bcrypt.hash("Integration-smoke-2026!", 4);
  const agencyIds: string[] = [];
  const storageKeys: string[] = [];
  let superAdminId: string | undefined;
  try {
    const fixtures = [];
    for (const number of [1, 2]) {
      const agency = await db.agency.create({
        data: {
          slug: `integration-smoke-${suffix}-${number}`,
          name: `دفتر یکپارچه‌سازی ${number}`,
          phone: `0210000${suffix.slice(0, 3)}${number}`,
          address: "نشانی تست یکپارچه‌سازی",
          city: number === 1 ? "تهران" : "شیراز",
          trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          users: {
            create: {
              fullName: `مدیر تست ${number}`,
              email: `integration-${suffix}-${number}@example.test`,
              mobile: `0912111000${number}`,
              passwordHash,
              role: "ADMIN",
            },
          },
        },
        include: { users: true },
      });
      agencyIds.push(agency.id);
      const user = agency.users[0];
      const owner = await db.contact.create({
        data: {
          agencyId: agency.id,
          assignedAgentId: user.id,
          type: "OWNER",
          fullName: `مالک تست ${number}`,
          mobile: `0935111000${number}`,
        },
      });
      const property = await db.property.create({
        data: {
          agencyId: agency.id,
          assignedAgentId: user.id,
          ownerId: owner.id,
          code: `INT-${suffix}-${number}`,
          title: `ملک محرمانه دفتر ${number}`,
          description: "فایل ساختگی برای آزمون جداسازی دفاتر",
          transactionType: "SALE",
          propertyType: "APARTMENT",
          status: "ACTIVE",
          city: agency.city,
          district: "مرکزی",
          neighborhood: `محله تست ${number}`,
          address: `نشانی ملک تست ${number}`,
          latitude: 35.7 + number / 100,
          longitude: 51.4 + number / 100,
          area: 100 + number,
          bedrooms: 2,
          priceTotal: BigInt(5_000_000_000 + number),
        },
      });
      const storageKey = `${agency.id}/integration-${suffix}-${number}.png`;
      storageKeys.push(storageKey);
      const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, number]);
      const absolutePath = path.join(
        process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"),
        storageKey,
      );
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, bytes, { flag: "wx" });
      const asset = await db.fileAsset.create({
        data: {
          agencyId: agency.id,
          uploadedById: user.id,
          originalName: `integration-${number}.png`,
          storageKey,
          mimeType: "image/png",
          sizeBytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          propertyMedia: {
            create: {
              agencyId: agency.id,
              propertyId: property.id,
              title: `تصویر تست ${number}`,
              isCover: true,
            },
          },
        },
      });
      fixtures.push({ agency, user, property, asset, absolutePath });
    }

    await db.authSession.create({
      data: {
        tokenHash: tokenHash(token),
        agencyId: fixtures[0].agency.id,
        userId: fixtures[0].user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const headers = { Cookie: `ajer_session=${token}` };
    const ownFile = await fetch(
      `${baseUrl}/api/files/${fixtures[0].asset.id}`,
      { headers },
    );
    if (ownFile.status !== 200)
      throw new Error(`Own private file returned ${ownFile.status}.`);
    const foreignFile = await fetch(
      `${baseUrl}/api/files/${fixtures[1].asset.id}`,
      { headers, redirect: "manual" },
    );
    if (foreignFile.status !== 404)
      throw new Error(`Cross-tenant file returned ${foreignFile.status}.`);

    const exportResponse = await fetch(`${baseUrl}/api/export/properties`, {
      headers,
      redirect: "manual",
    });
    const csv = await exportResponse.text();
    if (
      exportResponse.status !== 200 ||
      !csv.includes(fixtures[0].property.code) ||
      csv.includes(fixtures[1].property.code)
    )
      throw new Error("Tenant-isolated property export failed.");

    const badAiRequest = await fetch(`${baseUrl}/api/ai/property-search`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "text/plain" },
      body: "آپارتمان در تهران",
    });
    if (badAiRequest.status !== 415)
      throw new Error(`AI content-type guard returned ${badAiRequest.status}.`);

    const superToken = randomUUID().replaceAll("-", "");
    const superAdmin = await db.superAdmin.create({
      data: {
        fullName: "مدیر یکپارچه‌سازی",
        email: `super-integration-${suffix}@example.test`,
        passwordHash,
      },
    });
    superAdminId = superAdmin.id;
    await db.authSession.create({
      data: {
        tokenHash: tokenHash(superToken),
        superAdminId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const superAdminPage = await fetch(`${baseUrl}/super-admin`, {
      headers: { Cookie: `ajer_super_session=${superToken}` },
      redirect: "manual",
    });
    const superAdminHtml = await superAdminPage.text();
    if (
      superAdminPage.status !== 200 ||
      !superAdminHtml.includes("پایش یکپارچه‌سازی‌ها")
    )
      throw new Error("Super-admin integration monitoring failed.");

    console.log(
      "Integration smoke passed: private file access → cross-tenant 404 → isolated CSV export → AI API guard → super-admin monitoring.",
    );
  } finally {
    if (agencyIds.length) {
      await db.propertyMedia.deleteMany({ where: { agencyId: { in: agencyIds } } });
      await db.fileAsset.deleteMany({ where: { agencyId: { in: agencyIds } } });
      await db.property.deleteMany({ where: { agencyId: { in: agencyIds } } });
      await db.contact.deleteMany({ where: { agencyId: { in: agencyIds } } });
      await db.user.deleteMany({ where: { agencyId: { in: agencyIds } } });
      await db.agency.deleteMany({ where: { id: { in: agencyIds } } });
    }
    if (superAdminId)
      await db.superAdmin.deleteMany({ where: { id: superAdminId } });
    for (const storageKey of storageKeys) {
      const absolutePath = path.join(
        process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"),
        storageKey,
      );
      await unlink(absolutePath).catch(() => undefined);
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
