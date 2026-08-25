import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpLeft,
  Bot,
  Building2,
  CalendarCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  ClockAlert,
  Handshake,
  MapPinned,
  Phone,
  Plus,
  Sparkles,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { DynamicPropertyMap } from "@/components/dynamic-map";
import { MonthlyChart, StatusChart } from "@/components/charts";
import { db } from "@/lib/db";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  serializeBigInt,
} from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { propertyCoverUrl } from "@/lib/property-media";
import { buildSixMonthTrend } from "@/lib/reporting";

export const metadata = { title: "داشبورد" };

function greeting(hour: number) {
  if (hour < 12) return "صبح بخیر";
  if (hour < 17) return "روز بخیر";
  return "عصر بخیر";
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requirePermission("dashboard.view");
  const query = await searchParams;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [
    canCreateProperty,
    canManageContacts,
    canManageActivities,
    canManageVisits,
    canManageDeals,
    canViewCommission,
    canUseAi,
  ] = await Promise.all([
    hasPermission(user, "properties.create"),
    hasPermission(user, "contacts.manage"),
    hasPermission(user, "activities.manage_all"),
    hasPermission(user, "visits.manage_all"),
    hasPermission(user, "deals.manage_all"),
    hasPermission(user, "commissions.view"),
    hasPermission(user, "ai.use"),
  ]);

  const [
    active,
    applicants,
    overdue,
    visitsToday,
    negotiations,
    commission,
    recent,
    mapProperties,
    visits,
    activities,
    groups,
    monthlyProperties,
    monthlyDeals,
  ] = await Promise.all([
    db.property.count({ where: { agencyId: user.agencyId, status: "ACTIVE" } }),
    db.requirement.count({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
    }),
    db.activity.count({
      where: {
        agencyId: user.agencyId,
        ...(!canManageActivities ? { userId: user.id } : {}),
        completed: false,
        nextActionAt: { lt: now },
      },
    }),
    db.visit.count({
      where: {
        agencyId: user.agencyId,
        ...(!canManageVisits ? { assignedAgentId: user.id } : {}),
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      },
    }),
    db.deal.count({
      where: {
        agencyId: user.agencyId,
        status: "NEGOTIATION",
        ...(!canManageDeals ? { assignedAgentId: user.id } : {}),
      },
    }),
    db.dealCommission.aggregate({
      where: {
        deal: { agencyId: user.agencyId },
        status: "RECEIVED",
        ...(!canViewCommission ? { id: "__forbidden__" } : {}),
      },
      _sum: { receivedAmountToman: true },
    }),
    db.property.findMany({
      where: { agencyId: user.agencyId },
      include: {
        assignedAgent: true,
        images: { where: { isCover: true }, take: 1 },
        media: {
          where: {
            isCover: true,
            asset: { mimeType: { startsWith: "image/" } },
          },
          include: { asset: { select: { mimeType: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.property.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      include: {
        assignedAgent: true,
        images: { where: { isCover: true }, take: 1 },
        media: {
          where: {
            isCover: true,
            asset: { mimeType: { startsWith: "image/" } },
          },
          include: { asset: { select: { mimeType: true } } },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    db.visit.findMany({
      where: {
        agencyId: user.agencyId,
        ...(!canManageVisits ? { assignedAgentId: user.id } : {}),
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: { gte: now },
      },
      include: { property: true, applicant: true },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
    db.activity.findMany({
      where: {
        agencyId: user.agencyId,
        completed: false,
        nextActionAt: { not: null },
        ...(!canManageActivities ? { userId: user.id } : {}),
      },
      include: { contact: true, user: true },
      orderBy: { nextActionAt: "asc" },
      take: 5,
    }),
    db.property.groupBy({
      by: ["status"],
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
        ...(!canManageDeals ? { assignedAgentId: user.id } : {}),
        createdAt: { gte: new Date(now.getTime() - 230 * 86_400_000) },
      },
      select: { createdAt: true },
    }),
  ]);

  const monthlyTrend = buildSixMonthTrend(monthlyProperties, monthlyDeals, now);
  const map = serializeBigInt(
    mapProperties.map((property) => ({
      ...property,
      priceTotal: property.priceTotal?.toString(),
      depositAmount: property.depositAmount?.toString(),
      monthlyRent: property.monthlyRent?.toString(),
      imageUrl: propertyCoverUrl(property),
    })),
  );
  const quickActions = [
    canCreateProperty && [
      "/properties/new",
      "ثبت فایل جدید",
      "ملک تازه را وارد کنید",
      Plus,
      "brick",
    ],
    canManageContacts && [
      "/applicants",
      "ثبت متقاضی",
      "نیاز خرید یا اجاره",
      UserPlus,
      "blue",
    ],
    ["/activities", "ثبت پیگیری", "تماس و اقدام بعدی", Phone, "green"],
    canUseAi && [
      "/matching",
      "تطبیق هوشمند",
      "ملک مناسب را پیدا کنید",
      Sparkles,
      "purple",
    ],
  ].filter(Boolean) as Array<[string, string, string, typeof Plus, string]>;

  return (
    <div className="dashboard-home">
      {query.error === "forbidden" && (
        <div className="toast-note mb-4 text-red-700">
          شما اجازه دسترسی به این بخش را ندارید. در صورت نیاز با مدیر دفتر تماس
          بگیرید.
        </div>
      )}

      <section className="dashboard-welcome">
        <div className="dashboard-welcome-copy">
          <span className="dashboard-eyebrow">
            <span className="size-2 rounded-full bg-emerald-400" />
            {formatDate(today)} · {user.agency.name}
          </span>
          <h1>
            {greeting(now.getHours())}، <span>{user.fullName}</span>
          </h1>
          <p>
            امروز {visitsToday.toLocaleString("fa-IR")} بازدید و{" "}
            {overdue.toLocaleString("fa-IR")} پیگیری عقب‌افتاده دارید. مهم‌ترین
            کارها همین‌جا آماده‌اند.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {canCreateProperty && (
              <Link
                className="btn dashboard-primary-action"
                href="/properties/new"
              >
                <Plus size={18} /> افزودن فایل جدید
              </Link>
            )}
            <Link className="btn dashboard-ghost-action" href="/activities">
              برنامه امروز <ArrowLeft size={17} />
            </Link>
          </div>
        </div>
        <div className="dashboard-focus-card">
          <div className="flex items-center justify-between">
            <span className="text-white/65">تمرکز امروز</span>
            <Clock3 size={20} />
          </div>
          <strong>{(overdue + visitsToday).toLocaleString("fa-IR")}</strong>
          <span>اقدام زمان‌دار</span>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-l from-orange-400 to-amber-200" />
          </div>
          <small>اول پیگیری‌های عقب‌افتاده را جمع‌بندی کنید.</small>
        </div>
      </section>

      <section className="dashboard-quick-actions" aria-label="عملیات سریع">
        {quickActions.map(([href, title, description, Icon, tone]) => (
          <Link href={href} className="dashboard-action" key={href}>
            <span className={`dashboard-action-icon ${tone}`}>
              <Icon size={20} />
            </span>
            <span>
              <b>{title}</b>
              <small>{description}</small>
            </span>
            <ArrowUpLeft className="dashboard-action-arrow" size={17} />
          </Link>
        ))}
      </section>

      <section className="dashboard-metrics">
        {(
          [
            [
              "فایل فعال",
              active,
              "موجودی قابل ارائه",
              Building2,
              "brick",
              "/properties",
            ],
            [
              "متقاضی فعال",
              applicants,
              "در انتظار پیشنهاد",
              Users,
              "blue",
              "/applicants",
            ],
            [
              "پیگیری عقب‌افتاده",
              overdue,
              overdue ? "نیازمند اقدام فوری" : "همه پیگیری‌ها به‌روز",
              ClockAlert,
              overdue ? "red" : "green",
              "/activities",
            ],
            [
              "بازدید امروز",
              visitsToday,
              "برنامه امروز دفتر",
              CalendarCheck,
              "green",
              "/visits",
            ],
            [
              "در حال مذاکره",
              negotiations,
              "فرصت نزدیک به معامله",
              Handshake,
              "amber",
              "/deals",
            ],
          ] as const
        ).map(([title, value, description, Icon, tone, href]) => (
          <Link className="dashboard-metric" href={href} key={title}>
            <span className={`dashboard-metric-icon ${tone}`}>
              <Icon size={21} />
            </span>
            <div>
              <small>{title}</small>
              <strong>{value.toLocaleString("fa-IR")}</strong>
              <span>{description}</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="dashboard-workspace">
        <div className="card dashboard-panel dashboard-today">
          <div className="dashboard-panel-head">
            <div>
              <span className="panel-kicker">میز کار من</span>
              <h2>برنامه و پیگیری‌ها</h2>
            </div>
            <Link href="/activities">
              مشاهده همه <ArrowLeft size={15} />
            </Link>
          </div>
          <div className="dashboard-agenda">
            {activities.map((activity) => {
              const late = Boolean(
                activity.nextActionAt && activity.nextActionAt < now,
              );
              return (
                <Link
                  href="/activities"
                  className="dashboard-agenda-row"
                  key={activity.id}
                >
                  <span
                    className={`agenda-status ${late ? "late" : "upcoming"}`}
                  >
                    <Phone size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="truncate">{activity.subject}</b>
                    <small>
                      {activity.contact?.fullName || "بدون مخاطب"} ·{" "}
                      {activity.user.fullName}
                    </small>
                  </span>
                  <span className={late ? "text-red-600" : "subtle"}>
                    {activity.nextActionAt
                      ? formatDateTime(activity.nextActionAt)
                      : "—"}
                  </span>
                </Link>
              );
            })}
            {!activities.length && (
              <div className="dashboard-mini-empty">
                <CheckCircle2 />
                <b>پیگیری بازی ندارید</b>
                <span>برنامه شما مرتب و به‌روز است.</span>
              </div>
            )}
          </div>
        </div>

        <div className="card dashboard-panel dashboard-visits">
          <div className="dashboard-panel-head">
            <div>
              <span className="panel-kicker">تقویم کاری</span>
              <h2>بازدیدهای پیش‌رو</h2>
            </div>
            <Link href="/visits">
              همه بازدیدها <ArrowLeft size={15} />
            </Link>
          </div>
          <div className="grid gap-2">
            {visits.map((visit) => (
              <Link
                href="/visits"
                className="dashboard-visit-row"
                key={visit.id}
              >
                <span className="dashboard-visit-date">
                  <b>
                    {new Intl.DateTimeFormat("fa-IR", {
                      day: "numeric",
                    }).format(visit.scheduledAt)}
                  </b>
                  <small>
                    {new Intl.DateTimeFormat("fa-IR", {
                      month: "short",
                    }).format(visit.scheduledAt)}
                  </small>
                </span>
                <span className="min-w-0 flex-1">
                  <b className="truncate">{visit.property.title}</b>
                  <small>{visit.applicant.fullName}</small>
                </span>
                <span className="badge badge-active">
                  {formatDateTime(visit.scheduledAt)}
                </span>
              </Link>
            ))}
            {!visits.length && (
              <div className="dashboard-mini-empty">
                <CalendarCheck />
                <b>بازدیدی در پیش نیست</b>
                <span>از بخش بازدیدها یک برنامه تازه ثبت کنید.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-head">
          <div>
            <span className="panel-kicker">تازه‌های دفتر</span>
            <h2>آخرین فایل‌های ملکی</h2>
            <p>فایل‌های تازه ثبت یا به‌روزرسانی‌شده برای ارائه سریع</p>
          </div>
          <Link className="btn" href="/properties">
            مشاهده همه فایل‌ها <ArrowLeft size={16} />
          </Link>
        </div>
        <div className="dashboard-properties">
          {recent.map((property) => (
            <Link
              href={`/properties/${property.id}`}
              className="dashboard-property-card"
              key={property.id}
            >
              <div className="dashboard-property-image">
                <Image
                  src={propertyCoverUrl(property)}
                  alt={property.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 25vw"
                  unoptimized
                />
                <span className="dashboard-property-code">{property.code}</span>
                <span className="dashboard-property-type">
                  {label(property.transactionType)}
                </span>
              </div>
              <div className="p-4">
                <h3>{property.title}</h3>
                <p>
                  <MapPinned size={14} /> {property.neighborhood} ·{" "}
                  {property.area.toLocaleString("fa-IR")} متر
                </p>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <small>ارزش پیشنهادی</small>
                    <b>
                      {formatMoney(
                        property.priceTotal ?? property.depositAmount,
                      )}
                    </b>
                  </div>
                  <ArrowUpLeft size={18} />
                </div>
              </div>
            </Link>
          ))}
          {!recent.length && (
            <div className="card empty md:col-span-2 xl:col-span-4">
              هنوز فایل ملکی ثبت نشده است.
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-insights">
        <div className="card dashboard-panel dashboard-trend">
          <div className="dashboard-panel-head">
            <div>
              <span className="panel-kicker">تصویر عملکرد</span>
              <h2>روند شش‌ماهه دفتر</h2>
            </div>
            <ChartNoAxesCombined className="text-brick" />
          </div>
          <MonthlyChart data={monthlyTrend} />
        </div>
        <div className="card dashboard-panel dashboard-status">
          <div className="dashboard-panel-head">
            <div>
              <span className="panel-kicker">سلامت موجودی</span>
              <h2>وضعیت فایل‌ها</h2>
            </div>
          </div>
          <StatusChart
            data={groups.map((group) => ({
              name: label(group.status),
              value: group._count,
            }))}
          />
        </div>
        {canViewCommission && (
          <Link href="/commissions" className="dashboard-commission">
            <span>
              <WalletCards size={23} />
              <small>کمیسیون وصول‌شده</small>
            </span>
            <strong>
              {formatMoney(commission._sum.receivedAmountToman ?? 0)}
            </strong>
            <p>
              مشاهده جزئیات سهم‌ها و تسویه‌ها <ArrowLeft size={15} />
            </p>
          </Link>
        )}
      </section>

      <section className="card dashboard-map-panel">
        <div className="dashboard-panel-head">
          <div>
            <span className="panel-kicker">پوشش جغرافیایی</span>
            <h2>فایل‌های فعال روی نقشه</h2>
          </div>
          <Link className="btn" href="/map">
            نقشه کامل <ArrowLeft size={16} />
          </Link>
        </div>
        <DynamicPropertyMap properties={map} compact />
      </section>

      {active === 0 && applicants === 0 && (
        <section className="dashboard-onboarding">
          <Bot size={28} />
          <div>
            <b>آجر آماده شروع کار است</b>
            <p>
              ابتدا یک فایل و یک متقاضی ثبت کنید؛ سپس تطبیق هوشمند بهترین
              گزینه‌ها را پیشنهاد می‌دهد.
            </p>
          </div>
          {canCreateProperty && (
            <Link className="btn btn-primary" href="/properties/new">
              شروع ثبت اطلاعات
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
