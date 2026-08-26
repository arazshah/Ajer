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
import {
  manualSubscriptionAmounts,
  manualSubscriptionWindow,
} from "@/lib/manual-billing";
import { sendPaymentSms } from "@/lib/sms-ir";

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

const optionalHttpUrl = z.union([z.literal(""), optionalUrl]);

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
    return {
      error: "ورود مدیریت موقتاً قفل شده است؛ ۱۵ دقیقه دیگر تلاش کنید.",
    };
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
  if (status === "SUSPENDED")
    await revokeAgencySessions(String(formData.get("agencyId")));
  await recordSecurityEvent({
    eventType:
      status === "SUSPENDED" ? "AGENCY_SUSPENDED" : "AGENCY_STATUS_CHANGED",
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

export async function reviewBillingRequest(formData: FormData) {
  const admin = await requireSuperAdmin();
  const requestId = text(formData, "requestId");
  const decision = text(formData, "decision");
  const reviewNote = text(formData, "reviewNote").slice(0, 1500);
  if (!["APPROVED", "REJECTED", "NEEDS_INFO"].includes(decision)) return;
  const request = await db.billingRequest.findUnique({
    where: { id: requestId },
    include: { agency: true },
  });
  if (!request || !["PENDING", "NEEDS_INFO"].includes(request.status))
    redirect("/super-admin?section=billing&billing=stale&billingFilter=open");

  if (decision !== "APPROVED") {
    if (reviewNote.length < 3)
      redirect("/super-admin?section=billing&billing=note&billingFilter=open");
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.id}))`;
      return tx.billingRequest.updateMany({
        where: {
          id: request.id,
          status: { in: ["PENDING", "NEEDS_INFO"] },
        },
        data: {
          status: decision as "REJECTED" | "NEEDS_INFO",
          reviewNote,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
    });
    if (!updated.count)
      redirect("/super-admin?section=billing&billing=stale&billingFilter=open");
    const owner = await db.user.findFirst({
      where: { agencyId: request.agencyId, role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (owner)
      await db.notification.create({
        data: {
          userId: owner.id,
          title:
            decision === "REJECTED"
              ? "درخواست تمدید رد شد"
              : "اطلاعات تکمیلی تمدید",
          message: reviewNote,
          link: "/billing",
        },
      });
    await recordSecurityEvent({
      eventType: `BILLING_REQUEST_${decision}`,
      success: true,
      context: await getClientContext(),
      superAdminId: admin.id,
      agencyId: request.agencyId,
      metadata: { requestId: request.id },
    });
    revalidatePath("/super-admin");
    revalidatePath("/billing");
    redirect(
      `/super-admin?section=billing&billing=${decision.toLowerCase()}&billingFilter=open`,
    );
  }

  const durationDays = Number(text(formData, "durationDays"));
  const approvedAmountToman = Number(text(formData, "approvedAmountToman"));
  const aiEnabled = formData.get("aiEnabled") === "on";
  if (
    !Number.isSafeInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 3650 ||
    !Number.isSafeInteger(approvedAmountToman) ||
    approvedAmountToman < 0
  )
    redirect("/super-admin?section=billing&billing=invalid&billingFilter=open");

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${request.id}))`;
    const fresh = await tx.billingRequest.findUnique({
      where: { id: request.id },
    });
    if (!fresh || !["PENDING", "NEEDS_INFO"].includes(fresh.status))
      return null;
    const current = await tx.subscription.findFirst({
      where: {
        agencyId: request.agencyId,
        status: "ACTIVE",
        endsAt: { gt: now },
      },
      orderBy: { endsAt: "desc" },
    });
    const { startsAt, endsAt } = manualSubscriptionWindow(
      now,
      current?.endsAt,
      durationDays,
    );
    const amounts = manualSubscriptionAmounts(
      approvedAmountToman,
      request.aiAmountToman,
      aiEnabled,
    );
    const subscription = await tx.subscription.create({
      data: {
        agencyId: request.agencyId,
        planId: request.planId,
        startsAt,
        endsAt,
        aiEnabled,
        ...amounts,
      },
    });
    await tx.billingRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        subscriptionId: subscription.id,
        approvedAmountToman,
        aiEnabled,
        reviewNote: reviewNote || null,
        approvedStartsAt: startsAt,
        approvedEndsAt: endsAt,
        reviewedById: admin.id,
        reviewedAt: now,
      },
    });
    await tx.agency.update({
      where: { id: request.agencyId },
      data: { status: "ACTIVE" },
    });
    await tx.auditLog.create({
      data: {
        agencyId: request.agencyId,
        entityType: "BillingRequest",
        entityId: request.id,
        action: "APPROVE_MANUAL_BILLING_REQUEST",
        changesJson: JSON.stringify({
          durationDays,
          approvedAmountToman,
          aiEnabled,
        }),
      },
    });
    return { startsAt, endsAt };
  });
  if (!result)
    redirect("/super-admin?section=billing&billing=stale&billingFilter=open");
  const owner = await db.user.findFirst({
    where: { agencyId: request.agencyId, role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (owner) {
    await db.notification.create({
      data: {
        userId: owner.id,
        title: "اشتراک دفتر فعال شد",
        message: `درخواست تمدید تأیید و ${durationDays.toLocaleString("fa-IR")} روز دسترسی فعال شد.`,
        link: "/billing",
      },
    });
    await sendPaymentSms(owner.mobile, durationDays, {
      agencyId: request.agencyId,
      userId: owner.id,
      entityType: "BillingRequest",
      entityId: request.id,
    }).catch((error) => console.error("Manual billing SMS failed", error));
  }
  await recordSecurityEvent({
    eventType: "BILLING_REQUEST_APPROVED",
    success: true,
    context: await getClientContext(),
    superAdminId: admin.id,
    agencyId: request.agencyId,
    metadata: {
      requestId: request.id,
      durationDays,
      approvedAmountToman,
      aiEnabled,
    },
  });
  revalidatePath("/super-admin");
  revalidatePath("/billing");
  redirect("/super-admin?section=billing&billing=approved&billingFilter=open");
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

export async function updateDemoRequestAction(formData: FormData) {
  await requireSuperAdmin();
  const requestId = text(formData, "requestId");
  const status = text(formData, "status");
  const followUpNote = text(formData, "followUpNote").slice(0, 1500);
  const allowed = [
    "NEW",
    "CONTACTED",
    "DEMO_SCHEDULED",
    "TRIAL_STARTED",
    "WON",
    "LOST",
    "ARCHIVED",
  ] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) return;
  await db.demoRequest.updateMany({
    where: { id: requestId },
    data: {
      status: status as (typeof allowed)[number],
      followUpNote: followUpNote || null,
      ...(["CONTACTED", "DEMO_SCHEDULED", "TRIAL_STARTED", "WON"].includes(
        status,
      )
        ? { contactedAt: new Date() }
        : {}),
    },
  });
  revalidatePath("/super-admin");
}

export async function createTestimonialAction(formData: FormData) {
  await requireSuperAdmin();
  const input = z
    .object({
      customerName: z.string().trim().min(3).max(80),
      agencyName: z.string().trim().min(2).max(120),
      city: z.string().trim().max(80),
      quote: z.string().trim().min(15).max(700),
      result: z.string().trim().max(160),
      sortOrder: z.coerce.number().int().min(0).max(999),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return;
  await db.customerTestimonial.create({
    data: {
      ...input.data,
      city: input.data.city || null,
      result: input.data.result || null,
      isPublished: formData.get("isPublished") === "on",
    },
  });
  revalidatePath("/");
  revalidatePath("/super-admin");
}

export async function updateTestimonialAction(formData: FormData) {
  await requireSuperAdmin();
  const id = text(formData, "testimonialId");
  const sortOrder = Number(text(formData, "sortOrder"));
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 999)
    return;
  await db.customerTestimonial.updateMany({
    where: { id },
    data: {
      sortOrder,
      isPublished: formData.get("isPublished") === "on",
    },
  });
  revalidatePath("/");
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
          demoVideoUrl: optionalHttpUrl,
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
          demoVideoUrl: text(formData, "demoVideoUrl"),
          trialDays: text(formData, "trialDays"),
        });
      await savePlatformSettings({
        [KEYS.platformName]: input.platformName,
        [KEYS.appUrl]: input.appUrl.replace(/\/$/, ""),
        [KEYS.supportEmail]: input.supportEmail,
        [KEYS.supportPhone]: input.supportPhone,
        [KEYS.demoVideoUrl]: input.demoVideoUrl,
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
      const mode = text(formData, "mode");
      if (!["MANUAL", "ONLINE", "BOTH"].includes(mode))
        return { error: "روش تمدید انتخاب‌شده معتبر نیست." };
      await savePlatformSettings({
        [KEYS.billingMode]: mode,
        [KEYS.paymentsEnabled]: String(mode === "ONLINE" || mode === "BOTH"),
        [KEYS.zarinpalSandbox]: String(formData.get("sandbox") === "on"),
        [KEYS.manualAccountHolder]: text(formData, "accountHolder").slice(
          0,
          120,
        ),
        [KEYS.manualCardNumber]: text(formData, "cardNumber")
          .replace(/\s/g, "")
          .slice(0, 30),
        [KEYS.manualIban]: text(formData, "iban")
          .replace(/\s/g, "")
          .slice(0, 40),
        [KEYS.manualInstructions]: text(formData, "instructions").slice(
          0,
          1500,
        ),
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
    eventType:
      section === "account"
        ? "ADMIN_ACCOUNT_UPDATED"
        : "PLATFORM_SETTING_UPDATED",
    success: true,
    context: await getClientContext(),
    superAdminId: admin.id,
    metadata: { section },
  });

  revalidatePath("/super-admin");
  revalidatePath("/signup");
  return { success: "تنظیمات با موفقیت ذخیره شد." };
}
