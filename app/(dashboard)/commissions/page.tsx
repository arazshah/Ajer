import { hasPermission, requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import {
  createCommissionPolicy,
  toggleCommissionPolicy,
} from "@/app/deal-actions";
import { Calculator, Plus, Scale, WalletCards } from "lucide-react";

export const metadata = { title: "کمیسیون و تسویه" };
export const dynamic = "force-dynamic";

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await requirePermission("commissions.view");
  const canManage = await hasPermission(user, "commissions.manage");
  const [policies, allocations, commissionStats] = await Promise.all([
    db.commissionPolicy.findMany({
      where: { agencyId: user.agencyId },
      orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }],
    }),
    db.commissionAllocation.findMany({
      where: {
        commission: { deal: { agencyId: user.agencyId } },
        ...(!canManage ? { userId: user.id } : {}),
      },
      include: {
        user: true,
        commission: { include: { deal: { include: { property: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.dealCommission.aggregate({
      where: { deal: { agencyId: user.agencyId } },
      _sum: { totalAmountToman: true, receivedAmountToman: true },
      _count: true,
    }),
  ]);
  const query = await searchParams;
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <WalletCards className="text-brick" /> کمیسیون و تسویه
          </h1>
          <p className="subtle">تعرفه‌های تاریخ‌دار، سهم تیم و وضعیت پرداخت</p>
        </div>
        {canManage && (
          <details>
            <summary className="btn btn-primary list-none cursor-pointer">
              <Plus size={17} /> تعریف تعرفه
            </summary>
            <form
              action={createCommissionPolicy}
              className="card absolute left-6 z-30 mt-2 grid w-[560px] max-w-[92vw] gap-3 p-5"
            >
              <input
                className="input"
                name="name"
                placeholder="نام تعرفه و مرجع مصوبه"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <select className="select" name="transactionType">
                  <option value="">همه انواع معامله</option>
                  <option value="SALE">فروش</option>
                  <option value="RENT">اجاره</option>
                  <option value="MORTGAGE_RENT">رهن و اجاره</option>
                  <option value="PRESALE">پیش‌فروش</option>
                </select>
                <select className="select" name="calculationBase">
                  <option value="AGREED_PRICE">قیمت توافقی معامله</option>
                  <option value="DEPOSIT_AMOUNT">مبلغ ودیعه</option>
                  <option value="MONTHLY_RENT">اجاره ماهانه</option>
                  <option value="MANUAL">مبنای دستی</option>
                </select>
                <input
                  className="input ltr text-right"
                  name="ownerRatePercent"
                  placeholder="درصد مالک؛ مثال 0.25"
                  required
                />
                <input
                  className="input ltr text-right"
                  name="applicantRatePercent"
                  placeholder="درصد متقاضی؛ مثال 0.25"
                  required
                />
                <input
                  className="input ltr text-right"
                  name="fixedOwnerAmountToman"
                  placeholder="مبلغ ثابت مالک (اختیاری)"
                />
                <input
                  className="input ltr text-right"
                  name="fixedApplicantAmountToman"
                  placeholder="مبلغ ثابت متقاضی (اختیاری)"
                />
                <input
                  className="input ltr text-right"
                  name="taxRatePercent"
                  placeholder="درصد مالیات"
                  defaultValue="0"
                  required
                />
                <input
                  className="input ltr text-right"
                  name="maximumPerSideToman"
                  placeholder="سقف هر طرف (اختیاری)"
                />
              </div>
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">
                نرخ را مطابق مصوبه معتبر محل فعالیت دفتر تعریف کنید. آجر نرخ
                قانونی را حدس یا به‌صورت ثابت تحمیل نمی‌کند.
              </p>
              <button className="btn btn-dark justify-center">
                ذخیره تعرفه
              </button>
            </form>
          </details>
        )}
      </div>
      {query.created && (
        <div className="toast-note mb-4 text-emerald-700">
          تعرفه جدید ذخیره شد.
        </div>
      )}
      <div className="grid-auto mb-5">
        <div className="card stat">
          <Calculator className="text-brick" />
          <span className="subtle">پرونده کمیسیون</span>
          <strong>{commissionStats._count}</strong>
        </div>
        <div className="card stat">
          <Scale className="text-blue-600" />
          <span className="subtle">کمیسیون محاسبه‌شده</span>
          <strong className="text-base">
            {formatMoney(commissionStats._sum.totalAmountToman)}
          </strong>
        </div>
        <div className="card stat">
          <WalletCards className="text-emerald-600" />
          <span className="subtle">وصول‌شده</span>
          <strong className="text-base">
            {formatMoney(commissionStats._sum.receivedAmountToman)}
          </strong>
        </div>
      </div>
      <section className="mb-7">
        <h2 className="mb-3 text-xl font-black">تعرفه‌های دفتر</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((policy) => (
            <article
              className={`card p-5 ${policy.isActive ? "" : "opacity-60"}`}
              key={policy.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{policy.name}</h3>
                  <p className="subtle text-sm">
                    {policy.transactionType
                      ? label(policy.transactionType)
                      : "همه معاملات"}
                  </p>
                </div>
                <span
                  className={`badge ${policy.isActive ? "badge-active" : "badge-danger"}`}
                >
                  {policy.isActive ? "فعال" : "غیرفعال"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <span>سهم مالک</span>
                <b>{policy.ownerRateBasisPoints / 100}٪</b>
                <span>سهم متقاضی</span>
                <b>{policy.applicantRateBasisPoints / 100}٪</b>
                <span>مالیات</span>
                <b>{policy.taxRateBasisPoints / 100}٪</b>
                <span>شروع اعتبار</span>
                <b>{formatDate(policy.effectiveFrom)}</b>
              </div>
              {canManage && (
                <form action={toggleCommissionPolicy.bind(null, policy.id)}>
                  <button className="btn mt-4 w-full justify-center text-xs">
                    {policy.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
                  </button>
                </form>
              )}
            </article>
          ))}
          {!policies.length && (
            <div className="empty md:col-span-2 xl:col-span-3">
              هنوز تعرفه‌ای تعریف نشده است.
            </div>
          )}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-black">سهم‌های پرسنل و دفتر</h2>
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>معامله</th>
                <th>دریافت‌کننده</th>
                <th>درصد</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a
                      className="font-bold text-brick"
                      href={`/deals/${item.commission.dealId}`}
                    >
                      {item.commission.deal.property.title}
                    </a>
                  </td>
                  <td>{item.user?.fullName || "دفتر"}</td>
                  <td>{item.basisPoints / 100}٪</td>
                  <td>{formatMoney(item.amountToman)}</td>
                  <td>
                    <span className="badge">{label(item.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!allocations.length && (
            <div className="empty">سهمی محاسبه نشده است.</div>
          )}
        </div>
      </section>
    </>
  );
}
