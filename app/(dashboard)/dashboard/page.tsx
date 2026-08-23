import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, serializeBigInt } from "@/lib/format";
import { label } from "@/lib/labels";
import Link from "next/link";
import {
  Building2,
  Users,
  ClockAlert,
  CalendarCheck,
  Handshake,
  WalletCards,
  Plus,
  Phone,
  ArrowLeft,
} from "lucide-react";
import { StatusChart, MonthlyChart } from "@/components/charts";
import { DynamicPropertyMap } from "@/components/dynamic-map";
export const metadata = { title: "داشبورد" };
export default async function Dashboard() {
  const u = await requireUser();
  const now = new Date(),
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    tomorrow = new Date(today.getTime() + 86400000);
  const [
    active,
    applicants,
    overdue,
    visitsToday,
    negotiations,
    commission,
    recent,
    visits,
    activities,
    groups,
  ] = await Promise.all([
    db.property.count({ where: { agencyId: u.agencyId, status: "ACTIVE" } }),
    db.requirement.count({ where: { agencyId: u.agencyId, status: "ACTIVE" } }),
    db.activity.count({
      where: {
        agencyId: u.agencyId,
        completed: false,
        nextActionAt: { lt: now },
      },
    }),
    db.visit.count({
      where: {
        agencyId: u.agencyId,
        scheduledAt: { gte: today, lt: tomorrow },
      },
    }),
    db.deal.count({ where: { agencyId: u.agencyId, status: "NEGOTIATION" } }),
    db.deal.aggregate({
      where: { agencyId: u.agencyId, status: "COMPLETED" },
      _sum: { commissionAmount: true },
    }),
    db.property.findMany({
      where: { agencyId: u.agencyId },
      include: {
        assignedAgent: true,
        images: { where: { isCover: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.visit.findMany({
      where: {
        agencyId: u.agencyId,
        status: "SCHEDULED",
        scheduledAt: { gte: now },
      },
      include: { property: true, applicant: true },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
    db.activity.findMany({
      where: { agencyId: u.agencyId, completed: false },
      include: { contact: true, user: true },
      orderBy: { nextActionAt: "asc" },
      take: 5,
    }),
    db.property.groupBy({
      by: ["status"],
      where: { agencyId: u.agencyId },
      _count: true,
    }),
  ]);
  const map = serializeBigInt(
    recent.map((p) => ({
      ...p,
      priceTotal: p.priceTotal?.toString(),
      depositAmount: p.depositAmount?.toString(),
      monthlyRent: p.monthlyRent?.toString(),
    })),
  );
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">صبح بخیر، {u.fullName} 👋</h1>
          <p className="subtle mt-1">نبض امروز آژانس شما در یک نگاه</p>
        </div>
        <Link className="btn btn-primary" href="/properties/new">
          <Plus size={18} /> افزودن فایل
        </Link>
      </div>
      <section className="grid-auto mb-5">
        {(
          [
            ["فایل فعال", active, Building2, "text-[#c65d35]"],
            ["متقاضی فعال", applicants, Users, "text-blue-600"],
            ["پیگیری عقب‌افتاده", overdue, ClockAlert, "text-red-600"],
            ["بازدید امروز", visitsToday, CalendarCheck, "text-green-600"],
            ["در حال مذاکره", negotiations, Handshake, "text-amber-600"],
            [
              "کمیسیون قطعی",
              formatMoney(commission._sum.commissionAmount),
              WalletCards,
              "text-purple-600",
            ],
          ] as const
        ).map(([t, v, I, c]) => (
          <div className="card stat" key={String(t)}>
            <div className="flex justify-between subtle">
              <span>{String(t)}</span>
              <I className={String(c)} size={20} />
            </div>
            <strong
              className={String(v).includes("تومان") ? "text-lg mt-4" : ""}
            >
              {String(v)}
            </strong>
          </div>
        ))}
      </section>
      <section className="grid lg:grid-cols-[1.25fr_.75fr] gap-4 mb-5">
        <div className="card p-5">
          <div className="section-head">
            <h2 className="font-black text-lg">فایل‌های فعال روی نقشه</h2>
            <Link href="/map" className="text-brick font-bold">
              نقشه کامل <ArrowLeft className="inline" size={15} />
            </Link>
          </div>
          <DynamicPropertyMap properties={map} compact />
        </div>
        <div className="card p-5">
          <h2 className="font-black text-lg mb-2">وضعیت فایل‌ها</h2>
          <StatusChart
            data={groups.map((g) => ({
              name: label(g.status),
              value: g._count,
            }))}
          />
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4 mb-5">
        <div className="card p-5">
          <h2 className="font-black text-lg mb-3">بازدیدهای پیش‌رو</h2>
          {visits.map((v) => (
            <Link
              href="/visits"
              key={v.id}
              className="flex items-center justify-between border-b py-3"
            >
              <div>
                <b>{v.property.title}</b>
                <div className="subtle text-xs">{v.applicant.fullName}</div>
              </div>
              <span className="badge badge-active">
                {formatDateTime(v.scheduledAt)}
              </span>
            </Link>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="font-black text-lg mb-3">پیگیری‌های مهم</h2>
          {activities.map((a) => (
            <Link
              href="/activities"
              key={a.id}
              className="flex items-center gap-3 border-b py-3"
            >
              <div
                className={`w-9 h-9 rounded-xl grid place-items-center ${a.nextActionAt && a.nextActionAt < now ? "bg-red-50 text-red-600" : "bg-orange-50 text-brick"}`}
              >
                <Phone size={17} />
              </div>
              <div className="flex-1">
                <b>{a.subject}</b>
                <div className="subtle text-xs">
                  {a.contact?.fullName} · {a.user.fullName}
                </div>
              </div>
              <small>
                {a.nextActionAt ? formatDateTime(a.nextActionAt) : "—"}
              </small>
            </Link>
          ))}
        </div>
      </section>
      <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-4">
        <div className="card p-5">
          <h2 className="font-black text-lg mb-4">روند شش‌ماهه</h2>
          <MonthlyChart
            data={[
              { name: "فروردین", فایل: 12, معامله: 2 },
              { name: "اردیبهشت", فایل: 18, معامله: 4 },
              { name: "خرداد", فایل: 15, معامله: 3 },
              { name: "تیر", فایل: 23, معامله: 6 },
              { name: "مرداد", فایل: 19, معامله: 4 },
              { name: "شهریور", فایل: 24, معامله: 5 },
            ]}
          />
        </div>
        <div className="card p-5">
          <h2 className="font-black text-lg mb-4">مسیر پیشنهادی نسخه نمایشی</h2>
          {[
            "فایل را روی نقشه پیدا کنید",
            "متقاضی را ثبت کنید",
            "تطبیق هوشمند را اجرا کنید",
            "بازدید و پیگیری را ثبت کنید",
            "معامله را تا قرارداد مدیریت کنید",
          ].map((x, i) => (
            <div className="flex gap-3 items-center py-2" key={x}>
              <span className="w-7 h-7 bg-ink text-white rounded-lg grid place-items-center">
                {i + 1}
              </span>
              {x}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
