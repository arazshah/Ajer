import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { addMonths } from "@/lib/plans";
import { sendPaymentSms } from "@/lib/sms-ir";
import { verifyZarinpalPayment } from "@/lib/zarinpal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");
  if (!paymentId || !authority) redirect("/billing?payment=invalid");

  const payment = await db.payment.findFirst({
    where: { id: paymentId, authority },
    include: { agency: true },
  });
  if (!payment) redirect("/billing?payment=invalid");
  if (payment.status === "PAID")
    redirect(`/billing?payment=success&ref=${payment.refId ?? ""}`);
  if (status !== "OK") {
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "CANCELED", failureReason: "USER_CANCELED" },
    });
    redirect("/billing?payment=canceled");
  }

  try {
    const verified = await verifyZarinpalPayment({
      authority,
      amountToman: payment.amountToman,
      context: {
        agencyId: payment.agencyId,
        entityType: "Payment",
        entityId: payment.id,
      },
    });
    const now = new Date();
    const subscription = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;
      const fresh = await tx.payment.findUnique({ where: { id: payment.id } });
      if (!fresh) throw new Error("Payment disappeared during verification.");
      if (fresh.status === "PAID" && fresh.subscriptionId)
        return tx.subscription.findUniqueOrThrow({
          where: { id: fresh.subscriptionId },
        });
      const current = await tx.subscription.findFirst({
        where: {
          agencyId: payment.agencyId,
          status: "ACTIVE",
          endsAt: { gt: now },
        },
        orderBy: { endsAt: "desc" },
      });
      const startsAt =
        current?.endsAt && current.endsAt > now ? current.endsAt : now;
      const created = await tx.subscription.create({
        data: {
          agencyId: payment.agencyId,
          planId: payment.planId,
          startsAt,
          endsAt: addMonths(startsAt, payment.months),
          aiEnabled: payment.aiEnabled,
          baseAmountToman: payment.baseAmountToman,
          aiAmountToman: payment.aiAmountToman,
          totalAmountToman: payment.amountToman,
        },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt: now,
          refId: verified.refId,
          subscriptionId: created.id,
        },
      });
      await tx.agency.update({
        where: { id: payment.agencyId },
        data: { status: "ACTIVE" },
      });
      return created;
    });
    const owner = await db.user.findFirst({
      where: { agencyId: payment.agencyId, role: "ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (owner) {
      await db.notification.create({
        data: {
          userId: owner.id,
          title: "اشتراک آجر فعال شد",
          message: `پرداخت با کد پیگیری ${verified.refId || "ثبت‌شده"} تأیید شد.`,
          link: "/billing",
        },
      });
      const days = Math.max(
        1,
        Math.round(
          (subscription.endsAt.getTime() - subscription.startsAt.getTime()) /
            86_400_000,
        ),
      );
      await sendPaymentSms(owner.mobile, days, {
        agencyId: payment.agencyId,
        userId: owner.id,
        entityType: "Payment",
        entityId: payment.id,
      }).catch((error) => console.error("Payment SMS failed", error));
    }
    redirect(`/billing?payment=success&ref=${verified.refId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Payment verification failed", error);
    await db.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "FAILED", failureReason: "VERIFICATION_FAILED" },
    });
    redirect("/billing?payment=failed");
  }
}
