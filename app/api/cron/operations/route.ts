import { timingSafeEqual } from "node:crypto";
import { processOperationsQueue } from "@/lib/operations-queue";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!secret || !token || secret.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(token));
}

export async function POST(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const [operations, expiredSessions, expiredThrottles, expiredIntegrationEvents] =
    await Promise.all([
    processOperationsQueue(),
    db.authSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
    db.loginThrottle.deleteMany({
      where: {
        updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    db.integrationEvent.deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return Response.json({
    ...operations,
    maintenance: {
      expiredSessions: expiredSessions.count,
      expiredThrottles: expiredThrottles.count,
      expiredIntegrationEvents: expiredIntegrationEvents.count,
    },
  });
}
