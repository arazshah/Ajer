"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestZarinpalPayment } from "@/lib/zarinpal";
import { getPlatformSettings } from "@/lib/platform-settings";
import { revalidatePath } from "next/cache";

export type PaymentState = { error?: string } | null;

export async function startPaymentAction(
  _: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const user = await requireAuthenticatedUser();
  if (user.role !== "ADMIN")
    return { error: "فقط مدیر دفتر می‌تواند اشتراک را خریداری کند." };
  const { platform, payments } = await getPlatformSettings();
  if (!payments.enabled)
    return { error: "پرداخت آنلاین موقتاً توسط مدیر سامانه غیرفعال شده است." };
  const plan = await db.plan.findFirst({
    where: { id: String(formData.get("planId")), isActive: true },
  });
  if (!plan) return { error: "پلن انتخاب‌شده فعال نیست." };
  const aiEnabled = formData.get("aiEnabled") === "on";
  const aiAmountToman = aiEnabled ? plan.aiPriceToman : 0;
  const payment = await db.payment.create({
    data: {
      agencyId: user.agencyId,
      planId: plan.id,
      months: plan.months,
      aiEnabled,
      baseAmountToman: plan.basePriceToman,
      aiAmountToman,
      amountToman: plan.basePriceToman + aiAmountToman,
    },
  });
  try {
    const appUrl = platform.appUrl.replace(/\/$/, "");
    if (!appUrl) throw new Error("APP_URL is not configured.");
    const gateway = await requestZarinpalPayment({
      amountToman: payment.amountToman,
      callbackUrl: `${appUrl}/api/payments/zarinpal/callback?paymentId=${payment.id}`,
      description: `اشتراک ${plan.title} آجر برای ${user.agency.name}`,
      orderId: payment.id,
      mobile: user.mobile,
      email: user.email,
      context: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "Payment",
        entityId: payment.id,
      },
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { authority: gateway.authority },
    });
    redirect(gateway.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "PAYMENT_REQUEST_FAILED" },
    });
    console.error("Payment request failed", error);
    return {
      error: "اتصال به درگاه انجام نشد؛ تنظیمات زرین‌پال را بررسی کنید.",
    };
  }
}

export async function cancelBillingRequest(requestId: string) {
  const user = await requireAuthenticatedUser();
  if (user.role !== "ADMIN") return;
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requestId}))`;
    return tx.billingRequest.updateMany({
      where: {
        id: requestId,
        agencyId: user.agencyId,
        status: { in: ["PENDING", "NEEDS_INFO"] },
      },
      data: { status: "CANCELED" },
    });
  });
  if (result.count) {
    await db.auditLog.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        entityType: "BillingRequest",
        entityId: requestId,
        action: "CANCEL_MANUAL_BILLING_REQUEST",
      },
    });
  }
  revalidatePath("/billing");
  redirect("/billing?request=canceled");
}
