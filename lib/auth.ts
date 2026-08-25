import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getAgencyEntitlement } from "./entitlements";
import { getClientContext } from "./security";

const USER_COOKIE = "ajer_session";
const SUPER_COOKIE = "ajer_super_session";
const USER_SESSION_SECONDS = 8 * 60 * 60;
const SUPER_SESSION_SECONDS = 4 * 60 * 60;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

async function setSessionCookie(
  name: string,
  token: string,
  maxAge: number,
  path: string,
  sameSite: "lax" | "strict",
) {
  (await cookies()).set(name, token, {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge,
    priority: "high",
  });
}

export async function createSession(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { agencyId: true },
  });
  const context = await getClientContext();
  const token = newToken();
  await db.authSession.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      agencyId: user.agencyId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: new Date(Date.now() + USER_SESSION_SECONDS * 1000),
    },
  });
  await setSessionCookie(
    USER_COOKIE,
    token,
    USER_SESSION_SECONDS,
    "/",
    "lax",
  );
}

export async function getSessionUser() {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { agency: true } } },
  });
  if (
    !session?.user ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.user.isActive
  )
    return null;
  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE)?.value;
  if (token)
    await db.authSession.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  cookieStore.delete(USER_COOKIE);
}

export async function requireUser() {
  const user = await requireAuthenticatedUser();
  const entitlement = await getAgencyEntitlement(user.agencyId);
  if (!entitlement.active) redirect("/billing?expired=1");
  return user;
}

export async function requireAuthenticatedUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard?error=forbidden");
  return user;
}

export async function createSuperAdminSession(superAdminId: string) {
  const context = await getClientContext();
  const token = newToken();
  await db.authSession.create({
    data: {
      tokenHash: tokenHash(token),
      superAdminId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: new Date(Date.now() + SUPER_SESSION_SECONDS * 1000),
    },
  });
  await setSessionCookie(
    SUPER_COOKIE,
    token,
    SUPER_SESSION_SECONDS,
    "/super-admin",
    "strict",
  );
}

export async function getSuperAdmin() {
  const token = (await cookies()).get(SUPER_COOKIE)?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { superAdmin: true },
  });
  if (
    !session?.superAdmin ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.superAdmin.isActive
  )
    return null;
  return session.superAdmin;
}

export async function destroySuperAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_COOKIE)?.value;
  if (token)
    await db.authSession.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  cookieStore.delete(SUPER_COOKIE);
}

export async function revokeUserSessions(userId: string) {
  return db.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAgencySessions(agencyId: string) {
  return db.authSession.updateMany({
    where: { agencyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function requireSuperAdmin() {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/super-admin/login");
  return admin;
}
