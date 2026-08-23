import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { label } from "@/lib/labels";
import { formatMoney } from "@/lib/format";
import { StatusChart, MonthlyChart } from "@/components/charts";
import { BarChart3, WalletCards, Building2, Clock3 } from "lucide-react";
import Link from "next/link";
export const metadata = { title: "گزارش‌ها" };
export default async function Reports() {
  const u = await requireUser();
  const [status, type, neighborhood, commission, completed, activities] =
    await Promise.all([
      db.property.groupBy({
        by: ["status"],
        where: { agencyId: u.agencyId },
        _count: true,
      }),
      db.property.groupBy({
        by: ["propertyType"],
        where: { agencyId: u.agencyId },
        _count: true,
      }),
      db.property.groupBy({
        by: ["neighborhood"],
        where: { agencyId: u.agencyId },
        _count: true,
        orderBy: { _count: { neighborhood: "desc" } },
        take: 6,
      }),
      db.deal.aggregate({
        where: { agencyId: u.agencyId, status: "COMPLETED" },
        _sum: { commissionAmount: true },
      }),
      db.deal.count({ where: { agencyId: u.agencyId, status: "COMPLETED" } }),
      db.activity.count({ where: { agencyId: u.agencyId, completed: true } }),
    ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">گزارش‌ها</h1>
          <p className="subtle">
            نمای تحلیلی عملکرد آژانس بر پایه داده‌های SQLite
          </p>
        </div>
        <Link className="btn" href="/api/export/properties">
          خروجی CSV
        </Link>
      </div>
      <div className="grid-auto mb-4">
        {(
          [
            ["فایل‌ها", status.reduce((a, x) => a + x._count, 0), Building2],
            ["معامله نهایی", completed, BarChart3],
            [
              "کمیسیون قطعی",
              formatMoney(commission._sum.commissionAmount),
              WalletCards,
            ],
            ["پیگیری تکمیل", activities, Clock3],
          ] as const
        ).map(([t, v, I]) => (
          <div className="card stat" key={String(t)}>
            <I className="text-brick" />
            <span className="subtle">{String(t)}</span>
            <strong className={String(v).includes("تومان") ? "text-lg" : ""}>
              {String(v)}
            </strong>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-black text-lg">توزیع وضعیت فایل‌ها</h2>
          <StatusChart
            data={status.map((x) => ({
              name: label(x.status),
              value: x._count,
            }))}
          />
        </div>
        <div className="card p-5">
          <h2 className="font-black text-lg">روند فایل و معامله</h2>
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
          <h2 className="font-black text-lg mb-4">فایل بر اساس نوع</h2>
          {type.map((x) => (
            <div
              className="flex justify-between border-b py-3"
              key={x.propertyType}
            >
              <span>{label(x.propertyType)}</span>
              <b>{x._count}</b>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="font-black text-lg mb-4">محله‌های پرتقاضا</h2>
          {neighborhood.map((x) => (
            <div
              className="flex justify-between border-b py-3"
              key={x.neighborhood}
            >
              <span>{x.neighborhood}</span>
              <b>{x._count}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
