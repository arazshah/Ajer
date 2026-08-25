import {
  Bot,
  CalendarClock,
  Check,
  CreditCard,
  ShieldCheck,
  Landmark,
  Upload,
  FileText,
  XCircle,
} from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAgencyEntitlement } from "@/lib/entitlements";
import { formatDate } from "@/lib/format";
import { formatToman } from "@/lib/plans";
import { PaymentButton } from "@/components/payment-button";
import { getPlatformSettings } from "@/lib/platform-settings";
import { JalaliDateInput } from "@/components/jalali-date-input";
import {
  billingRequestBadge,
  billingRequestStatusLabels,
  manualPaymentLabels,
} from "@/lib/billing";
import { cancelBillingRequest } from "@/app/billing-actions";

export const metadata = { title: "اشتراک و پرداخت" };

const messages: Record<string, string> = {
  success: "پرداخت با موفقیت تأیید و اشتراک شما فعال شد.",
  canceled: "پرداخت لغو شد و مبلغی از حساب شما کسر نشده است.",
  failed: "تأیید پرداخت انجام نشد؛ در صورت کسر وجه با پشتیبانی در تماس باشید.",
  invalid: "اطلاعات بازگشت از درگاه معتبر نبود.",
};
const requestMessages: Record<string, string> = {
  created: "درخواست تمدید ثبت شد و در صف بررسی سوپرادمین قرار گرفت.",
  canceled: "درخواست تمدید لغو شد.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAuthenticatedUser();
  const query = await searchParams;
  const [plans, entitlement, payments, requests, settings] = await Promise.all([
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
    db.billingRequest.findMany({
      where: { agencyId: user.agencyId },
      include: { plan: true, receiptAsset: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getPlatformSettings(),
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
      {query.request && requestMessages[query.request] && (
        <div className="p-4 rounded-2xl mb-5 bg-emerald-50 text-emerald-800">
          {requestMessages[query.request]}
        </div>
      )}
      {query.requestError && (
        <div className="p-4 rounded-2xl mb-5 bg-red-50 text-red-800">
          {query.requestError}
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
      {settings.billing.manualEnabled && (
        <section className="card p-5 mb-6 border-amber-200 bg-gradient-to-l from-amber-50 to-white">
          <div className="flex gap-3 items-start">
            <Landmark className="text-amber-700 shrink-0" />
            <div className="flex-1">
              <h2 className="font-black text-lg">تمدید با بررسی دستی</h2>
              <p className="subtle mt-1 leading-7">{settings.billing.instructions}</p>
              {(settings.billing.accountHolder || settings.billing.cardNumber || settings.billing.iban) && (
                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  {settings.billing.accountHolder && <div className="rounded-xl bg-white border p-3"><small className="subtle block">صاحب حساب</small><b>{settings.billing.accountHolder}</b></div>}
                  {settings.billing.cardNumber && <div className="rounded-xl bg-white border p-3"><small className="subtle block">شماره کارت</small><b className="ltr block text-right">{settings.billing.cardNumber}</b></div>}
                  {settings.billing.iban && <div className="rounded-xl bg-white border p-3"><small className="subtle block">شماره شبا</small><b className="ltr block text-right">{settings.billing.iban}</b></div>}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
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
              <div className="grid gap-2 mt-5">
                {settings.billing.manualEnabled && (
                  <details className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <summary className="font-black cursor-pointer list-none text-center">
                      ثبت درخواست تمدید
                    </summary>
                    <form action="/api/billing/requests" method="post" encType="multipart/form-data" className="grid gap-3 mt-4 text-right">
                      <input type="hidden" name="planId" value={plan.id} />
                      <label className="flex gap-2 items-start"><input className="mt-1" type="checkbox" name="aiEnabled" /><span><b className="block">افزودن AI</b><small className="subtle">{formatToman(plan.aiPriceToman)}</small></span></label>
                      <label><span className="label">روش پرداخت/درخواست</span><select className="select" name="method" defaultValue="REQUEST_CONTACT"><option value="REQUEST_CONTACT">درخواست تماس</option><option value="BANK_TRANSFER">واریز بانکی</option><option value="CARD_TO_CARD">کارت‌به‌کارت</option><option value="CASH">پرداخت نقدی</option><option value="OTHER">سایر روش‌ها</option></select></label>
                      <label><span className="label">نام واریزکننده</span><input className="input" name="payerName" /></label>
                      <label><span className="label">کد پیگیری</span><input className="input ltr text-right" name="referenceCode" /></label>
                      <label><span className="label">تاریخ واریز</span><JalaliDateInput name="transferDate" /></label>
                      <label><span className="label">فیش (اختیاری)</span><input className="input" type="file" name="receipt" accept="image/jpeg,image/png,image/webp,application/pdf" /><small className="subtle block mt-1">تصویر یا PDF تا ۵ مگابایت</small></label>
                      <label><span className="label">توضیحات</span><textarea className="textarea" name="notes" rows={3} /></label>
                      <button className="btn btn-primary"><Upload size={16} /> ارسال برای بررسی</button>
                    </form>
                  </details>
                )}
                {settings.billing.onlineEnabled && <PaymentButton planId={plan.id} />}
              </div>
            ) : (
              <p className="toast-note mt-4">خرید فقط توسط مدیر دفتر</p>
            )}
          </article>
        ))}
      </div>
      {requests.length > 0 && (
        <section className="mt-7">
          <h2 className="font-black text-lg mb-3 flex gap-2"><FileText /> درخواست‌های تمدید</h2>
          <div className="card table-wrap"><table className="data-table"><thead><tr><th>تاریخ</th><th>پلن و روش</th><th>مبلغ</th><th>وضعیت</th><th>فیش/پیگیری</th><th></th></tr></thead><tbody>
            {requests.map((item) => <tr key={item.id}>
              <td>{formatDate(item.createdAt)}</td>
              <td><b>{item.plan.title}{item.aiEnabled ? " + AI" : ""}</b><small className="block subtle">{manualPaymentLabels[item.method]}</small></td>
              <td>{formatToman(item.requestedAmountToman)}</td>
              <td><span className={`badge ${billingRequestBadge(item.status)}`}>{billingRequestStatusLabels[item.status]}</span>{item.reviewNote && <small className="block subtle mt-1 max-w-xs">{item.reviewNote}</small>}{item.approvedEndsAt && <small className="block text-emerald-700 mt-1">فعال تا {formatDate(item.approvedEndsAt)}</small>}</td>
              <td>{item.receiptAsset && <a className="btn p-2 ml-1" href={`/api/billing/receipts/${item.id}`} target="_blank" rel="noreferrer">فیش</a>}<span className="ltr inline-block">{item.referenceCode || "—"}</span></td>
              <td>{["PENDING", "NEEDS_INFO"].includes(item.status) && <form action={cancelBillingRequest.bind(null, item.id)}><button className="btn p-2 text-red-700"><XCircle size={15} /> لغو</button></form>}</td>
            </tr>)}
          </tbody></table></div>
        </section>
      )}
      {payments.length > 0 && (
        <section className="mt-7">
          <h2 className="font-black text-lg mb-3 flex gap-2">
            <CreditCard /> سوابق پرداخت آنلاین
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
