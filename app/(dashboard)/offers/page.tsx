import Link from "next/link";
import { ArrowLeftRight, BadgeCheck, Banknote, Handshake } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { createSalesOffer, updateOfferStatus } from "@/app/operations-actions";
import { JalaliDateInput } from "@/components/jalali-date-input";

export const metadata = { title: "پیشنهادها و مذاکره" };
export const dynamic = "force-dynamic";

export default async function Offers({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    applicant?: string;
    visit?: string;
    status?: string;
    created?: string;
    error?: string;
  }>;
}) {
  const user = await requirePermission("deals.view");
  const canCreate = await hasPermission(user, "deals.create");
  const canManage = await hasPermission(user, "deals.manage");
  const canManageAll = await hasPermission(user, "deals.manage_all");
  const query = await searchParams;
  const allowedStatuses = [
    "DRAFT",
    "SUBMITTED",
    "COUNTERED",
    "ACCEPTED",
    "REJECTED",
    "WITHDRAWN",
    "EXPIRED",
  ];
  const selectedStatus = allowedStatuses.includes(query.status || "")
    ? query.status
    : undefined;
  const [offers, properties, applicants, visits] = await Promise.all([
    db.salesOffer.findMany({
      where: {
        agencyId: user.agencyId,
        ...(!canManageAll ? { createdById: user.id } : {}),
        ...(selectedStatus ? { status: selectedStatus as "SUBMITTED" } : {}),
      },
      include: {
        property: true,
        applicant: true,
        createdBy: true,
        visit: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.property.findMany({
      where: {
        agencyId: user.agencyId,
        status: { in: ["ACTIVE", "RESERVED"] },
      },
      select: { id: true, code: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    db.contact.findMany({
      where: {
        agencyId: user.agencyId,
        type: { in: ["APPLICANT", "BOTH"] },
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.visit.findMany({
      where: {
        agencyId: user.agencyId,
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      },
      include: { property: true, applicant: true },
      orderBy: { scheduledAt: "desc" },
      take: 100,
    }),
  ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">پیشنهادها و مذاکره</h1>
          <p className="subtle">
            ثبت دورهای قیمت، پاسخ مالک و تبدیل پذیرش به معامله
          </p>
        </div>
        {canCreate && (
          <details>
            <summary className="btn btn-primary list-none cursor-pointer">
              پیشنهاد جدید
            </summary>
            <form
              action={createSalesOffer}
              className="card p-4 absolute left-6 mt-2 w-[460px] max-w-[90vw] z-30 grid gap-3"
            >
              <select
                className="select"
                name="propertyId"
                defaultValue={query.property || ""}
                required
              >
                <option value="">انتخاب فایل</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.code} · {property.title}
                  </option>
                ))}
              </select>
              <select
                className="select"
                name="applicantId"
                defaultValue={query.applicant || ""}
                required
              >
                <option value="">انتخاب متقاضی</option>
                {applicants.map((applicant) => (
                  <option key={applicant.id} value={applicant.id}>
                    {applicant.fullName}
                  </option>
                ))}
              </select>
              <select
                className="select"
                name="visitId"
                defaultValue={query.visit || ""}
              >
                <option value="">بدون بازدید مرتبط</option>
                {visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visit.property.code} · {visit.applicant.fullName}
                  </option>
                ))}
              </select>
              <div className="grid md:grid-cols-3 gap-2">
                <input
                  className="input ltr text-right"
                  name="priceToman"
                  placeholder="قیمت کل"
                />
                <input
                  className="input ltr text-right"
                  name="depositToman"
                  placeholder="ودیعه"
                />
                <input
                  className="input ltr text-right"
                  name="monthlyRentToman"
                  placeholder="اجاره"
                />
              </div>
              <textarea
                className="textarea"
                name="terms"
                placeholder="شرایط پرداخت، زمان تحویل و شروط مذاکره"
              />
              <label>
                <span className="label">اعتبار پیشنهاد تا</span>
                <JalaliDateInput name="expiresAt" />
              </label>
              <button className="btn btn-primary">ثبت و ارسال پیشنهاد</button>
            </form>
          </details>
        )}
      </div>
      {query.created && (
        <div className="toast-note mb-4 text-green-700">پیشنهاد ثبت شد.</div>
      )}
      {query.error && (
        <div className="toast-note mb-4 text-red-700">
          مبلغ، تاریخ یا ارتباطات پیشنهاد معتبر نیست.
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-5">
        <Link
          className={`btn ${!selectedStatus ? "btn-dark" : ""}`}
          href="/offers"
        >
          همه
        </Link>
        {["SUBMITTED", "COUNTERED", "ACCEPTED", "REJECTED", "EXPIRED"].map(
          (status) => (
            <Link
              className={`btn ${selectedStatus === status ? "btn-dark" : ""}`}
              href={`/offers?status=${status}`}
              key={status}
            >
              {label(status)}
            </Link>
          ),
        )}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {offers.map((offer) => (
          <article className="card p-5" key={offer.id}>
            <div className="flex justify-between gap-3">
              <div>
                <span className="badge mb-2">دور {offer.round}</span>
                <Link
                  href={`/properties/${offer.propertyId}`}
                  className="font-black text-lg block hover:text-brick"
                >
                  {offer.property.code} · {offer.property.title}
                </Link>
                <p className="subtle">
                  {offer.applicant.fullName} · {offer.createdBy.fullName}
                </p>
              </div>
              <span
                className={`badge ${offer.status === "ACCEPTED" ? "badge-active" : offer.status === "REJECTED" ? "badge-danger" : "badge-warn"}`}
              >
                {label(offer.status)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {[
                ["قیمت", offer.priceToman],
                ["ودیعه", offer.depositToman],
                ["اجاره", offer.monthlyRentToman],
              ].map(([title, amount]) => (
                <div className="rounded-xl bg-slate-50 p-3" key={String(title)}>
                  <Banknote size={17} className="mx-auto text-brick" />
                  <small className="block subtle">{String(title)}</small>
                  <b>{amount ? formatMoney(amount as bigint) : "—"}</b>
                </div>
              ))}
            </div>
            {offer.terms && <p className="mt-3 text-sm">{offer.terms}</p>}
            {offer.responseNote && (
              <p className="mt-2 text-sm text-blue-700">
                پاسخ: {offer.responseNote}
              </p>
            )}
            <small className="block subtle mt-3">
              ثبت: {formatDateTime(offer.createdAt)}
              {offer.expiresAt
                ? ` · اعتبار: ${formatDate(offer.expiresAt)}`
                : ""}
            </small>
            {canManage && ["SUBMITTED", "COUNTERED"].includes(offer.status) && (
              <form className="grid gap-2 mt-4 rounded-xl border p-3">
                <input
                  className="input"
                  name="responseNote"
                  placeholder="توضیح پاسخ یا شرط متقابل"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn p-2"
                    formAction={updateOfferStatus.bind(
                      null,
                      offer.id,
                      "COUNTERED",
                    )}
                  >
                    <ArrowLeftRight size={15} /> پیشنهاد متقابل
                  </button>
                  <button
                    className="btn p-2 text-green-700"
                    formAction={updateOfferStatus.bind(
                      null,
                      offer.id,
                      "ACCEPTED",
                    )}
                  >
                    <BadgeCheck size={15} /> پذیرش و ایجاد معامله
                  </button>
                  <button
                    className="btn p-2 text-red-700"
                    formAction={updateOfferStatus.bind(
                      null,
                      offer.id,
                      "REJECTED",
                    )}
                  >
                    رد
                  </button>
                </div>
              </form>
            )}
            {offer.status === "ACCEPTED" && (
              <Link className="btn btn-primary mt-4" href="/deals">
                <Handshake size={16} /> مشاهده معامله
              </Link>
            )}
          </article>
        ))}
        {!offers.length && (
          <div className="empty lg:col-span-2">
            پیشنهادی در این وضعیت وجود ندارد.
          </div>
        )}
      </div>
    </>
  );
}
