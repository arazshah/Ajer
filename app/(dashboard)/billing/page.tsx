import {
  Bot,
  CalendarClock,
  Check,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAgencyEntitlement } from "@/lib/entitlements";
import { formatDate } from "@/lib/format";
import { formatToman } from "@/lib/plans";
import { PaymentButton } from "@/components/payment-button";

export const metadata = { title: "اشتراک و پرداخت" };

const messages: Record<string, string> = {
  success: "پرداخت با موفقیت تأیید و اشتراک شما فعال شد.",
  canceled: "پرداخت لغو شد و مبلغی از حساب شما کسر نشده است.",
  failed: "تأیید پرداخت انجام نشد؛ در صورت کسر وجه با پشتیبانی در تماس باشید.",
  invalid: "اطلاعات بازگشت از درگاه معتبر نبود.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAuthenticatedUser();
  const query = await searchParams;
  const [plans, entitlement, payments] = await Promise.all([
    db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    getAgencyEntitlement(user.agencyId),
    db.payment.findMany({
      where: { agencyId: user.agencyId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">اشتراک آجر</h1>
          <p className="subtle">مدیریت دوره آزمایشی، تمدید و افزونه هوشمند</p>
        </div>
        <span
          className={`badge ${entitlement.active ? "badge-active" : "badge-danger"}`}
        >
          {entitlement.active
            ? entitlement.source === "trial"
              ? "دوره آزمایشی"
              : "اشتراک فعال"
            : "نیازمند تمدید"}
        </span>
      </div>
      {query.payment && messages[query.payment] && (
        <div
          className={`p-4 rounded-2xl mb-5 ${query.payment === "success" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
        >
          {messages[query.payment]}{" "}
          {query.ref && (
            <span className="ltr inline-block">کد پیگیری: {query.ref}</span>
          )}
        </div>
      )}
      <div className="card p-5 mb-6 grid md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-2 flex gap-4">
          <div className="feature-icon">
            <CalendarClock />
          </div>
          <div>
            <b className="text-lg">وضعیت دسترسی دفتر</b>
            <p className="subtle mt-1">
              {entitlement.active && entitlement.endsAt
                ? `دسترسی فعلی تا ${formatDate(entitlement.endsAt)} فعال است.`
                : "دوره دسترسی شما پایان یافته؛ برای ادامه یکی از پلن‌ها را انتخاب کنید."}
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <ShieldCheck className="text-emerald-600" />
          <span>
            کاربران نامحدود
            <br />
            <small className="subtle">برای کل دفتر</small>
          </span>
        </div>
      </div>
      <div className="pricing-grid dashboard-pricing">
        {plans.map((plan) => (
          <article className={plan.isFeatured ? "featured" : ""} key={plan.id}>
            {plan.isFeatured && <span className="popular">پیشنهاد آجر</span>}
            <h3>{plan.title}</h3>
            <p>{plan.description}</p>
            <strong>{formatToman(plan.basePriceToman)}</strong>
            <small>کل دوره · کل دفتر</small>
            {plan.discountPercent > 0 && (
              <span className="discount">{plan.discountPercent}٪ تخفیف</span>
            )}
            <ul>
              <li>
                <Check /> همه امکانات CRM
              </li>
              <li>
                <Check /> کاربران نامحدود
              </li>
              <li>
                <Bot /> AI با {formatToman(plan.aiPriceToman)} اضافه
              </li>
            </ul>
            {user.role === "ADMIN" ? (
              <PaymentButton planId={plan.id} />
            ) : (
              <p className="toast-note mt-4">خرید فقط توسط مدیر دفتر</p>
            )}
          </article>
        ))}
      </div>
      {payments.length > 0 && (
        <section className="mt-7">
          <h2 className="font-black text-lg mb-3 flex gap-2">
            <CreditCard /> آخرین پرداخت‌ها
          </h2>
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
                  <th>کد پیگیری</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.createdAt)}</td>
                    <td>{formatToman(payment.amountToman)}</td>
                    <td>
                      <span
                        className={`badge ${payment.status === "PAID" ? "badge-active" : payment.status === "PENDING" ? "badge-warn" : "badge-danger"}`}
                      >
                        {payment.status === "PAID"
                          ? "موفق"
                          : payment.status === "PENDING"
                            ? "در انتظار"
                            : "ناموفق/لغو"}
                      </span>
                    </td>
                    <td className="ltr text-right">{payment.refId || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
