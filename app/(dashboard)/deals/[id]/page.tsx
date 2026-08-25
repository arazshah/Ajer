import { notFound } from "next/navigation";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { updateDealStatus } from "@/app/actions";
import {
  addDealReceipt,
  approveDealCommission,
  markAllocationPaid,
  recalculateDealCommission,
  saveCommissionSplit,
  saveDealCommercialTerms,
} from "@/app/deal-actions";
import {
  BadgeCheck,
  Building2,
  Calculator,
  FileCheck2,
  History,
  ReceiptText,
  Scale,
  Users,
  WalletCards,
} from "lucide-react";
import { JalaliDateInput } from "@/components/jalali-date-input";

export const dynamic = "force-dynamic";

const nextStatuses = {
  NEGOTIATION: ["AGREED", "CANCELLED"],
  AGREED: ["NEGOTIATION", "CONTRACTED", "CANCELLED"],
  CONTRACTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;

export default async function DealDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePermission("deals.view");
  const { id } = await params;
  const query = await searchParams;
  const [canManageAll, canManage, canManageStatus, canManageAccounting] =
    await Promise.all([
      hasPermission(user, "deals.manage_all"),
      hasPermission(user, "deals.finance"),
      hasPermission(user, "deals.manage"),
      hasPermission(user, "accounting.manage"),
    ]);
  const [deal, policies, members] = await Promise.all([
    db.deal.findFirst({
      where: {
        id,
        agencyId: user.agencyId,
        ...(!canManageAll ? { assignedAgentId: user.id } : {}),
      },
      include: {
        property: true,
        owner: true,
        applicant: true,
        assignedAgent: true,
        contract: true,
        statusHistory: {
          include: { changedBy: true },
          orderBy: { createdAt: "desc" },
        },
        receipts: {
          include: { payerContact: true },
          orderBy: { createdAt: "desc" },
        },
        commission: {
          include: {
            policy: true,
            approvedBy: true,
            allocations: {
              include: { user: true },
              orderBy: { amountToman: "desc" },
            },
          },
        },
      },
    }),
    db.commissionPolicy.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.user.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  if (!deal) notFound();
  const compatiblePolicies = policies.filter(
    (policy) =>
      !policy.transactionType ||
      policy.transactionType === deal.property.transactionType,
  );
  const distributable = deal.commission
    ? deal.commission.ownerAmountToman +
      deal.commission.applicantAmountToman -
      deal.commission.discountToman
    : 0n;

  return (
    <>
      <div className="section-head">
        <div>
          <div className="mb-2 flex gap-2">
            <span className="badge badge-warn">{label(deal.status)}</span>
            <span className="badge">{label(deal.type)}</span>
          </div>
          <h1 className="page-title">پرونده معامله {deal.property.code}</h1>
          <p className="subtle">
            {deal.property.title} · مسئول: {deal.assignedAgent.fullName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/deals/${deal.id}/legal`}>
            <Scale size={17} /> پرونده حقوقی
          </a>
          {canManageStatus &&
            nextStatuses[deal.status].map((status) => (
              <form
                action={updateDealStatus.bind(null, deal.id, status)}
                key={status}
              >
                <button
                  className={
                    status === "CANCELLED"
                      ? "btn text-red-700"
                      : "btn btn-primary"
                  }
                >
                  {label(status)}
                </button>
              </form>
            ))}
        </div>
      </div>
      {query.error === "commission-base" && (
        <div className="toast-note mb-4 text-red-700">
          مبنای محاسبه تعرفه در معامله ثبت نشده است.
        </div>
      )}
      {query.error === "commission-split" && (
        <div className="toast-note mb-4 text-red-700">
          مجموع سهم پرسنل نمی‌تواند بیش از ۱۰۰ درصد باشد.
        </div>
      )}
      {query.error === "contract-required" && (
        <div className="toast-note mb-4 text-red-700">
          برای ورود به مرحله قرارداد، شماره و تاریخ قرارداد را ثبت کنید.
        </div>
      )}
      {query.error === "contract-date" && (
        <div className="toast-note mb-4 text-red-700">
          تاریخ قرارداد باید به‌صورت شمسی وارد شود.
        </div>
      )}
      {query.error === "legal-contract-required" && (
        <div className="toast-note mb-4 text-red-700">
          پیش از ثبت مرحله قرارداد، نسخه نهایی باید در پرونده حقوقی امضا و
          چک‌لیست الزامی تکمیل شود.
        </div>
      )}
      {query.error === "commission-approval-required" && (
        <div className="toast-note mb-4 text-red-700">
          کمیسیون باید پیش از ثبت قرارداد محاسبه و تأیید شود.
        </div>
      )}
      {query.error === "commission-receipt-required" && (
        <div className="toast-note mb-4 text-red-700">
          تکمیل معامله پس از وصول کامل کمیسیون امکان‌پذیر است.
        </div>
      )}

      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <Users className="text-brick" /> طرفین و موضوع معامله
            </h2>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <small className="subtle">مالک</small>
                <b className="block">{deal.owner.fullName}</b>
                <a className="ltr text-brick" href={`tel:${deal.owner.mobile}`}>
                  {deal.owner.mobile}
                </a>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <small className="subtle">متقاضی</small>
                <b className="block">{deal.applicant.fullName}</b>
                <a
                  className="ltr text-brick"
                  href={`tel:${deal.applicant.mobile}`}
                >
                  {deal.applicant.mobile}
                </a>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <small className="subtle">ملک</small>
                <a
                  className="block font-bold text-brick"
                  href={`/properties/${deal.propertyId}`}
                >
                  {deal.property.title}
                </a>
                <span>{label(deal.property.transactionType)}</span>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <FileCheck2 className="text-blue-600" /> شرایط مالی و ثبت قرارداد
            </h2>
            {canManage ? (
              <form action={saveDealCommercialTerms} className="grid gap-4">
                <input type="hidden" name="dealId" value={deal.id} />
                <div className="grid md:grid-cols-3 gap-3">
                  <label>
                    <span className="label">قیمت توافقی</span>
                    <input
                      className="input ltr text-right"
                      name="agreedPrice"
                      defaultValue={deal.agreedPrice?.toString()}
                    />
                  </label>
                  <label>
                    <span className="label">ودیعه</span>
                    <input
                      className="input ltr text-right"
                      name="depositAmount"
                      defaultValue={deal.depositAmount?.toString()}
                    />
                  </label>
                  <label>
                    <span className="label">اجاره ماهانه</span>
                    <input
                      className="input ltr text-right"
                      name="monthlyRent"
                      defaultValue={deal.monthlyRent?.toString()}
                    />
                  </label>
                  <label>
                    <span className="label">شماره قرارداد</span>
                    <input
                      className="input ltr text-right"
                      name="contractNumber"
                      defaultValue={
                        deal.contract?.contractNumber ||
                        deal.contractNumber ||
                        ""
                      }
                    />
                  </label>
                  <label>
                    <span className="label">تاریخ قرارداد</span>
                    <JalaliDateInput
                      name="contractDate"
                      defaultValue={
                        deal.contract?.contractDate || deal.contractDate
                      }
                    />
                  </label>
                  <label>
                    <span className="label">سامانه ثبت</span>
                    <input
                      className="input"
                      name="registrySystem"
                      defaultValue={deal.contract?.registrySystem || "کاتب"}
                    />
                  </label>
                  <label>
                    <span className="label">شناسه ثبت رسمی</span>
                    <input
                      className="input ltr text-right"
                      name="registryReference"
                      defaultValue={deal.contract?.registryReference || ""}
                    />
                  </label>
                  <label>
                    <span className="label">وضعیت ثبت</span>
                    <select
                      className="select"
                      name="registrationStatus"
                      defaultValue={
                        deal.contract?.registrationStatus || "NOT_SUBMITTED"
                      }
                    >
                      <option value="NOT_SUBMITTED">ارسال‌نشده</option>
                      <option value="DRAFT">پیش‌نویس</option>
                      <option value="SUBMITTED">ارسال‌شده</option>
                      <option value="REGISTERED">ثبت‌شده</option>
                      <option value="REJECTED">ردشده</option>
                    </select>
                  </label>
                </div>
                <label>
                  <span className="label">شروط و یادداشت قرارداد</span>
                  <textarea
                    className="textarea"
                    name="terms"
                    defaultValue={deal.contract?.terms || ""}
                  />
                </label>
                <label>
                  <span className="label">یادداشت داخلی معامله</span>
                  <textarea
                    className="textarea"
                    name="notes"
                    defaultValue={deal.notes || ""}
                  />
                </label>
                <button className="btn btn-dark justify-center">
                  ذخیره شرایط و قرارداد
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <small className="subtle">قیمت</small>
                  <b className="block">{formatMoney(deal.agreedPrice)}</b>
                </div>
                <div>
                  <small className="subtle">شماره قرارداد</small>
                  <b className="block">
                    {deal.contract?.contractNumber || "ثبت نشده"}
                  </b>
                </div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <Calculator className="text-violet-600" /> محاسبه کمیسیون
            </h2>
            {!deal.commission && !compatiblePolicies.length && (
              <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
                ابتدا از بخش «کمیسیون و تسویه» تعرفه معتبر دفتر را تعریف کنید.
              </div>
            )}
            {canManage && compatiblePolicies.length > 0 && (
              <form
                action={recalculateDealCommission}
                className="grid md:grid-cols-3 gap-3 mb-5"
              >
                <input type="hidden" name="dealId" value={deal.id} />
                <select
                  className="select md:col-span-2"
                  name="policyId"
                  defaultValue={
                    deal.commission?.policyId || compatiblePolicies[0]?.id
                  }
                >
                  {compatiblePolicies.map((policy) => (
                    <option value={policy.id} key={policy.id}>
                      {policy.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input ltr text-right"
                  name="discountToman"
                  placeholder="تخفیف (تومان)"
                  defaultValue={
                    deal.commission?.discountToman.toString() || "0"
                  }
                />
                <input
                  className="input ltr text-right md:col-span-2"
                  name="manualBaseToman"
                  placeholder="مبنای دستی؛ فقط برای تعرفه دستی"
                />
                <button className="btn btn-primary justify-center">
                  محاسبه مجدد
                </button>
              </form>
            )}
            {deal.commission && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <small className="subtle">سهم مالک</small>
                    <b className="block">
                      {formatMoney(deal.commission.ownerAmountToman)}
                    </b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <small className="subtle">سهم متقاضی</small>
                    <b className="block">
                      {formatMoney(deal.commission.applicantAmountToman)}
                    </b>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <small className="subtle">مالیات</small>
                    <b className="block">
                      {formatMoney(deal.commission.taxAmountToman)}
                    </b>
                  </div>
                  <div className="rounded-xl bg-ink p-3 text-white">
                    <small className="text-white/60">جمع نهایی</small>
                    <b className="block">
                      {formatMoney(deal.commission.totalAmountToman)}
                    </b>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3">
                  <span>
                    وصول‌شده:{" "}
                    <b>{formatMoney(deal.commission.receivedAmountToman)}</b>
                  </span>
                  <span className="badge badge-active">
                    {label(deal.commission.status)}
                  </span>
                </div>
                {canManage && deal.commission.status === "DRAFT" && (
                  <form action={approveDealCommission.bind(null, deal.id)}>
                    <button className="btn btn-dark w-full justify-center">
                      <BadgeCheck size={17} /> تأیید و قطعی‌کردن کمیسیون
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>

          {deal.commission && (
            <section className="card p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
                <Building2 className="text-amber-600" /> تقسیم سهم دفتر و پرسنل
              </h2>
              {canManage && deal.commission.status === "DRAFT" && (
                <form action={saveCommissionSplit} className="mb-5 grid gap-3">
                  <input type="hidden" name="dealId" value={deal.id} />
                  <p className="subtle text-sm">
                    مبنای تقسیم: {formatMoney(distributable)}؛ مانده تا ۱۰۰٪ سهم
                    دفتر خواهد بود.
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    {members.map((member) => {
                      const allocation = deal.commission?.allocations.find(
                        (item) => item.userId === member.id,
                      );
                      return (
                        <label key={member.id}>
                          <span className="label">
                            سهم {member.fullName} (درصد)
                          </span>
                          <input
                            className="input ltr text-right"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            name={`share_${member.id}`}
                            defaultValue={
                              allocation ? allocation.basisPoints / 100 : 0
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                  <button className="btn justify-center">
                    بازمحاسبه سهم‌ها
                  </button>
                </form>
              )}
              <div className="grid gap-2">
                {deal.commission.allocations.map((allocation) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                    key={allocation.id}
                  >
                    <div>
                      <b>{allocation.user?.fullName || "دفتر"}</b>
                      <small className="subtle mr-2">
                        {allocation.title} · {allocation.basisPoints / 100}٪
                      </small>
                    </div>
                    <div className="flex items-center gap-2">
                      <b>{formatMoney(allocation.amountToman)}</b>
                      <span className="badge">{label(allocation.status)}</span>
                      {canManageAccounting &&
                        allocation.userId &&
                        allocation.status === "APPROVED" &&
                        deal.commission?.status === "RECEIVED" && (
                          <form
                            action={markAllocationPaid.bind(
                              null,
                              allocation.id,
                            )}
                          >
                            <button className="btn p-2 text-xs">
                              ثبت تسویه
                            </button>
                          </form>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <ReceiptText className="text-emerald-600" /> دریافت‌ها و رسیدها
            </h2>
            {canManage && (
              <form
                action={addDealReceipt}
                className="grid gap-3 border-b pb-5 mb-4"
              >
                <input type="hidden" name="dealId" value={deal.id} />
                <select className="select" name="payerContactId">
                  <option value="">پرداخت‌کننده نامشخص</option>
                  <option value={deal.ownerId}>
                    مالک · {deal.owner.fullName}
                  </option>
                  <option value={deal.applicantId}>
                    متقاضی · {deal.applicant.fullName}
                  </option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select className="select" name="type">
                    <option value="COMMISSION">کمیسیون</option>
                    <option value="DEPOSIT">بیعانه/ودیعه</option>
                    <option value="RENT">اجاره</option>
                    <option value="OTHER">سایر</option>
                    <option value="REFUND">بازپرداخت</option>
                  </select>
                  <select className="select" name="method">
                    <option value="TRANSFER">واریز</option>
                    <option value="CARD">کارت</option>
                    <option value="CASH">نقد</option>
                    <option value="CHECK">چک</option>
                    <option value="OTHER">سایر</option>
                  </select>
                </div>
                <input
                  className="input ltr text-right"
                  name="amountToman"
                  placeholder="مبلغ (تومان)"
                  required
                />
                <input
                  className="input ltr text-right"
                  name="reference"
                  placeholder="شماره پیگیری"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" name="bankName" placeholder="بانک" />
                  <input
                    className="input ltr text-right"
                    name="checkNumber"
                    placeholder="شماره چک"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="cleared" defaultChecked /> وجه
                  وصول شده است
                </label>
                <button className="btn btn-primary justify-center">
                  ثبت رسید
                </button>
              </form>
            )}
            <div className="space-y-2">
              {deal.receipts.map((receipt) => (
                <div className="rounded-xl bg-slate-50 p-3" key={receipt.id}>
                  <div className="flex justify-between">
                    <b>{formatMoney(receipt.amountToman)}</b>
                    <span className="badge">{label(receipt.status)}</span>
                  </div>
                  <small className="subtle">
                    {label(receipt.type)} · {label(receipt.method)} ·{" "}
                    {receipt.receiptNumber}
                  </small>
                  {receipt.payerContact && (
                    <small className="block">
                      پرداخت‌کننده: {receipt.payerContact.fullName}
                    </small>
                  )}
                </div>
              ))}
              {!deal.receipts.length && (
                <p className="empty">رسیدی ثبت نشده است.</p>
              )}
            </div>
          </section>
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <History className="text-slate-600" /> تاریخچه وضعیت
            </h2>
            <div>
              {deal.statusHistory.map((history) => (
                <div
                  className="border-r-2 border-orange-200 pb-5 pr-4"
                  key={history.id}
                >
                  <b>
                    {history.fromStatus
                      ? `${label(history.fromStatus)} ← `
                      : ""}
                    {label(history.toStatus)}
                  </b>
                  <small className="block subtle">
                    {history.changedBy.fullName} ·{" "}
                    {formatDateTime(history.createdAt)}
                  </small>
                  {history.note && <p className="text-sm">{history.note}</p>}
                </div>
              ))}
            </div>
          </section>
          <section className="card bg-ink p-5 text-white">
            <WalletCards className="mb-3 text-orange-300" />
            <h3 className="font-black">قاعده مالی آجر</h3>
            <p className="mt-2 text-sm leading-7 text-white/65">
              کمیسیون قبل از تأیید قابل بازنگری است؛ پس از تأیید باید دریافت
              واقعی ثبت شود و تنها بعد از وصول کامل، سهم پرسنل قابل تسویه است.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
