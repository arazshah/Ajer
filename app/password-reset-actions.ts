"use server";

import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeMobile, toEnglishDigits } from "@/lib/format";
import { consumeRateLimit, getClientContext, recordSecurityEvent } from "@/lib/security";
import { sendPasswordResetSms } from "@/lib/sms-ir";

function value(form: FormData, key: string, max = 200) {
  return String(form.get(key) || "").trim().slice(0, max);
}
function secret() {
  const result = process.env.SESSION_SECRET || "";
  if (result.length < 32) throw new Error("SESSION_SECRET is not configured.");
  return result;
}
function resetHash(userId: string, code: string) {
  return createHmac("sha256", secret()).update(`${userId}:${code}`).digest("hex");
}
function resetUrl(email: string, mobile: string, extra: string) {
  const params = new URLSearchParams({ email, mobile, [extra]: "1" });
  return `/reset-password?${params.toString()}`;
}

export async function requestPasswordReset(form: FormData) {
  const email = value(form, "email", 160).toLowerCase();
  const mobile = normalizeMobile(value(form, "mobile", 20));
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^09\d{9}$/.test(mobile))
    redirect("/forgot-password?error=input");
  const context = await getClientContext();
  const rate = await consumeRateLimit({ scope: "password-reset-request", key: `${email}:${context.ipAddress || "unknown"}`, limit: 3, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) redirect("/forgot-password?error=rate");
  const user = await db.user.findFirst({ where: { email, mobile, isActive: true } });
  if (!user) redirect(resetUrl(email, mobile, "sent"));
  const code = String(randomInt(100_000, 1_000_000));
  const challenge = await db.$transaction(async (tx) => {
    await tx.passwordResetChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
    return tx.passwordResetChallenge.create({ data: { userId: user.id, codeHash: resetHash(user.id, code), expiresAt: new Date(Date.now() + 10 * 60 * 1000), requestedIp: context.ipAddress } });
  });
  const result = await sendPasswordResetSms(user.mobile, code, {
    agencyId: user.agencyId,
    userId: user.id,
    entityType: "PasswordResetChallenge",
    entityId: challenge.id,
  });
  await recordSecurityEvent({ eventType: "PASSWORD_RESET_REQUESTED", success: result.sent, context, agencyId: user.agencyId, userId: user.id });
  if (!result.sent) {
    await db.passwordResetChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    redirect("/forgot-password?error=sms");
  }
  redirect(resetUrl(email, mobile, "sent"));
}

export async function resetPasswordWithSms(form: FormData) {
  const email = value(form, "email", 160).toLowerCase();
  const mobile = normalizeMobile(value(form, "mobile", 20));
  const code = toEnglishDigits(value(form, "code", 10)).replace(/\D/g, "");
  const password = value(form, "password", 200);
  const confirmation = value(form, "confirmation", 200);
  const base = resetUrl(email, mobile, "error");
  if (code.length !== 6 || password !== confirmation || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))
    redirect(`${base}&reason=input`);
  const context = await getClientContext();
  const rate = await consumeRateLimit({ scope: "password-reset-verify", key: `${email}:${context.ipAddress || "unknown"}`, limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) redirect(`${base}&reason=rate`);
  const user = await db.user.findFirst({ where: { email, mobile, isActive: true } });
  const challenge = user ? await db.passwordResetChallenge.findFirst({ where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, orderBy: { createdAt: "desc" } }) : null;
  const expected = user ? resetHash(user.id, code) : "";
  const valid = Boolean(challenge && expected.length === challenge.codeHash.length && timingSafeEqual(Buffer.from(expected), Buffer.from(challenge.codeHash)));
  if (!user || !challenge || !valid) {
    if (challenge) await db.passwordResetChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 }, ...(challenge.attempts >= 4 ? { consumedAt: new Date() } : {}) } });
    await recordSecurityEvent({ eventType: "PASSWORD_RESET_VERIFY_FAILED", success: false, context, agencyId: user?.agencyId, userId: user?.id });
    redirect(`${base}&reason=code`);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
    db.passwordResetChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await recordSecurityEvent({ eventType: "PASSWORD_RESET_COMPLETED", success: true, context, agencyId: user.agencyId, userId: user.id });
  redirect("/login?reset=1");
}
