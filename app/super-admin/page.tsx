import {
  Bot,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  KeyRound,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
  FileCheck2,
  Eye,
} from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatToman } from "@/lib/plans";
import { getPlatformSettings } from "@/lib/platform-settings";
import { PlatformSettingsForm } from "@/components/platform-settings-form";
import {
  superAdminLogoutAction,
  updateAgencyStatus,
  updatePlan,
  revokeAgencySessionsAction,
  reviewBillingRequest,
} from "./actions";
import {
  billingRequestBadge,
  billingRequestStatusLabels,
  manualPaymentLabels,
} from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "داشبورد مدیریت کل" };

const securityEventLabels: Record<string, string> = {
  LOGIN_SUCCESS: "ورود موفق",
  LOGIN_FAILURE: "ورود ناموفق",
  LOGIN_BLOCKED: "ورود مسدودشده",
  LOGOUT: "خروج",
  SESSIONS_REVOKED: "ابطال نشست‌ها",
  AGENCY_SUSPENDED: "تعلیق دفتر",
  AGENCY_STATUS_CHANGED: "تغییر وضعیت دفتر",
  PLATFORM_SETTING_UPDATED: "تغییر تنظیمات سراسری",
  ADMIN_ACCOUNT_UPDATED: "تغییر حساب سوپرادمین",
  BILLING_REQUEST_APPROVED: "تأیید درخواست تمدید",
  BILLING_REQUEST_REJECTED: "رد درخواست تمدید",
  BILLING_REQUEST_NEEDS_INFO: "درخواست اطلاعات تمدید",
};

function SecretField({
  name,
  label,
  configured,
  help,
}: {
  name: string;
  label: string;
  configured: boolean;
  help: string;
}) {
  return (
    <label>
      <span className="label flex items-center justify-between">
        {label}
        <span className={configured ? "text-emerald-600" : "text-amber-600"}>
          {configured ? "● تنظیم شده" : "○ تنظیم نشده"}
        </span>
      </span>
      <input
        className="input ltr text-right"
        type="password"
        name={name}
        autoComplete="new-password"
        placeholder={
          configured
            ? "برای حفظ مقدار فعلی خالی بگذارید"
            : "مقدار جدید را وارد کنید"
        }
      />
      <small className="subtle mt-1 block">{help}</small>
      {configured && (
        <span className="mt-2 flex items-center gap-2 text-xs text-red-700">
          <input type="checkbox" name={`clear_${name}`} /> حذف مقدار ذخیره‌شده
        </span>
      )}
    </label>
  );
}

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const query = await searchParams;
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [
    agencies,
    plans,
    users,
    revenue,
    manualRevenue,
    settings,
    activeSessions,
    blockedUsers,
    failedLogins,
    securityEvents,
    integrationEvents,
    billingRequests,
  ] = await Promise.all([
    db.agency.findMany({
      include: { _count: { select: { users: true, properties: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    db.user.count(),
    db.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amountToman: true },
    }),
    db.billingRequest.aggregate({
      where: { status: "APPROVED" },
      _sum: { approvedAmountToman: true },
    }),
    getPlatformSettings(),
    db.authSession.count({
      where: { revokedAt: null, expiresAt: { gt: now } },
    }),
    db.user.count({ where: { lockedUntil: { gt: now } } }),
    db.securityEvent.count({
      where: {
        success: false,
        createdAt: { gt: oneDayAgo },
      },
    }),
    db.securityEvent.findMany({
      include: {
        agency: { select: { name: true } },
        user: { select: { fullName: true } },
        superAdmin: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.integrationEvent.findMany({
      where: { createdAt: { gt: oneDayAgo } },
      include: {
        agency: { select: { name: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.billingRequest.findMany({
      include: {
        agency: { select: { name: true, phone: true } },
        requestedBy: { select: { fullName: true, mobile: true } },
        plan: { select: { title: true } },
        receiptAsset: { select: { id: true } },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      take: 100,
    }),
  ]);
  const providerStats = ["AI", "SMS_IR", "ZARINPAL"].map((provider) => {
    const events = integrationEvents.filter((event) => event.provider === provider);
    return {
      provider,
      total: events.length,
      failed: events.filter((event) => !event.success).length,
      latest: events[0]?.createdAt,
    };
  });
  return (
    <main className="min-h-screen bg-[#f4f6f9]">
      <header className="bg-ink text-white px-6 py-4 flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <ShieldCheck />
          <div>
            <b className="block">مدیریت کل آجر</b>
            <small className="text-white/50">{admin.fullName}</small>
          </div>
        </div>
        <form action={superAdminLogoutAction}>
          <button className="btn btn-dark border-white/20">
            <LogOut size={17} /> خروج
          </button>
        </form>
      </header>
      <div className="max-w-[1500px] mx-auto p-5 md:p-8">
        <nav className="card mb-6 flex gap-2 overflow-x-auto p-2 text-sm font-bold">
          <a className="btn whitespace-nowrap" href="#settings">
            <Settings2 size={16} /> تنظیمات
          </a>
          <a className="btn whitespace-nowrap" href="#agencies">
            <Building2 size={16} /> دفاتر
          </a>
          <a className="btn whitespace-nowrap" href="#billing-requests">
            <FileCheck2 size={16} /> درخواست‌های تمدید
          </a>
          <a className="btn whitespace-nowrap" href="#plans">
            <CreditCard size={16} /> پلن‌ها
          </a>
          <a className="btn whitespace-nowrap" href="#security">
            <LockKeyhole size={16} /> امنیت
          </a>
          <a className="btn whitespace-nowrap" href="#integrations">
            <Bot size={16} /> یکپارچه‌سازی‌ها
          </a>
          <a className="btn whitespace-nowrap" href="#account">
            <UserCog size={16} /> حساب من
          </a>
        </nav>
        <div className="grid-auto mb-6">
          <div className="card stat">
            <Building2 className="text-brick" />
            <strong>{agencies.length}</strong>
            <span className="subtle">دفتر ثبت‌شده</span>
          </div>
          <div className="card stat">
            <Users className="text-blue-600" />
            <strong>{users}</strong>
            <span className="subtle">کاربر پلتفرم</span>
          </div>
          <div className="card stat">
            <CreditCard className="text-emerald-600" />
            <strong>
              {formatToman(
                (revenue._sum.amountToman || 0) +
                  (manualRevenue._sum.approvedAmountToman || 0),
              )}
            </strong>
            <span className="subtle">درآمد ثبت‌شده</span>
          </div>
          <div className="card stat">
            <Bot
              className={
                settings.ai.enabled && settings.ai.configured
                  ? "text-emerald-600"
                  : "text-amber-600"
              }
            />
            <strong className="text-base">هوش مصنوعی</strong>
            <span className="subtle">
              {settings.ai.enabled && settings.ai.configured
                ? "آماده سرویس"
                : "نیازمند تنظیم"}
            </span>
          </div>
          <div className="card stat">
            <MessageSquareText
              className={
                settings.sms.enabled && settings.sms.configured
                  ? "text-emerald-600"
                  : "text-amber-600"
              }
            />
            <strong className="text-base">پیامک</strong>
            <span className="subtle">
              {settings.sms.enabled && settings.sms.configured
                ? "آماده ارسال"
                : "نیازمند تنظیم"}
            </span>
          </div>
          <div className="card stat">
            <WalletCards
              className={
                settings.billing.manualEnabled ||
                (settings.payments.enabled && settings.payments.configured)
                  ? "text-emerald-600"
                  : "text-amber-600"
              }
            />
            <strong className="text-base">تمدید</strong>
            <span className="subtle">
              {settings.billing.mode === "MANUAL"
                ? "بررسی دستی فعال"
                : settings.billing.mode === "BOTH"
                  ? "دستی و آنلاین"
                  : settings.payments.configured
                    ? "پرداخت آنلاین"
                    : "مرچنت تنظیم نشده"}
            </span>
          </div>
        </div>

        <section id="security" className="mb-10 scroll-mt-5">
          <div className="mb-4">
            <h2 className="text-2xl font-black">مرکز امنیت و نشست‌ها</h2>
            <p className="subtle mt-1">
              ورودهای ناموفق، قفل حساب و نشست‌های قابل ابطال در سراسر پلتفرم
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <div className="card stat">
              <KeyRound className="text-blue-600" />
              <strong>{activeSessions.toLocaleString("fa-IR")}</strong>
              <span className="subtle">نشست فعال</span>
            </div>
            <div className="card stat">
              <LockKeyhole className="text-amber-600" />
              <strong>{blockedUsers.toLocaleString("fa-IR")}</strong>
              <span className="subtle">حساب موقتاً قفل</span>
            </div>
            <div className="card stat">
              <ShieldCheck className="text-red-600" />
              <strong>{failedLogins.toLocaleString("fa-IR")}</strong>
              <span className="subtle">رویداد ناموفق ۲۴ ساعت اخیر</span>
            </div>
          </div>
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>رویداد</th>
                  <th>حساب / دفتر</th>
                  <th>نشانی IP</th>
                  <th>نتیجه</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>{securityEventLabels[event.eventType] || event.eventType}</td>
                    <td>
                      {event.user?.fullName || event.superAdmin?.fullName || "ناشناس"}
                      <small className="block subtle">
                        {event.agency?.name || "مدیریت کل"}
                      </small>
                    </td>
                    <td className="ltr text-right">{event.ipAddress || "—"}</td>
                    <td>
                      <span className={`badge ${event.success ? "badge-active" : "badge-danger"}`}>
                        {event.success ? "موفق" : "ناموفق"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!securityEvents.length && (
                  <tr>
                    <td colSpan={5} className="subtle text-center">
                      هنوز رویداد امنیتی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="integrations" className="mb-10 scroll-mt-5">
          <div className="mb-4">
            <h2 className="text-2xl font-black">پایش یکپارچه‌سازی‌ها</h2>
            <p className="subtle mt-1">
              نتیجه، زمان پاسخ و retry سرویس‌های AI، پیامک و زرین‌پال در ۲۴ ساعت اخیر
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-5">
            {providerStats.map((item) => (
              <div className="card p-5" key={item.provider}>
                <div className="flex items-center justify-between">
                  <b className="ltr">{item.provider}</b>
                  <span className={`badge ${item.failed ? "badge-danger" : "badge-active"}`}>
                    {item.failed ? `${item.failed.toLocaleString("fa-IR")} خطا` : "سالم"}
                  </span>
                </div>
                <strong className="mt-4 block text-2xl">
                  {item.total.toLocaleString("fa-IR")}
                </strong>
                <small className="subtle">
                  {item.latest ? `آخرین اجرا: ${formatDateTime(item.latest)}` : "هنوز اجرا نشده"}
                </small>
              </div>
            ))}
          </div>
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>سرویس</th>
                  <th>عملیات</th>
                  <th>دفتر</th>
                  <th>پاسخ / تلاش</th>
                  <th>نتیجه</th>
                </tr>
              </thead>
              <tbody>
                {integrationEvents.slice(0, 40).map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td className="ltr text-right font-bold">{event.provider}</td>
                    <td className="ltr text-right">{event.operation}</td>
                    <td>{event.agency?.name || "سراسری"}</td>
                    <td>
                      {event.latencyMs == null ? "—" : `${event.latencyMs.toLocaleString("fa-IR")} ms`}
                      <small className="block subtle">
                        {event.attempts.toLocaleString("fa-IR")} تلاش
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${event.success ? "badge-active" : "badge-danger"}`}>
                        {event.success ? "موفق" : event.errorCode || "ناموفق"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!integrationEvents.length && (
                  <tr>
                    <td colSpan={6} className="subtle text-center">
                      هنوز فراخوانی خارجی ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="settings" className="mb-10 scroll-mt-5">
          <div className="mb-4">
            <h2 className="text-2xl font-black">تنظیمات سراسری سامانه</h2>
            <p className="subtle mt-1">
              تغییرات این بخش بدون نیاز به استقرار مجدد روی همه دفاتر اعمال
              می‌شوند.
            </p>
          </div>

          <div className="grid xl:grid-cols-2 gap-5 mb-5">
            <PlatformSettingsForm section="general">
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Globe2 />
                </span>
                <div>
                  <h3 className="font-black text-lg">عمومی و ثبت‌نام</h3>
                  <p className="subtle text-sm">
                    هویت محصول، آدرس و دوره آزمایشی
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label>
                  <span className="label">نام سامانه</span>
                  <input
                    className="input"
                    name="platformName"
                    defaultValue={settings.platform.name}
                    required
                  />
                </label>
                <label>
                  <span className="label">آدرس عمومی سامانه</span>
                  <input
                    className="input ltr text-right"
                    name="appUrl"
                    type="url"
                    defaultValue={settings.platform.appUrl}
                    required
                  />
                </label>
                <label>
                  <span className="label">ایمیل پشتیبانی</span>
                  <input
                    className="input ltr text-right"
                    name="supportEmail"
                    type="email"
                    defaultValue={settings.platform.supportEmail}
                  />
                </label>
                <label>
                  <span className="label">تلفن پشتیبانی</span>
                  <input
                    className="input ltr text-right"
                    name="supportPhone"
                    defaultValue={settings.platform.supportPhone}
                  />
                </label>
                <label>
                  <span className="label">مدت آزمایش (روز)</span>
                  <input
                    className="input ltr text-right"
                    name="trialDays"
                    type="number"
                    min="1"
                    max="365"
                    defaultValue={settings.platform.trialDays}
                    required
                  />
                </label>
                <label className="mt-7 flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="signupEnabled"
                    defaultChecked={settings.platform.signupEnabled}
                  />{" "}
                  ثبت‌نام عمومی فعال باشد
                </label>
              </div>
            </PlatformSettingsForm>

            <PlatformSettingsForm section="ai">
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700">
                  <Bot />
                </span>
                <div>
                  <h3 className="font-black text-lg">هوش مصنوعی</h3>
                  <p className="subtle text-sm">
                    سرویس جست‌وجوی زبان طبیعی املاک
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={settings.ai.enabled}
                />{" "}
                قابلیت AI در کل سامانه فعال باشد
              </label>
              <SecretField
                name="apiKey"
                label="کلید API"
                configured={settings.ai.configured}
                help="کلید به‌صورت AES-256-GCM رمزنگاری می‌شود و دوباره نمایش داده نخواهد شد."
              />
              <div className="grid md:grid-cols-2 gap-4">
                <label>
                  <span className="label">Base URL</span>
                  <input
                    className="input ltr text-right"
                    name="baseUrl"
                    type="url"
                    defaultValue={settings.ai.baseUrl}
                    required
                  />
                </label>
                <label>
                  <span className="label">مدل</span>
                  <input
                    className="input ltr text-right"
                    name="model"
                    defaultValue={settings.ai.model}
                    required
                  />
                </label>
              </div>
            </PlatformSettingsForm>

            <PlatformSettingsForm section="sms">
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <MessageSquareText />
                </span>
                <div>
                  <h3 className="font-black text-lg">پیامک SMS.ir</h3>
                  <p className="subtle text-sm">
                    خوش‌آمدگویی، پرداخت، یادآوری بازدید و وضعیت پیشنهاد
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={settings.sms.enabled}
                />{" "}
                ارسال پیامک فعال باشد
              </label>
              <SecretField
                name="apiKey"
                label="API Key پیامک"
                configured={settings.sms.configured}
                help="کلید فعلی هرگز به مرورگر ارسال نمی‌شود."
              />
              <label>
                <span className="label">Base URL</span>
                <input
                  className="input ltr text-right"
                  name="baseUrl"
                  type="url"
                  defaultValue={settings.sms.baseUrl}
                  required
                />
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <label>
                  <span className="label">شناسه قالب خوش‌آمد</span>
                  <input
                    className="input ltr text-right"
                    name="welcomeTemplateId"
                    inputMode="numeric"
                    defaultValue={settings.sms.welcomeTemplateId}
                  />
                </label>
                <label>
                  <span className="label">شناسه قالب پرداخت</span>
                  <input
                    className="input ltr text-right"
                    name="paymentTemplateId"
                    inputMode="numeric"
                    defaultValue={settings.sms.paymentTemplateId}
                  />
                </label>
                <label>
                  <span className="label">شناسه قالب یادآوری بازدید</span>
                  <input
                    className="input ltr text-right"
                    name="visitTemplateId"
                    inputMode="numeric"
                    defaultValue={settings.sms.visitTemplateId}
                  />
                </label>
                <label>
                  <span className="label">شناسه قالب وضعیت پیشنهاد</span>
                  <input
                    className="input ltr text-right"
                    name="offerTemplateId"
                    inputMode="numeric"
                    defaultValue={settings.sms.offerTemplateId}
                  />
                </label>
                <label>
                  <span className="label">شناسه قالب بازیابی رمز</span>
                  <input
                    className="input ltr text-right"
                    name="passwordResetTemplateId"
                    inputMode="numeric"
                    defaultValue={settings.sms.passwordResetTemplateId}
                  />
                  <small className="subtle">قالب SMS.ir باید پارامتر CODE داشته باشد.</small>
                </label>
              </div>
            </PlatformSettingsForm>

            <PlatformSettingsForm section="payments">
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <WalletCards />
                </span>
                <div>
                  <h3 className="font-black text-lg">پرداخت و تمدید اشتراک</h3>
                  <p className="subtle text-sm">
                    درخواست دستی، فیش و درگاه آنلاین اختیاری
                  </p>
                </div>
              </div>
              <label>
                <span className="label">روش فعال تمدید</span>
                <select className="select" name="mode" defaultValue={settings.billing.mode}>
                  <option value="MANUAL">فقط درخواست و بررسی دستی</option>
                  <option value="ONLINE">فقط پرداخت آنلاین</option>
                  <option value="BOTH">هر دو روش دستی و آنلاین</option>
                </select>
              </label>
              <SecretField
                name="merchantId"
                label="Merchant ID"
                configured={settings.payments.configured}
                help="مرچنت ذخیره‌شده در رابط نمایش داده نمی‌شود."
              />
              <label className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
                <input
                  type="checkbox"
                  name="sandbox"
                  defaultChecked={settings.payments.sandbox}
                />{" "}
                حالت آزمایشی Sandbox فعال باشد
              </label>
              <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
                <label>
                  <span className="label">نام صاحب حساب</span>
                  <input className="input" name="accountHolder" defaultValue={settings.billing.accountHolder} />
                </label>
                <label>
                  <span className="label">شماره کارت</span>
                  <input className="input ltr text-right" name="cardNumber" defaultValue={settings.billing.cardNumber} />
                </label>
                <label className="md:col-span-2">
                  <span className="label">شماره شبا</span>
                  <input className="input ltr text-right" name="iban" defaultValue={settings.billing.iban} placeholder="IR..." />
                </label>
                <label className="md:col-span-2">
                  <span className="label">راهنمای پرداخت دستی</span>
                  <textarea className="textarea" name="instructions" rows={4} defaultValue={settings.billing.instructions} />
                </label>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm subtle">
                <CheckCircle2
                  className="ml-2 inline text-emerald-600"
                  size={17}
                />
                نشانی callback از «آدرس عمومی سامانه» ساخته می‌شود.
              </div>
            </PlatformSettingsForm>
          </div>

          <PlatformSettingsForm
            section="account"
            submitLabel="به‌روزرسانی حساب مالک"
            className="card p-5 md:p-6 grid gap-4 max-w-3xl"
          >
            <div
              id="account"
              className="flex items-center gap-3 border-b pb-4 scroll-mt-5"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-800">
                <UserCog />
              </span>
              <div>
                <h3 className="font-black text-lg">حساب سوپرادمین</h3>
                <p className="subtle text-sm">
                  نام، ایمیل ورود و رمز مالک پلتفرم
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <label>
                <span className="label">نام کامل</span>
                <input
                  className="input"
                  name="fullName"
                  defaultValue={admin.fullName}
                  required
                />
              </label>
              <label>
                <span className="label">ایمیل ورود</span>
                <input
                  className="input ltr text-right"
                  type="email"
                  name="email"
                  defaultValue={admin.email}
                  required
                />
              </label>
              <label>
                <span className="label">رمز عبور فعلی</span>
                <input
                  className="input ltr text-right"
                  type="password"
                  name="currentPassword"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                <span className="label">رمز جدید (اختیاری)</span>
                <input
                  className="input ltr text-right"
                  type="password"
                  name="newPassword"
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
            </div>
          </PlatformSettingsForm>
        </section>

        <section id="billing-requests" className="mb-8 scroll-mt-5">
          <div className="section-head">
            <div>
              <h2 className="text-xl font-black">درخواست‌های تمدید دستی</h2>
              <p className="subtle mt-1">
                بررسی فیش، تعیین مبلغ نهایی، مدت دسترسی و وضعیت AI
              </p>
            </div>
            <span className="badge badge-warn">
              {billingRequests.filter((item) => ["PENDING", "NEEDS_INFO"].includes(item.status)).length.toLocaleString("fa-IR")} باز
            </span>
          </div>
          {query.billing && (
            <div className={`toast-note mb-4 ${query.billing === "approved" ? "text-green-700" : query.billing === "rejected" || query.billing === "needs_info" ? "text-amber-700" : "text-red-700"}`}>
              {query.billing === "approved"
                ? "اشتراک با موفقیت فعال شد."
                : query.billing === "rejected"
                  ? "درخواست رد شد و نتیجه به مدیر دفتر اعلام شد."
                  : query.billing === "needs_info"
                    ? "نیاز به اطلاعات بیشتر برای مدیر دفتر ارسال شد."
                    : query.billing === "note"
                      ? "برای رد یا درخواست اطلاعات، توضیح بررسی را وارد کنید."
                      : query.billing === "stale"
                        ? "این درخواست قبلاً بررسی یا لغو شده است."
                        : "مقادیر مدت یا مبلغ معتبر نیست."}
            </div>
          )}
          <div className="grid gap-4">
            {billingRequests.map((item) => (
              <article className="card p-5" key={item.id}>
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 items-center">
                      <h3 className="font-black text-lg">{item.agency.name}</h3>
                      <span className={`badge ${billingRequestBadge(item.status)}`}>{billingRequestStatusLabels[item.status]}</span>
                      <span className="badge">{item.plan.title}{item.aiEnabled ? " + AI" : ""}</span>
                    </div>
                    <p className="subtle mt-2">
                      {item.requestedBy.fullName} · <span className="ltr inline-block">{item.requestedBy.mobile}</span> · {formatDateTime(item.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-3 text-sm">
                      <span><b>روش:</b> {manualPaymentLabels[item.method]}</span>
                      <span><b>مبلغ درخواستی:</b> {formatToman(item.requestedAmountToman)}</span>
                      <span><b>کد پیگیری:</b> <span className="ltr inline-block">{item.referenceCode || "—"}</span></span>
                      {item.transferDate && <span><b>تاریخ واریز:</b> {formatDate(item.transferDate)}</span>}
                    </div>
                    {item.notes && <p className="mt-3 rounded-xl bg-slate-50 p-3">{item.notes}</p>}
                    {item.receiptAsset && (
                      <a className="btn mt-3" href={`/api/super-admin/billing-receipts/${item.id}`} target="_blank" rel="noreferrer">
                        <Eye size={16} /> مشاهده فیش خصوصی
                      </a>
                    )}
                    {item.reviewNote && <p className="mt-3 text-sm"><b>نتیجه بررسی:</b> {item.reviewNote}</p>}
                    {item.approvedEndsAt && <p className="text-emerald-700 font-bold mt-2">فعال تا {formatDate(item.approvedEndsAt)} · مبلغ نهایی {formatToman(item.approvedAmountToman || 0)}</p>}
                  </div>
                  {["PENDING", "NEEDS_INFO"].includes(item.status) && (
                    <form action={reviewBillingRequest} className="grid md:grid-cols-2 gap-3 xl:w-[520px] shrink-0 rounded-2xl bg-slate-50 p-4">
                      <input type="hidden" name="requestId" value={item.id} />
                      <label><span className="label">مدت فعال‌سازی (روز)</span><input className="input ltr text-right" type="number" name="durationDays" min="1" max="3650" defaultValue={item.months * 30} required /></label>
                      <label><span className="label">مبلغ تأییدشده (تومان)</span><input className="input ltr text-right" type="number" name="approvedAmountToman" min="0" defaultValue={item.requestedAmountToman} required /></label>
                      <label className="md:col-span-2 flex gap-2 items-center rounded-xl bg-white border p-3"><input type="checkbox" name="aiEnabled" defaultChecked={item.aiEnabled} /> دسترسی AI فعال باشد</label>
                      <label className="md:col-span-2"><span className="label">توضیح بررسی</span><textarea className="textarea" name="reviewNote" rows={3} placeholder="برای رد یا درخواست اطلاعات بیشتر الزامی است" /></label>
                      <button className="btn btn-primary" name="decision" value="APPROVED">تأیید و فعال‌سازی</button>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="btn" name="decision" value="NEEDS_INFO">اطلاعات بیشتر</button>
                        <button className="btn text-red-700" name="decision" value="REJECTED">رد درخواست</button>
                      </div>
                    </form>
                  )}
                </div>
              </article>
            ))}
            {!billingRequests.length && <div className="card empty">هنوز درخواست تمدیدی ثبت نشده است.</div>}
          </div>
        </section>

        <section id="agencies" className="mb-8 scroll-mt-5">
          <h2 className="text-xl font-black mb-3">دفاتر املاک</h2>
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>دفتر</th>
                  <th>شهر</th>
                  <th>کاربران / فایل‌ها</th>
                  <th>آزمایش تا</th>
                  <th>وضعیت</th>
                  <th>کنترل نشست</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((agency) => (
                  <tr key={agency.id}>
                    <td>
                      <b>{agency.name}</b>
                      <small className="block subtle ltr text-right">
                        {agency.phone}
                      </small>
                    </td>
                    <td>{agency.city}</td>
                    <td>
                      {agency._count.users} / {agency._count.properties}
                    </td>
                    <td>{formatDate(agency.trialEndsAt)}</td>
                    <td>
                      <form action={updateAgencyStatus} className="flex gap-2">
                        <input
                          type="hidden"
                          name="agencyId"
                          value={agency.id}
                        />
                        <select
                          className="select py-2"
                          name="status"
                          defaultValue={agency.status}
                        >
                          <option value="TRIAL">آزمایشی</option>
                          <option value="ACTIVE">فعال</option>
                          <option value="PAST_DUE">بدهکار</option>
                          <option value="SUSPENDED">تعلیق</option>
                        </select>
                        <button className="btn py-2">ذخیره</button>
                      </form>
                    </td>
                    <td>
                      <form action={revokeAgencySessionsAction}>
                        <input type="hidden" name="agencyId" value={agency.id} />
                        <button className="btn py-2 text-red-700">
                          ابطال همه نشست‌ها
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section id="plans" className="scroll-mt-5">
          <h2 className="text-xl font-black mb-3">پلن‌ها و قیمت‌گذاری</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <form
                action={updatePlan}
                className="card p-5 grid gap-3"
                key={plan.id}
              >
                <input type="hidden" name="planId" value={plan.id} />
                <h3 className="font-black text-lg">{plan.title}</h3>
                <label>
                  <span className="label">قیمت پایه (تومان)</span>
                  <input
                    className="input ltr text-right"
                    type="number"
                    name="basePriceToman"
                    defaultValue={plan.basePriceToman}
                  />
                </label>
                <label>
                  <span className="label">قیمت AI (تومان)</span>
                  <input
                    className="input ltr text-right"
                    type="number"
                    name="aiPriceToman"
                    defaultValue={plan.aiPriceToman}
                  />
                </label>
                <label>
                  <span className="label">درصد تخفیف نمایشی</span>
                  <input
                    className="input ltr text-right"
                    type="number"
                    min="0"
                    max="100"
                    name="discountPercent"
                    defaultValue={plan.discountPercent}
                  />
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={plan.isActive}
                  />{" "}
                  فعال
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={plan.isFeatured}
                  />{" "}
                  پیشنهاد ویژه
                </label>
                <button className="btn btn-dark">ذخیره پلن</button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
