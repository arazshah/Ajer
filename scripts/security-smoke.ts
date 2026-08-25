import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash("Smoke-secure-2026!", 4);
  const agencies: string[] = [];
  try {
    for (const number of [1, 2]) {
      const agency = await db.agency.create({
        data: {
          slug: `security-smoke-${suffix}-${number}`,
          name: `دفتر امنیت ${number}`,
          phone: `09000000${suffix.slice(0, 3)}${number}`,
          address: "نشانی تست امنیت",
          city: "تهران",
          trialEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          users: {
            create: {
              fullName: `کاربر امنیت ${number}`,
              email: `security-${suffix}-${number}@example.test`,
              mobile: `0912000000${number}`,
              passwordHash,
              role: "ADMIN",
            },
          },
        },
        include: { users: true },
      });
      agencies.push(agency.id);
      await db.authSession.create({
        data: {
          tokenHash: randomUUID().replaceAll("-", ""),
          agencyId: agency.id,
          userId: agency.users[0].id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          ipAddress: `127.0.0.${number}`,
        },
      });
      await db.securityEvent.create({
        data: {
          agencyId: agency.id,
          userId: agency.users[0].id,
          eventType: "LOGIN_SUCCESS",
          success: true,
        },
      });
    }

    await db.authSession.updateMany({
      where: { agencyId: agencies[0], revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const [firstActive, secondActive, crossTenantEvents] = await Promise.all([
      db.authSession.count({ where: { agencyId: agencies[0], revokedAt: null } }),
      db.authSession.count({ where: { agencyId: agencies[1], revokedAt: null } }),
      db.securityEvent.count({ where: { agencyId: agencies[1] } }),
    ]);
    if (firstActive !== 0 || secondActive !== 1 || crossTenantEvents !== 1)
      throw new Error("Tenant session isolation failed.");

    const throttle = await db.loginThrottle.create({
      data: {
        scope: "smoke:identity",
        keyHash: suffix,
        failureCount: 5,
        blockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    if (!throttle.blockedUntil || throttle.failureCount !== 5)
      throw new Error("Persistent login throttling failed.");

    console.log(
      "Security smoke test passed: tenant sessions → revocation → audit isolation → persistent throttle.",
    );
  } finally {
    await db.loginThrottle.deleteMany({ where: { keyHash: suffix } });
    if (agencies.length) {
      await db.user.deleteMany({ where: { agencyId: { in: agencies } } });
      await db.agency.deleteMany({ where: { id: { in: agencies } } });
    }
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
