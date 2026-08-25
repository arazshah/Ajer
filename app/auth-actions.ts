"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { normalizeMobile } from "@/lib/format";
import { sendWelcomeSms } from "@/lib/sms-ir";
import { getPlatformSettings } from "@/lib/platform-settings";
import {
  DEFAULT_FINANCE_CATEGORIES,
  DEFAULT_FINANCIAL_ACCOUNTS,
} from "@/lib/accounting";
import { getClientContext, recordSecurityEvent } from "@/lib/security";

const signupSchema = z.object({
  agencyName: z.string().trim().min(3, "نام دفتر املاک را کامل وارد کنید."),
  fullName: z.string().trim().min(3, "نام و نام خانوادگی را کامل وارد کنید."),
  email: z.string().trim().toLowerCase().email("ایمیل معتبر وارد کنید."),
  mobile: z.string().transform((value) => normalizeMobile(value)),
  city: z.string().trim().min(2, "شهر را وارد کنید."),
  address: z.string().trim().min(5, "نشانی دفتر را کامل‌تر وارد کنید."),
  password: z
    .string()
    .min(10, "رمز عبور باید حداقل ۱۰ نویسه باشد.")
    .regex(/[A-Za-z]/, "رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.")
    .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد.")
    .regex(/[^A-Za-z0-9]/, "رمز عبور باید حداقل یک نویسه ویژه داشته باشد."),
});

export type SignupState = { error?: string } | null;

export async function signupAction(
  _: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const { platform } = await getPlatformSettings();
  if (!platform.signupEnabled)
    return { error: "ثبت‌نام جدید موقتاً توسط مدیر سامانه غیرفعال شده است." };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  if (!/^09\d{9}$/.test(input.mobile))
    return { error: "شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم باشد." };
  if (await db.user.findUnique({ where: { email: input.email } }))
    return { error: "این ایمیل قبلاً در آجر ثبت شده است." };

  const trialEndsAt = new Date(
    Date.now() + platform.trialDays * 24 * 60 * 60 * 1000,
  );
  const user = await db.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: {
        slug: `ajer-${Date.now().toString(36)}`,
        name: input.agencyName,
        phone: input.mobile,
        address: input.address,
        city: input.city,
        trialEndsAt,
        settings: {
          create: [
            { key: "currency", value: "تومان" },
            { key: "propertyCodePrefix", value: "AJ" },
          ],
        },
        financialAccounts: { create: DEFAULT_FINANCIAL_ACCOUNTS },
        financeCategories: {
          create: DEFAULT_FINANCE_CATEGORIES.map((item) => ({
            ...item,
            isSystem: true,
          })),
        },
      },
    });
    const createdUser = await tx.user.create({
      data: {
        agencyId: agency.id,
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: "ADMIN",
      },
    });
    await tx.employeeProfile.create({
      data: {
        agencyId: agency.id,
        userId: createdUser.id,
        employeeCode: `OWN-${createdUser.id.slice(-6).toUpperCase()}`,
        personnelType: "OWNER",
        jobTitle: "مدیر و مالک دفتر",
        defaultCommissionBasisPoints: 0,
      },
    });
    return createdUser;
  });
  await recordSecurityEvent({
    eventType: "ACCOUNT_CREATED",
    success: true,
    context: await getClientContext(),
    agencyId: user.agencyId,
    userId: user.id,
  });
  await createSession(user.id);
  await sendWelcomeSms(input.mobile, input.fullName, {
    agencyId: user.agencyId,
    userId: user.id,
    entityType: "User",
    entityId: user.id,
  }).catch((error) => console.error("Welcome SMS failed", error));
  redirect("/dashboard?welcome=1");
}
