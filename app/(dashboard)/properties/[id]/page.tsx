import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatDateTime, formatMoney, serializeBigInt } from "@/lib/format";
import { label } from "@/lib/labels";
import Link from "next/link";
import Image from "next/image";
import {
  Pencil,
  Phone,
  CalendarPlus,
  Handshake,
  MapPin,
  BedDouble,
  Maximize,
  Car,
  Warehouse,
} from "lucide-react";
import { DynamicPropertyMap } from "@/components/dynamic-map";
import { PrintButton } from "@/components/print-button";
export default async function PropertyDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await requireUser(),
    { id } = await params;
  const p = await db.property.findFirst({
    where: { id, agencyId: u.agencyId },
    include: {
      owner: true,
      assignedAgent: true,
      images: true,
      activities: { include: { user: true }, orderBy: { occurredAt: "desc" } },
      visits: {
        include: { applicant: true },
        orderBy: { scheduledAt: "desc" },
      },
      deals: { include: { applicant: true } },
    },
  });
  if (!p) notFound();
  const map = serializeBigInt([
    {
      ...p,
      priceTotal: p.priceTotal?.toString(),
      depositAmount: p.depositAmount?.toString(),
      monthlyRent: p.monthlyRent?.toString(),
    },
  ]);
  return (
    <>
      <div className="section-head no-print">
        <div>
          <div className="flex gap-2 mb-2">
            <span className="badge badge-active">{label(p.status)}</span>
            <span className="badge badge-warn">{label(p.transactionType)}</span>
          </div>
          <h1 className="page-title">{p.title}</h1>
          <p className="subtle ltr text-right">{p.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <Link className="btn btn-primary" href={`/properties/${p.id}/edit`}>
            <Pencil size={17} /> ویرایش
          </Link>
        </div>
      </div>
      <div className="print-only mb-5">
        <h1 className="text-3xl font-black">آجر · برگه معرفی ملک</h1>
      </div>
      <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <Image
              src={p.images[0]?.url ?? "/property-1.png"}
              className="w-full h-[360px] property-img"
              alt={p.images[0]?.alt ?? p.title}
              width={900}
              height={360}
              priority
            />
          </div>
          <div className="card p-5">
            <h2 className="font-black text-lg mb-4">مشخصات فایل</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(
                [
                  [Maximize, "متراژ", `${p.area} متر`],
                  [BedDouble, "اتاق", p.bedrooms ?? "—"],
                  [Car, "پارکینگ", p.parking ? "دارد" : "ندارد"],
                  [Warehouse, "انباری", p.storage ? "دارد" : "ندارد"],
                ] as const
              ).map(([I, t, v]) => (
                <div key={String(t)} className="p-3 rounded-xl bg-[#f8f6f2]">
                  <I className="text-brick mb-2" size={20} />
                  <small className="subtle block">{String(t)}</small>
                  <b>{String(v)}</b>
                </div>
              ))}
            </div>
            <p className="leading-8 mt-5">{p.description}</p>
          </div>
          <div className="card p-5 no-print">
            <h2 className="font-black text-lg mb-4">موقعیت ملک</h2>
            <DynamicPropertyMap properties={map} compact />
            <p className="mt-3 flex gap-2">
              <MapPin size={17} className="text-brick" />
              {p.address}
            </p>
            <small className="subtle">
              برای استفاده از نقشه، اتصال اینترنت جهت دریافت کاشی‌های
              OpenStreetMap لازم است.
            </small>
          </div>
          <div className="card p-5 no-print">
            <h2 className="font-black text-lg mb-4">تاریخچه پیگیری</h2>
            {p.activities.map((a) => (
              <div
                className="border-r-2 border-orange-200 pr-4 pb-5"
                key={a.id}
              >
                <b>{a.subject}</b>
                <p className="subtle text-sm">{a.description}</p>
                <small>
                  {formatDateTime(a.occurredAt)} · {a.user.fullName}
                </small>
              </div>
            ))}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="card p-5">
            <small className="subtle">قیمت پیشنهادی</small>
            <div className="text-2xl font-black text-brick mt-2">
              {formatMoney(p.priceTotal ?? p.depositAmount)}
            </div>
            {p.monthlyRent && (
              <p className="mt-2">اجاره: {formatMoney(p.monthlyRent)}</p>
            )}
            <hr className="my-5" />
            <div className="space-y-3">
              <div>
                <small className="subtle">مالک</small>
                <b className="block">{p.owner.fullName}</b>
                <a
                  href={`tel:${p.owner.mobile}`}
                  className="text-brick ltr inline-block"
                >
                  <Phone size={14} className="inline" /> {p.owner.mobile}
                </a>
              </div>
              <div>
                <small className="subtle">مسئول فایل</small>
                <b className="block">{p.assignedAgent.fullName}</b>
              </div>
              <div>
                <small className="subtle">محله</small>
                <b className="block">{p.neighborhood}</b>
              </div>
            </div>
          </div>
          <div className="card p-4 no-print space-y-2">
            <Link href={`/activities?property=${p.id}`} className="btn w-full">
              <Phone size={17} /> ثبت پیگیری
            </Link>
            <Link href={`/visits?property=${p.id}`} className="btn w-full">
              <CalendarPlus size={17} /> برنامه‌ریزی بازدید
            </Link>
            <Link
              href={`/deals?property=${p.id}`}
              className="btn btn-dark w-full"
            >
              <Handshake size={17} /> ایجاد معامله
            </Link>
          </div>
          <div className="card p-5 no-print">
            <h3 className="font-black mb-3">بازدیدها و معاملات</h3>
            <p>{p.visits.length} بازدید ثبت‌شده</p>
            <p>{p.deals.length} پرونده معامله</p>
            {p.deals.map((d) => (
              <div className="mt-3 p-3 rounded-xl bg-slate-50" key={d.id}>
                <b>{d.applicant.fullName}</b>
                <span className="badge mr-2">{label(d.status)}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
