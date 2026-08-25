import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PLANS } from "../lib/plans";
import { propertyFingerprint } from "../lib/crm";
import { ensureDefaultAccounting } from "../lib/accounting";

const db = new PrismaClient();

async function main() {
  const agencies = await db.agency.findMany({ select: { id: true } });
  for (const agency of agencies) await ensureDefaultAccounting(agency.id);

  for (const plan of DEFAULT_PLANS) {
    await db.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
  }
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "SUPER_ADMIN_EMAIL/PASSWORD are not set; super admin bootstrap skipped.",
    );
  } else if (
    password.length < 12 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  )
    throw new Error(
      "SUPER_ADMIN_PASSWORD must contain at least 12 characters, a letter, a number, and a symbol.",
    );
  else {
    const existing = await db.superAdmin.findUnique({ where: { email } });
    if (!existing) {
      await db.superAdmin.create({
        data: {
          fullName: "آراز شاه‌کرمی",
          email,
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      console.log("Super admin account initialized.");
    }
  }

  const usersWithoutProfile = await db.user.findMany({
    where: { employeeProfile: null },
  });
  for (const user of usersWithoutProfile) {
    await db.employeeProfile.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        employeeCode: `EMP-${user.id.slice(-6).toUpperCase()}`,
        personnelType:
          user.role === "ADMIN"
            ? "OWNER"
            : user.role === "MANAGER"
              ? "MANAGER"
              : "AGENT",
        defaultCommissionBasisPoints: user.role === "ADMIN" ? 0 : 5000,
      },
    });
  }

  const propertiesWithoutFingerprint = await db.property.findMany({
    where: { fingerprint: null },
    select: {
      id: true,
      agencyId: true,
      ownerId: true,
      propertyType: true,
      address: true,
      area: true,
      code: true,
    },
  });
  for (const property of propertiesWithoutFingerprint) {
    const fingerprint = propertyFingerprint(property);
    const duplicate = await db.property.findFirst({
      where: {
        agencyId: property.agencyId,
        fingerprint,
        id: { not: property.id },
      },
    });
    if (duplicate) {
      console.warn(
        `Potential duplicate property left for manual review: ${property.code}`,
      );
      continue;
    }
    await db.property.update({
      where: { id: property.id },
      data: { fingerprint },
    });
  }
}

main().finally(() => db.$disconnect());
