import { hasPermission, requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  serializeBigInt,
} from "@/lib/format";
import { label } from "@/lib/labels";
import Link from "next/link";
import Image from "next/image";
import { JalaliDateInput } from "@/components/jalali-date-input";
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
  Upload,
  FileText,
  Images,
  BadgeCheck,
  Star,
} from "lucide-react";
import { DynamicPropertyMap } from "@/components/dynamic-map";
import { PrintButton } from "@/components/print-button";
import { setDocumentStatus, setPropertyMediaCover } from "@/app/crm-actions";
export default async function PropertyDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploaded?: string; uploadError?: string }>;
}) {
  const u = await requirePermission("properties.view"),
    { id } = await params,
    query = await searchParams;
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
      documents: {
        include: { asset: true, verifiedBy: true },
        orderBy: { createdAt: "desc" },
      },
      media: {
        include: { asset: true },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!p) notFound();
  const canEdit =
    p.assignedAgentId === u.id ||
    (await hasPermission(u, "properties.manage_all"));
  const canVerify = await hasPermission(u, "documents.verify");
  const privateCover = p.media.find(
    (item) => item.isCover && item.asset.mimeType.startsWith("image/"),
  );
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
          {canEdit && (
            <Link className="btn btn-primary" href={`/properties/${p.id}/edit`}>
              <Pencil size={17} /> ویرایش
            </Link>
          )}
        </div>
      </div>
      <div className="print-only mb-5">
        <h1 className="text-3xl font-black">آجر · برگه معرفی ملک</h1>
      </div>
      {query.uploaded && (
        <div className="toast-note mb-4 text-green-700">
          فایل با موفقیت و به‌صورت خصوصی بارگذاری شد.
        </div>
      )}
      {query.uploadError && (
        <div className="toast-note mb-4 text-red-700">{query.uploadError}</div>
      )}
      <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-4">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <Image
              src={
                privateCover
                  ? `/api/files/${privateCover.assetId}`
                  : (p.images[0]?.url ?? "/property-1.png")
              }
              className="w-full h-[360px] property-img"
              alt={p.images[0]?.alt ?? p.title}
              width={900}
              height={360}
              priority
              unoptimized={Boolean(privateCover)}
            />
          </div>
          <section className="card p-5 no-print">
            <h2 className="font-black text-lg mb-4 flex gap-2">
              <Images className="text-brick" /> تصاویر، پلان و ویدئو
            </h2>
            {canEdit && (
              <form
                action="/api/uploads"
                method="post"
                encType="multipart/form-data"
                className="grid md:grid-cols-[140px_1fr_1fr_auto] gap-2 mb-5 rounded-xl bg-slate-50 p-3"
              >
                <input type="hidden" name="entityType" value="PROPERTY" />
                <input type="hidden" name="entityId" value={p.id} />
                <input type="hidden" name="kind" value="MEDIA" />
                <select className="select" name="mediaType">
                  <option value="IMAGE">تصویر</option>
                  <option value="VIDEO">ویدئو</option>
                  <option value="FLOOR_PLAN">پلان</option>
                  <option value="VIRTUAL_TOUR">تور مجازی</option>
                </select>
                <input
                  className="input"
                  name="title"
                  placeholder="عنوان رسانه"
                  required
                />
                <input
                  className="input"
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  required
                />
                <button className="btn btn-primary">
                  <Upload size={16} /> بارگذاری
                </button>
              </form>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {p.media.map((media) => (
                <article
                  className="rounded-xl border overflow-hidden"
                  key={media.id}
                >
                  {media.asset.mimeType.startsWith("image/") ? (
                    <Image
                      src={`/api/files/${media.assetId}`}
                      alt={media.alt || media.title}
                      width={420}
                      height={240}
                      unoptimized
                      className="w-full h-40 property-img"
                    />
                  ) : (
                    <video
                      className="w-full h-40 bg-black"
                      controls
                      preload="metadata"
                      src={`/api/files/${media.assetId}`}
                    />
                  )}
                  <div className="p-3 flex justify-between gap-2">
                    <div>
                      <b>{media.title}</b>
                      <small className="block subtle">
                        {label(media.mediaType)}
                      </small>
                    </div>
                    {canEdit &&
                      media.asset.mimeType.startsWith("image/") &&
                      !media.isCover && (
                        <form
                          action={setPropertyMediaCover.bind(
                            null,
                            p.id,
                            media.id,
                          )}
                        >
                          <button
                            className="btn p-2"
                            aria-label="انتخاب به‌عنوان تصویر اصلی"
                          >
                            <Star size={15} />
                          </button>
                        </form>
                      )}
                    {media.isCover && (
                      <span className="badge badge-active">اصلی</span>
                    )}
                  </div>
                </article>
              ))}
              {!p.media.length && (
                <p className="subtle">رسانه اختصاصی بارگذاری نشده است.</p>
              )}
            </div>
          </section>
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
                <Link
                  className="block font-bold hover:text-brick"
                  href={`/contacts/${p.ownerId}`}
                >
                  {p.owner.fullName}
                </Link>
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
          <section className="card p-5 no-print">
            <h3 className="font-black mb-4 flex gap-2">
              <FileText className="text-green-600" /> مدارک ملک
            </h3>
            {canEdit && (
              <form
                action="/api/uploads"
                method="post"
                encType="multipart/form-data"
                className="grid gap-2 mb-4 rounded-xl bg-slate-50 p-3"
              >
                <input type="hidden" name="entityType" value="PROPERTY" />
                <input type="hidden" name="entityId" value={p.id} />
                <input type="hidden" name="kind" value="DOCUMENT" />
                <select className="select" name="documentType">
                  <option value="OWNERSHIP_DEED">سند مالکیت</option>
                  <option value="BUILDING_PERMIT">پروانه ساخت</option>
                  <option value="COMPLETION_CERTIFICATE">پایان کار</option>
                  <option value="MUNICIPALITY">مدرک شهرداری</option>
                  <option value="OTHER">سایر</option>
                </select>
                <input
                  className="input"
                  name="title"
                  placeholder="عنوان مدرک"
                  required
                />
                <input
                  className="input"
                  name="documentNumber"
                  placeholder="شماره مدرک"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    <span className="label">تاریخ صدور</span>
                    <JalaliDateInput name="issuedAt" />
                  </label>
                  <label>
                    <span className="label">تاریخ انقضا</span>
                    <JalaliDateInput name="expiresAt" />
                  </label>
                </div>
                <input
                  className="input"
                  type="file"
                  name="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                />
                <button className="btn btn-primary">
                  <Upload size={15} /> بارگذاری امن
                </button>
              </form>
            )}
            <div className="space-y-3">
              {p.documents.map((document) => (
                <article className="rounded-xl border p-3" key={document.id}>
                  <div className="flex justify-between gap-2">
                    <a
                      className="font-bold text-brick"
                      href={`/api/files/${document.assetId}`}
                      target="_blank"
                    >
                      {document.title}
                    </a>
                    <span
                      className={`badge ${document.status === "VERIFIED" ? "badge-active" : document.status === "REJECTED" ? "badge-danger" : "badge-warn"}`}
                    >
                      {label(document.status)}
                    </span>
                  </div>
                  <small className="subtle">
                    {document.asset.originalName}
                  </small>
                  {(document.issuedAt || document.expiresAt) && (
                    <small className="block subtle">
                      {document.issuedAt
                        ? `صدور: ${formatDate(document.issuedAt)}`
                        : ""}
                      {document.issuedAt && document.expiresAt ? " · " : ""}
                      {document.expiresAt
                        ? `انقضا: ${formatDate(document.expiresAt)}`
                        : ""}
                    </small>
                  )}
                  {canVerify && document.status !== "VERIFIED" && (
                    <div className="flex gap-2 mt-2">
                      <form
                        action={setDocumentStatus.bind(
                          null,
                          "PROPERTY",
                          document.id,
                          "VERIFIED",
                        )}
                      >
                        <button className="btn p-2 text-green-700">
                          <BadgeCheck size={14} /> تأیید
                        </button>
                      </form>
                      <form
                        action={setDocumentStatus.bind(
                          null,
                          "PROPERTY",
                          document.id,
                          "REJECTED",
                        )}
                      >
                        <button className="btn p-2 text-red-700">رد</button>
                      </form>
                    </div>
                  )}
                </article>
              ))}
              {!p.documents.length && (
                <p className="subtle">مدرکی ثبت نشده است.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
