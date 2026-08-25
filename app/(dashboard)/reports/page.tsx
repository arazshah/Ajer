import Link from "next/link";
import {
  Activity,
  BarChart3,
  Building2,
  Clock3,
  Coins,
  ContactRound,
  Download,
  MapPinned,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { MonthlyChart, StatusChart } from "@/components/charts";
import { calculateProfitAndLoss } from "@/lib/accounting";
import { db } from "@/lib/db";
import { formatDate, formatMoney, toPersianDigits } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import {
  buildSalesFunnel,
  buildSixMonthTrend,
  conversionRate,
  rankPerformance,
} from "@/lib/reporting";

export const metadata = { title: "گزارش‌های مدیریتی" };
export const dynamic = "force-dynamic";

const periodOptions = [
  [30, "۳۰ روز"],
  [90, "۳ ماه"],
  [180, "۶ ماه"],
  [365, "یک سال"],
] as const;
const faNumber = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const percent = (value: number) => `${faNumber.format(value)}٪`;

export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requirePermission("reports.view");
  const query = await searchParams;
  const requestedPeriod = Number(query.period || 90);
  const periodDays = periodOptions.some(([days]) => days === requestedPeriod)
    ? requestedPeriod
    : 90;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 86_400_000);
  const staleBefore = new Date(now.getTime() - 30 * 86_400_000);
  const [canExport, canViewAccounting] = await Promise.all([
    hasPermission(user, "data.export"),
    hasPermission(user, "accounting.view"),
  ]);

  const [
    propertyStatuses,
    propertyTypes,
    propertiesTrend,
    dealsTrend,
    applicants,
    visits,
    offers,
    deals,
    users,
    completedActivities,
    allocations,
    neighborhoodProperties,
    staleProperties,
    openCommissions,
    openReceivables,
    financeTransactions,
  ] = await Promise.all([
    db.property.groupBy({
      by: ["status"],
      where: { agencyId: user.agencyId },
      _count: true,
    }),
    db.property.groupBy({
      by: ["propertyType"],
      where: { agencyId: user.agencyId },
      _count: true,
    }),
    db.property.findMany({
      where: {
        agencyId: user.agencyId,
        createdAt: { gte: new Date(now.getTime() - 230 * 86_400_000) },
      },
      select: { createdAt: true },
    }),
    db.deal.findMany({
      where: {
        agencyId: user.agencyId,
        status: "COMPLETED",
        createdAt: { gte: new Date(now.getTime() - 230 * 86_400_000) },
      },
      select: { createdAt: true },
    }),
    db.contact.findMany({
      where: {
        agencyId: user.agencyId,
        type: { in: ["APPLICANT", "BOTH"] },
        createdAt: { gte: periodStart },
      },
      select: { id: true, source: true, assignedAgentId: true },
    }),
    db.visit.findMany({
      where: { agencyId: user.agencyId, createdAt: { gte: periodStart } },
      select: {
        applicantId: true,
        assignedAgentId: true,
        status: true,
        property: { select: { neighborhood: true } },
      },
    }),
    db.salesOffer.findMany({
      where: { agencyId: user.agencyId, createdAt: { gte: periodStart } },
      select: {
        applicantId: true,
        createdById: true,
        status: true,
        property: { select: { neighborhood: true } },
      },
    }),
    db.deal.findMany({
      where: { agencyId: user.agencyId, createdAt: { gte: periodStart } },
      select: {
        applicantId: true,
        assignedAgentId: true,
        status: true,
        createdAt: true,
        applicant: { select: { source: true } },
        property: { select: { neighborhood: true } },
        commission: {
          select: { totalAmountToman: true, receivedAmountToman: true },
        },
        statusHistory: {
          where: { toStatus: "COMPLETED" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.user.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      select: {
        id: true,
        fullName: true,
        employeeProfile: { select: { personnelType: true } },
      },
    }),
    db.activity.findMany({
      where: {
        agencyId: user.agencyId,
        completed: true,
        occurredAt: { gte: periodStart },
      },
      select: { userId: true },
    }),
    db.commissionAllocation.findMany({
      where: {
        createdAt: { gte: periodStart },
        commission: { deal: { agencyId: user.agencyId } },
      },
      select: { userId: true, amountToman: true, status: true },
    }),
    db.property.groupBy({
      by: ["neighborhood"],
      where: { agencyId: user.agencyId },
      _count: true,
      orderBy: { _count: { neighborhood: "desc" } },
      take: 12,
    }),
    db.property.findMany({
      where: {
        agencyId: user.agencyId,
        status: "ACTIVE",
        OR: [
          { lastContactAt: { lte: staleBefore } },
          { lastContactAt: null, updatedAt: { lte: staleBefore } },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
      select: {
        id: true,
        code: true,
        title: true,
        neighborhood: true,
        updatedAt: true,
        lastContactAt: true,
        assignedAgent: { select: { fullName: true } },
        _count: { select: { visits: true } },
      },
    }),
    db.dealCommission.findMany({
      where: {
        deal: { agencyId: user.agencyId },
        status: { notIn: ["RECEIVED", "VOID"] },
      },
      select: { totalAmountToman: true, receivedAmountToman: true },
    }),
    db.financeTransaction.aggregate({
      where: {
        agencyId: user.agencyId,
        type: "RECEIVABLE",
        status: "POSTED",
      },
      _sum: { amountToman: true },
    }),
    canViewAccounting
      ? db.financeTransaction.findMany({
          where: {
            agencyId: user.agencyId,
            occurredAt: { gte: periodStart, lte: now },
          },
          select: { type: true, status: true, amountToman: true },
        })
      : Promise.resolve([]),
  ]);

  const activeApplicants = new Set([
    ...applicants.map((item) => item.id),
    ...visits.map((item) => item.applicantId),
    ...offers.map((item) => item.applicantId),
    ...deals.map((item) => item.applicantId),
  ]);
  const funnel = buildSalesFunnel([
    { key: "applicants", label: "متقاضی فعال", value: activeApplicants.size },
    {
      key: "visits",
      label: "متقاضی بازدیدشده",
      value: new Set(visits.map((item) => item.applicantId)).size,
    },
    {
      key: "offers",
      label: "دریافت‌کننده پیشنهاد",
      value: new Set(
        offers
          .filter((item) => item.status !== "DRAFT")
          .map((item) => item.applicantId),
      ).size,
    },
    {
      key: "deals",
      label: "مشتری نهایی",
      value: new Set(
        deals
          .filter((item) => item.status === "COMPLETED")
          .map((item) => item.applicantId),
      ).size,
    },
  ]);

  const staff = rankPerformance(
    users.map((member) => {
      const memberVisits = visits.filter(
        (item) => item.assignedAgentId === member.id,
      );
      const memberDeals = deals.filter(
        (item) => item.assignedAgentId === member.id,
      );
      const memberAllocations = allocations.filter(
        (item) => item.userId === member.id,
      );
      return {
        id: member.id,
        name: member.fullName,
        role: member.employeeProfile?.personnelType || "AGENT",
        leads: applicants.filter((item) => item.assignedAgentId === member.id)
          .length,
        activities: completedActivities.filter(
          (item) => item.userId === member.id,
        ).length,
        visits: memberVisits.length,
        completedVisits: memberVisits.filter(
          (item) => item.status === "COMPLETED",
        ).length,
        acceptedOffers: offers.filter(
          (item) =>
            item.createdById === member.id && item.status === "ACCEPTED",
        ).length,
        completedDeals: memberDeals.filter(
          (item) => item.status === "COMPLETED",
        ).length,
        commission: memberAllocations.reduce(
          (sum, item) => sum + item.amountToman,
          0n,
        ),
        paidCommission: memberAllocations
          .filter((item) => item.status === "PAID")
          .reduce((sum, item) => sum + item.amountToman, 0n),
      };
    }),
  );

  const sourceMap = new Map<
    string,
    { leads: number; deals: number; commission: bigint }
  >();
  for (const applicant of applicants) {
    const row = sourceMap.get(applicant.source) || {
      leads: 0,
      deals: 0,
      commission: 0n,
    };
    row.leads += 1;
    sourceMap.set(applicant.source, row);
  }
  for (const deal of deals.filter((item) => item.status === "COMPLETED")) {
    const row = sourceMap.get(deal.applicant.source) || {
      leads: 0,
      deals: 0,
      commission: 0n,
    };
    row.deals += 1;
    row.commission += deal.commission?.totalAmountToman || 0n;
    sourceMap.set(deal.applicant.source, row);
  }
  const sources = [...sourceMap.entries()]
    .map(([source, row]) => ({
      source,
      ...row,
      conversion: conversionRate(row.deals, row.leads),
    }))
    .sort(
      (left, right) => right.deals - left.deals || right.leads - left.leads,
    );

  const neighborhoodMap = new Map(
    neighborhoodProperties.map((item) => [
      item.neighborhood,
      { properties: item._count, visits: 0, deals: 0 },
    ]),
  );
  for (const visit of visits) {
    const name = visit.property.neighborhood;
    const row = neighborhoodMap.get(name) || {
      properties: 0,
      visits: 0,
      deals: 0,
    };
    row.visits += 1;
    neighborhoodMap.set(name, row);
  }
  for (const deal of deals.filter((item) => item.status === "COMPLETED")) {
    const name = deal.property.neighborhood;
    const row = neighborhoodMap.get(name) || {
      properties: 0,
      visits: 0,
      deals: 0,
    };
    row.deals += 1;
    neighborhoodMap.set(name, row);
  }
  const neighborhoods = [...neighborhoodMap.entries()]
    .map(([name, row]) => ({ name, ...row }))
    .sort(
      (left, right) => right.deals - left.deals || right.visits - left.visits,
    )
    .slice(0, 10);

  const completedDeals = deals.filter((item) => item.status === "COMPLETED");
  const commissionReceived = deals.reduce(
    (sum, item) => sum + (item.commission?.receivedAmountToman || 0n),
    0n,
  );
  const outstandingCommission = openCommissions.reduce(
    (sum, item) => sum + item.totalAmountToman - item.receivedAmountToman,
    0n,
  );
  const averageClosingDays = completedDeals.length
    ? Math.round(
        completedDeals.reduce((sum, item) => {
          const completedAt = item.statusHistory[0]?.createdAt || now;
          return (
            sum +
            Math.max(
              0,
              (completedAt.getTime() - item.createdAt.getTime()) / 86_400_000,
            )
          );
        }, 0) / completedDeals.length,
      )
    : 0;
  const profitAndLoss = calculateProfitAndLoss(financeTransactions);
  const monthlyTrend = buildSixMonthTrend(propertiesTrend, dealsTrend, now);

  return (
    <div className="space-y-5">
      <div className="section-head">
        <div>
          <h1 className="page-title">گزارش‌های مدیریتی</h1>
          <p className="subtle">
            از {formatDate(periodStart)} تا {formatDate(now)} · فقط داده‌های
            دفتر شما
          </p>
        </div>
        {canExport && (
          <Link className="btn" href="/api/export/properties">
            <Download size={17} /> خروجی فایل‌ها
          </Link>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {periodOptions.map(([days, title]) => (
          <Link
            key={days}
            href={`/reports?period=${days}`}
            className={`btn whitespace-nowrap ${periodDays === days ? "btn-primary" : ""}`}
          >
            {title}
          </Link>
        ))}
      </div>

      <div className="grid-auto">
        {(
          [
            [
              "معامله نهایی",
              completedDeals.length,
              BarChart3,
              "text-emerald-600",
            ],
            [
              "نرخ تبدیل کل",
              percent(funnel.at(-1)?.fromStart || 0),
              Target,
              "text-brick",
            ],
            [
              "میانگین زمان فروش",
              `${toPersianDigits(averageClosingDays)} روز`,
              Clock3,
              "text-blue-600",
            ],
            [
              "کمیسیون وصولی",
              formatMoney(commissionReceived),
              WalletCards,
              "text-amber-600",
            ],
            [
              "کل مطالبات",
              formatMoney(
                outstandingCommission +
                  (openReceivables._sum.amountToman || 0n),
              ),
              Coins,
              "text-rose-600",
            ],
          ] as const
        ).map(([title, value, Icon, color]) => (
          <div className="card stat" key={String(title)}>
            <Icon className={String(color)} />
            <span className="subtle">{String(title)}</span>
            <strong
              className={String(value).includes("تومان") ? "text-lg" : ""}
            >
              {String(value)}
            </strong>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.1fr_.9fr] gap-4">
        <section className="card p-5">
          <h2 className="font-black text-xl flex items-center gap-2">
            <TrendingUp className="text-brick" /> قیف فروش
          </h2>
          <p className="subtle mt-1 mb-5">تعداد متقاضی یکتا در هر مرحله</p>
          <div className="space-y-3">
            {funnel.map((stage, index) => (
              <div key={stage.key}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="font-bold">{stage.label}</span>
                  <span>
                    <b>{faNumber.format(stage.value)}</b>
                    {index > 0 && (
                      <small className="subtle mr-2">
                        تبدیل مرحله {percent(stage.fromPrevious)}
                      </small>
                    )}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-brick to-orange-300"
                    style={{
                      width: `${Math.max(stage.fromStart, stage.value ? 4 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-black text-xl flex items-center gap-2">
            <Activity className="text-brick" /> روند شش‌ماهه
          </h2>
          <MonthlyChart data={monthlyTrend} />
        </section>
      </div>

      {canViewAccounting && (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-black text-xl flex items-center gap-2">
                <WalletCards className="text-brick" /> خلاصه سود و زیان دوره
              </h2>
              <p className="subtle mt-1">بر مبنای حسابداری تعهدی دفتر</p>
            </div>
            <Link className="btn" href="/accounting">
              مشاهده دفتر مالی
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            {[
              ["درآمد", profitAndLoss.income, "bg-emerald-50 text-emerald-700"],
              ["هزینه", profitAndLoss.expense, "bg-rose-50 text-rose-700"],
              ["سود خالص", profitAndLoss.profit, "bg-slate-100 text-ink"],
            ].map(([title, amount, color]) => (
              <div className={`rounded-2xl p-4 ${color}`} key={String(title)}>
                <span>{String(title)}</span>
                <b className="block text-xl mt-1">
                  {formatMoney(amount as bigint)}
                </b>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card table-wrap">
        <div className="p-5 pb-1">
          <h2 className="font-black text-xl flex items-center gap-2">
            <UsersRound className="text-brick" /> عملکرد پرسنل
          </h2>
          <p className="subtle mt-1">رتبه‌بندی بر اساس معامله نهایی و بازدید</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>پرسنل</th>
              <th>سرنخ</th>
              <th>پیگیری</th>
              <th>بازدید</th>
              <th>پیشنهاد پذیرفته</th>
              <th>معامله</th>
              <th>نرخ تبدیل</th>
              <th>سهم کمیسیون</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member, index) => (
              <tr key={member.id}>
                <td>
                  <b>
                    {faNumber.format(index + 1)}. {member.name}
                  </b>
                  <small className="block subtle">{label(member.role)}</small>
                </td>
                <td>{faNumber.format(member.leads)}</td>
                <td>{faNumber.format(member.activities)}</td>
                <td>
                  {faNumber.format(member.completedVisits)} از{" "}
                  {faNumber.format(member.visits)}
                </td>
                <td>{faNumber.format(member.acceptedOffers)}</td>
                <td>{faNumber.format(member.completedDeals)}</td>
                <td>
                  {percent(conversionRate(member.completedDeals, member.leads))}
                </td>
                <td>
                  <b>{formatMoney(member.commission)}</b>
                  <small className="block text-emerald-700">
                    پرداختی: {formatMoney(member.paidCommission)}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid xl:grid-cols-2 gap-4">
        <section className="card table-wrap">
          <div className="p-5 pb-1">
            <h2 className="font-black text-xl flex items-center gap-2">
              <ContactRound className="text-brick" /> بازده منابع جذب
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>منبع</th>
                <th>سرنخ</th>
                <th>معامله</th>
                <th>تبدیل</th>
                <th>کمیسیون</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.source}>
                  <td>
                    <b>{label(source.source)}</b>
                  </td>
                  <td>{faNumber.format(source.leads)}</td>
                  <td>{faNumber.format(source.deals)}</td>
                  <td>{percent(source.conversion)}</td>
                  <td>{formatMoney(source.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sources.length && (
            <p className="empty">داده‌ای در این دوره نیست.</p>
          )}
        </section>
        <section className="card table-wrap">
          <div className="p-5 pb-1">
            <h2 className="font-black text-xl flex items-center gap-2">
              <MapPinned className="text-brick" /> مناطق پربازده
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>محله</th>
                <th>فایل</th>
                <th>بازدید دوره</th>
                <th>معامله نهایی</th>
              </tr>
            </thead>
            <tbody>
              {neighborhoods.map((item) => (
                <tr key={item.name}>
                  <td>
                    <b>{item.name}</b>
                  </td>
                  <td>{faNumber.format(item.properties)}</td>
                  <td>{faNumber.format(item.visits)}</td>
                  <td>{faNumber.format(item.deals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid xl:grid-cols-[.8fr_1.2fr] gap-4">
        <section className="card p-5">
          <h2 className="font-black text-xl flex items-center gap-2">
            <Building2 className="text-brick" /> وضعیت فایل‌ها
          </h2>
          <StatusChart
            data={propertyStatuses.map((item) => ({
              name: label(item.status),
              value: item._count,
            }))}
          />
          <div className="grid grid-cols-2 gap-x-4">
            {propertyTypes.map((item) => (
              <div
                className="flex justify-between border-b py-2"
                key={item.propertyType}
              >
                <span>{label(item.propertyType)}</span>
                <b>{faNumber.format(item._count)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="card table-wrap">
          <div className="p-5 pb-1">
            <h2 className="font-black text-xl flex items-center gap-2">
              <Clock3 className="text-brick" /> فایل‌های راکد
            </h2>
            <p className="subtle mt-1">
              فایل فعال بدون تماس یا تغییر طی ۳۰ روز
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>فایل</th>
                <th>محله</th>
                <th>مسئول</th>
                <th>آخرین اقدام</th>
                <th>بازدید</th>
              </tr>
            </thead>
            <tbody>
              {staleProperties.map((property) => (
                <tr key={property.id}>
                  <td>
                    <Link
                      className="font-bold text-brick"
                      href={`/properties/${property.id}`}
                    >
                      {property.code}
                    </Link>
                    <small className="block subtle">{property.title}</small>
                  </td>
                  <td>{property.neighborhood}</td>
                  <td>{property.assignedAgent.fullName}</td>
                  <td>
                    {formatDate(property.lastContactAt || property.updatedAt)}
                  </td>
                  <td>{faNumber.format(property._count.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!staleProperties.length && (
            <p className="empty">فایل راکدی پیدا نشد؛ وضعیت پیگیری عالی است.</p>
          )}
        </section>
      </div>
    </div>
  );
}
