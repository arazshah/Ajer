"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createSuperAdminSession,
  destroySuperAdminSession,
  revokeAgencySessions,
  requireSuperAdmin,
} from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deletePlatformSetting,
  PLATFORM_SETTING_KEYS as KEYS,
  savePlatformSettings,
} from "@/lib/platform-settings";
import {
  checkLoginThrottle,
  clearIdentityThrottle,
  getClientContext,
  recordSecurityEvent,
  registerLoginFailure,
} from "@/lib/security";

const DUMMY_PASSWORD_HASH =
  "$2b$12$oM7wox6xJ2TFiU.3fj9NRexgGEUn4JVIzEcjImF6qRKdQhXFtKL6i";

export type PlatformSettingsState = { error?: string; success?: string } | null;

const optionalUrl = z
  .string()
  .trim()
  .url("نشانی واردشده معتبر نیست.")
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    {
      message: "نشانی باید با http یا https شروع شود.",
    },
  );

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message || "اطلاعات واردشده معتبر نیست.";
}

async function updateSecret(
  formData: FormData,
  field: string,
  key: (typeof KEYS)[keyof typeof KEYS],
) {
  if (formData.get(`clear_${field}`) === "on") {
    await deletePlatformSetting(key);
    return;
  }
  const value = text(formData, field);
  if (value) await savePlatformSettings({ [key]: value });
}

export async function superAdminLoginAction(
  _: { error?: string } | null,
  formData: FormData,
) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const context = await getClientContext();
  const throttle = await checkLoginThrottle(
    "super-admin",
    email,
    context.ipAddress,
  );
  if (throttle.blocked) {
    await recordSecurityEvent({
      eventType: "LOGIN_BLOCKED",
      success: false,
      context,
      metadata: { scope: "super-admin" },
    });
    return { error: "ورود مدیریت موقتاً قفل شده است؛ ۱۵ دقیقه دیگر تلاش کنید." };
  }
  const admin = await db.superAdmin.findUnique({ where: { email } });
  const passwordValid = await bcrypt.compare(
    password,
    admin?.passwordHash || DUMMY_PASSWORD_HASH,
  );
  const accountLocked = Boolean(
    admin?.lockedUntil && admin.lockedUntil > new Date(),
  );
  if (!admin || !admin.isActive || accountLocked || !passwordValid) {
    await registerLoginFailure("super-admin", email, context.ipAddress);
    if (admin) {
      const nextFailures = admin.failedLoginCount + 1;
      await db.superAdmin.update({
        where: { id: admin.id },
        data: {
          failedLoginCount: nextFailures,
          ...(nextFailures >= 5
            ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
            : {}),
        },
      });
    }
    await recordSecurityEvent({
      eventType: accountLocked ? "LOGIN_BLOCKED" : "LOGIN_FAILURE",
      success: false,
      context,
      superAdminId: admin?.id,
      metadata: { scope: "super-admin" },
    });
    return { error: "اطلاعات ورود مدیریت کل نادرست است." };
  }
  await Promise.all([
    clearIdentityThrottle("super-admin", email),
    db.superAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    }),
    recordSecurityEvent({
      eventType: "LOGIN_SUCCESS",
      success: true,
      context,
      superAdminId: admin.id,
      metadata: { scope: "super-admin" },
    }),
  ]);
  await createSuperAdminSession(admin.id);
  redirect("/super-admin");
}

export async function superAdminLogoutAction() {
  const admin = await requireSuperAdmin();
  const context = await getClientContext();
  await destroySuperAdminSession();
  await recordSecurityEvent({
    eventType: "LOGOUT",
    success: true,
    context,
    superAdminId: admin.id,
  });
  redirect("/super-admin/login");
}

export async function updateAgencyStatus(formData: FormData) {
  const admin = await requireSuperAdmin();
  const status = String(formData.get("status"));
  if (!["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED"].includes(status)) return;
  await db.agency.update({
    where: { id: String(formData.get("agencyId")) },
    data: { status: status as "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" },
  });
  if (status === "SUSPENDED") await revokeAgencySessions(String(formData.get("agencyId")));
  await recordSecurityEvent({
    eventType: status === "SUSPENDED" ? "AGENCY_SUSPENDED" : "AGENCY_STATUS_CHANGED",
    success: true,
    context: await getClientContext(),
    superAdminId: admin.id,
    agencyId: String(formData.get("agencyId")),
    metadata: { status },
  });
  revalidatePath("/super-admin");
}

export async function revokeAgencySessionsAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const agencyId = String(formData.get("agencyId") || "");
  const agency = await db.agency.findUnique({ where: { id: agencyId } });
  if (!agency) return;
  const revoked = await revokeAgencySessions(agency.id);
  await recordSecurityEvent({
    eventType: "SESSIONS_REVOKED",
    success: true,
    context: await getClientContext(),
    superAdminId: admin.id,
    agencyId: agency.id,
    metadata: { count: revoked.count },
  });
  revalidatePath("/super-admin");
}

export async function updatePlan(formData: FormData) {
  await requireSuperAdmin();
  const basePriceToman = Number(formData.get("basePriceToman"));
  const aiPriceToman = Number(formData.get("aiPriceToman"));
  const discountPercent = Number(formData.get("discountPercent"));
  if (
    !Number.isSafeInteger(basePriceToman) ||
    !Number.isSafeInteger(aiPriceToman) ||
    !Number.isSafeInteger(discountPercent) ||
    basePriceToman < 0 ||
    aiPriceToman < 0 ||
    discountPercent < 0 ||
    discountPercent > 100
  )
    return;
  await db.plan.update({
    where: { id: String(formData.get("planId")) },
    data: {
      basePriceToman,
      aiPriceToman,
      discountPercent,
      isActive: formData.get("isActive") === "on",
      isFeatured: formData.get("isFeatured") === "on",
    },
  });
  revalidatePath("/super-admin");
}

export async function updatePlatformSettings(
  _: PlatformSettingsState,
  formData: FormData,
): Promise<PlatformSettingsState> {
  const admin = await requireSuperAdmin();
  const section = text(formData, "section");

  try {
    if (section === "general") {
      const input = z
        .object({
          platformName: z
            .string()
            .trim()
            .min(2, "نام سامانه را وارد کنید.")
            .max(60),
          appUrl: optionalUrl,
          supportEmail: z.union([
            z.literal(""),
            z.string().trim().email("ایمیل پشتیبانی معتبر نیست."),
          ]),
          supportPhone: z.string().trim().max(30),
          trialDays: z.coerce
            .number()
            .int()
            .min(1, "دوره آزمایشی حداقل یک روز است.")
            .max(365, "دوره آزمایشی نمی‌تواند بیش از ۳۶۵ روز باشد."),
        })
        .parse({
          platformName: text(formData, "platformName"),
          appUrl: text(formData, "appUrl"),
          supportEmail: text(formData, "supportEmail"),
          supportPhone: text(formData, "supportPhone"),
          trialDays: text(formData, "trialDays"),
        });
      await savePlatformSettings({
        [KEYS.platformName]: input.platformName,
        [KEYS.appUrl]: input.appUrl.replace(/\/$/, ""),
        [KEYS.supportEmail]: input.supportEmail,
        [KEYS.supportPhone]: input.supportPhone,
        [KEYS.trialDays]: String(input.trialDays),
        [KEYS.signupEnabled]: String(formData.get("signupEnabled") === "on"),
      });
    } else if (section === "ai") {
      const input = z
        .object({
          baseUrl: optionalUrl,
          model: z.string().trim().min(1, "نام مدل را وارد کنید.").max(100),
        })
        .parse({
          baseUrl: text(formData, "baseUrl"),
          model: text(formData, "model"),
        });
      await savePlatformSettings({
        [KEYS.aiEnabled]: String(formData.get("enabled") === "on"),
        [KEYS.aiBaseUrl]: input.baseUrl.replace(/\/$/, ""),
        [KEYS.aiModel]: input.model,
      });
      await updateSecret(formData, "apiKey", KEYS.aiApiKey);
    } else if (section === "sms") {
      const input = z
        .object({
          baseUrl: optionalUrl,
          welcomeTemplateId: z
            .string()
            .regex(/^\d*$/, "شناسه قالب خوش‌آمد باید عدد باشد."),
          paymentTemplateId: z
            .string()
            .regex(/^\d*$/, "شناسه قالب پرداخت باید عدد باشد."),
          visitTemplateId: z
            .string()
            .regex(/^\d*$/, "شناسه قالب یادآوری بازدید باید عدد باشد."),
          offerTemplateId: z
            .string()
            .regex(/^\d*$/, "شناسه قالب وضعیت پیشنهاد باید عدد باشد."),
          passwordResetTemplateId: z
            .string()
            .regex(/^\d*$/, "شناسه قالب بازیابی رمز باید عدد باشد."),
        })
        .parse({
          baseUrl: text(formData, "baseUrl"),
          welcomeTemplateId: text(formData, "welcomeTemplateId"),
          paymentTemplateId: text(formData, "paymentTemplateId"),
          visitTemplateId: text(formData, "visitTemplateId"),
          offerTemplateId: text(formData, "offerTemplateId"),
          passwordResetTemplateId: text(formData, "passwordResetTemplateId"),
        });
      await savePlatformSettings({
        [KEYS.smsEnabled]: String(formData.get("enabled") === "on"),
        [KEYS.smsBaseUrl]: input.baseUrl.replace(/\/$/, ""),
        [KEYS.smsWelcomeTemplateId]: input.welcomeTemplateId,
        [KEYS.smsPaymentTemplateId]: input.paymentTemplateId,
        [KEYS.smsVisitTemplateId]: input.visitTemplateId,
        [KEYS.smsOfferTemplateId]: input.offerTemplateId,
        [KEYS.smsPasswordResetTemplateId]: input.passwordResetTemplateId,
      });
      await updateSecret(formData, "apiKey", KEYS.smsApiKey);
    } else if (section === "payments") {
      await savePlatformSettings({
        [KEYS.paymentsEnabled]: String(formData.get("enabled") === "on"),
        [KEYS.zarinpalSandbox]: String(formData.get("sandbox") === "on"),
      });
      await updateSecret(formData, "merchantId", KEYS.zarinpalMerchantId);
    } else if (section === "account") {
      const input = z
        .object({
          fullName: z.string().trim().min(3, "نام کامل را وارد کنید.").max(80),
          email: z.string().trim().toLowerCase().email("ایمیل معتبر نیست."),
          currentPassword: z.string().min(1, "رمز فعلی را وارد کنید."),
          newPassword: z.union([
            z.literal(""),
            z
              .string()
              .min(12, "رمز جدید باید حداقل ۱۲ نویسه باشد.")
              .regex(/[A-Za-z]/, "رمز جدید باید حرف انگلیسی داشته باشد.")
              .regex(/[0-9]/, "رمز جدید باید عدد داشته باشد.")
              .regex(/[^A-Za-z0-9]/, "رمز جدید باید نویسه ویژه داشته باشد."),
          ]),
        })
        .parse({
          fullName: text(formData, "fullName"),
          email: text(formData, "email").toLowerCase(),
          currentPassword: String(formData.get("currentPassword") || ""),
          newPassword: String(formData.get("newPassword") || ""),
        });
      if (!(await bcrypt.compare(input.currentPassword, admin.passwordHash)))
        return { error: "رمز عبور فعلی نادرست است." };
      await db.superAdmin.update({
        where: { id: admin.id },
        data: {
          fullName: input.fullName,
          email: input.email,
          ...(input.newPassword
            ? {
                passwordHash: await bcrypt.hash(input.newPassword, 12),
                passwordChangedAt: new Date(),
              }
            : {}),
        },
      });
      if (input.newPassword) {
        await db.authSession.updateMany({
          where: { superAdminId: admin.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await createSuperAdminSession(admin.id);
      }
    } else {
      return { error: "بخش تنظیمات شناخته نشد." };
    }
  } catch (error) {
    if (error instanceof z.ZodError) return { error: firstIssue(error) };
    if (error instanceof Error && error.message.includes("Unique constraint"))
      return { error: "این ایمیل قبلاً استفاده شده است." };
    console.error("Platform settings update failed", error);
    return { error: "ذخیره تنظیمات انجام نشد؛ دوباره تلاش کنید." };
  }

  await recordSecurityEvent({
    eventType: section === "account" ? "ADMIN_ACCOUNT_UPDATED" : "PLATFORM_SETTING_UPDATED",
    success: true,
    context: await getClientContext(),
    superAdminId: admin.id,
    metadata: { section },
  });

  revalidatePath("/super-admin");
  revalidatePath("/signup");
  return { success: "تنظیمات با موفقیت ذخیره شد." };
}
