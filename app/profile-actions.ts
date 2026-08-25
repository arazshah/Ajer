"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, revokeUserSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeMobile } from "@/lib/format";
import { getClientContext, recordSecurityEvent } from "@/lib/security";

function value(form: FormData, key: string, max = 160) {
  return String(form.get(key) || "").trim().slice(0, max);
}

export async function updateOwnProfile(form: FormData) {
  const user = await requireAuthenticatedUser();
  const fullName = value(form, "fullName", 80);
  const email = value(form, "email", 160).toLowerCase();
  const mobile = normalizeMobile(value(form, "mobile", 20));
  if (fullName.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || !/^09\d{9}$/.test(mobile))
    redirect("/profile?error=profile");
  const duplicate = await db.user.findFirst({ where: { email, id: { not: user.id } } });
  if (duplicate) redirect("/profile?error=email");
  await db.user.update({
    where: { id: user.id },
    data: { fullName, email, mobile },
  });
  await db.auditLog.create({
    data: {
      agencyId: user.agencyId,
      userId: user.id,
      entityType: "User",
      entityId: user.id,
      action: "UPDATE_OWN_PROFILE",
    },
  });
  revalidatePath("/profile");
  revalidatePath("/dashboard", "layout");
  redirect("/profile?saved=1");
}

export async function changeOwnPassword(form: FormData) {
  const user = await requireAuthenticatedUser();
  const currentPassword = value(form, "currentPassword", 200);
  const newPassword = value(form, "newPassword", 200);
  const confirmation = value(form, "confirmation", 200);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
    redirect("/profile?error=current-password");
  if (
    newPassword !== confirmation ||
    newPassword.length < 10 ||
    !/[A-Za-z]/.test(newPassword) ||
    !/\d/.test(newPassword) ||
    !/[^A-Za-z0-9]/.test(newPassword)
  )
    redirect("/profile?error=new-password");
  const context = await getClientContext();
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await recordSecurityEvent({
    eventType: "PASSWORD_CHANGED_BY_USER",
    success: true,
    context,
    agencyId: user.agencyId,
    userId: user.id,
  });
  await revokeUserSessions(user.id);
  redirect("/login?passwordChanged=1");
}
