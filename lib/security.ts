import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export type ClientContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export async function getClientContext(): Promise<ClientContext> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    null;
  return {
    ipAddress: ipAddress?.slice(0, 64) || null,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) || null,
  };
}

function throttleSecret() {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return secret;
}

function keyHash(value: string) {
  return createHmac("sha256", throttleSecret())
    .update(value.trim().toLowerCase())
    .digest("hex");
}

function throttleKeys(scope: string, identity: string, ipAddress: string | null) {
  return [
    { scope: `${scope}:identity`, keyHash: keyHash(identity) },
    ...(ipAddress
      ? [{ scope: `${scope}:ip`, keyHash: keyHash(ipAddress) }]
      : []),
  ];
}

export async function checkLoginThrottle(
  scope: "agency" | "super-admin",
  identity: string,
  ipAddress: string | null,
) {
  const now = new Date();
  const keys = throttleKeys(scope, identity, ipAddress);
  const rows = await db.loginThrottle.findMany({
    where: { OR: keys },
    select: { blockedUntil: true },
  });
  const blockedUntil = rows
    .map((row) => row.blockedUntil)
    .filter((value): value is Date => Boolean(value && value > now))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    blocked: Boolean(blockedUntil),
    retryAfterSeconds: blockedUntil
      ? Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000))
      : 0,
  };
}

export async function registerLoginFailure(
  scope: "agency" | "super-admin",
  identity: string,
  ipAddress: string | null,
) {
  const now = new Date();
  for (const key of throttleKeys(scope, identity, ipAddress)) {
    const current = await db.loginThrottle.findUnique({
      where: { scope_keyHash: key },
    });
    const windowExpired =
      !current || now.getTime() - current.windowStartedAt.getTime() > WINDOW_MS;
    const failureCount = windowExpired ? 1 : current.failureCount + 1;
    await db.loginThrottle.upsert({
      where: { scope_keyHash: key },
      create: {
        ...key,
        failureCount,
        windowStartedAt: now,
        blockedUntil:
          failureCount >= MAX_FAILURES
            ? new Date(now.getTime() + BLOCK_MS)
            : null,
      },
      update: {
        failureCount,
        ...(windowExpired ? { windowStartedAt: now } : {}),
        blockedUntil:
          failureCount >= MAX_FAILURES
            ? new Date(now.getTime() + BLOCK_MS)
            : current?.blockedUntil,
      },
    });
  }
}

export async function clearIdentityThrottle(
  scope: "agency" | "super-admin",
  identity: string,
) {
  await db.loginThrottle.deleteMany({
    where: { scope: `${scope}:identity`, keyHash: keyHash(identity) },
  });
}

export async function recordSecurityEvent(input: {
  eventType: string;
  success: boolean;
  context: ClientContext;
  agencyId?: string | null;
  userId?: string | null;
  superAdminId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.securityEvent.create({
    data: {
      eventType: input.eventType,
      success: input.success,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      agencyId: input.agencyId || null,
      userId: input.userId || null,
      superAdminId: input.superAdminId || null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export function loginSecurityPolicy() {
  return { maxFailures: MAX_FAILURES, windowMinutes: 15, blockMinutes: 15 };
}

export async function consumeRateLimit(input: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const hashed = keyHash(input.key);
  const current = await db.loginThrottle.findUnique({
    where: { scope_keyHash: { scope: input.scope, keyHash: hashed } },
  });
  const windowExpired =
    !current || now.getTime() - current.windowStartedAt.getTime() >= input.windowMs;
  const count = windowExpired ? 1 : current.failureCount + 1;
  const windowStartedAt = windowExpired ? now : current.windowStartedAt;
  await db.loginThrottle.upsert({
    where: { scope_keyHash: { scope: input.scope, keyHash: hashed } },
    create: {
      scope: input.scope,
      keyHash: hashed,
      failureCount: count,
      windowStartedAt,
    },
    update: {
      failureCount: count,
      ...(windowExpired ? { windowStartedAt } : {}),
    },
  });
  const resetAt = new Date(windowStartedAt.getTime() + input.windowMs);
  return {
    allowed: count <= input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
    ),
  };
}
