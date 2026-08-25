import Link from "next/link";
import { CalendarDays, MapPin, Star, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import {
  createOperationalVisit,
  updateVisitOutcome,
} from "@/app/operations-actions";
import { JalaliDateInput } from "@/components/jalali-date-input";

export const metadata = { title: "بازدیدها" };
export const dynamic = "force-dynamic";

export default async function Visits({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    status?: string;
    created?: string;
    error?: string;
  }>;
}) {
  const user = await requirePermission("visits.manage");
  const canManageAll = await hasPermission(user, "visits.manage_all");
  const query = await searchParams;
  const status = [
    "SCHEDULED",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ].includes(query.status || "")
    ? query.status
    : undefined;
  const [items, properties, applicants, agents] = await Promise.all([
    db.visit.findMany({
      where: {
        agencyId: user.agencyId,
        ...(status ? { status: status as "SCHEDULED" } : {}),
        ...(!canManageAll ? { assignedAgentId: user.id } : {}),
      },
      include: {
        property: true,
        applicant: true,
        assignedAgent: true,
        offers: { orderBy: { round: "desc" }, take: 1 },
      },
      orderBy: { scheduledAt: "asc" },
      take: 150,
    }),
    db.property.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
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
    db.user.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">عملیات بازدید</h1>
          <p className="subtle">
            برنامه‌ریزی، تأیید حضور، بازخورد و اقدام بعدی
          </p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            برنامه‌ریزی بازدید
          </summary>
          <form
            action={createOperationalVisit}
            className="card p-4 absolute left-6 mt-2 w-[420px] max-w-[90vw] z-30 grid gap-3"
          >
            <select
              className="select"
              name="propertyId"
              defaultValue={query.property}
              required
            >
              <option value="">انتخاب فایل</option>
              {properties.map((property) => (
                <option value={property.id} key={property.id}>
                  {property.code} · {property.title}
                </option>
              ))}
            </select>
            <select className="select" name="applicantId" required>
              <option value="">انتخاب متقاضی</option>
              {applicants.map((applicant) => (
                <option value={applicant.id} key={applicant.id}>
                  {applicant.fullName}
                </option>
              ))}
            </select>
            {canManageAll && (
              <select
                className="select"
                name="assignedAgentId"
                defaultValue={user.id}
              >
                {agents.map((agent) => (
                  <option value={agent.id} key={agent.id}>
                    مسئول: {agent.fullName}
                  </option>
                ))}
              </select>
            )}
            <JalaliDateInput name="scheduledAt" includeTime required />
            <textarea
              className="textarea"
              name="notes"
              placeholder="هماهنگی، نشانی قرار و توضیحات"
            />
            <small className="subtle">
              یادآوری پیامکی ۲۴ و ۲ ساعت قبل، در صورت تنظیم SMS، در صف قرار
              می‌گیرد.
            </small>
            <button className="btn btn-primary">
              ثبت و زمان‌بندی یادآورها
            </button>
          </form>
        </details>
      </div>

      {query.created && (
        <div className="toast-note mb-4 text-green-700">
          بازدید و یادآورهای آن ثبت شد.
        </div>
      )}
      {query.error && (
        <div className="toast-note mb-4 text-red-700">
          اطلاعات بازدید معتبر نیست یا این تغییر وضعیت مجاز نیست.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <Link className={`btn ${!status ? "btn-dark" : ""}`} href="/visits">
          همه
        </Link>
        {[
          "SCHEDULED",
          "CONFIRMED",
          "IN_PROGRESS",
          "COMPLETED",
          "NO_SHOW",
          "CANCELLED",
        ].map((item) => (
          <Link
            className={`btn ${status === item ? "btn-dark" : ""}`}
            href={`/visits?status=${item}`}
            key={item}
          >
            {label(item)}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {items.map((visit) => {
          const closed = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
            visit.status,
          );
          return (
            <article className="card p-5" key={visit.id}>
              <div className="flex justify-between gap-3">
                <div className="flex gap-3">
                  <span className="w-11 h-11 rounded-xl bg-green-50 text-green-700 grid place-items-center">
                    <CalendarDays />
                  </span>
                  <div>
                    <Link
                      href={`/properties/${visit.propertyId}`}
                      className="font-black text-lg hover:text-brick"
                    >
                      {visit.property.title}
                    </Link>
                    <p className="subtle flex gap-1">
                      <MapPin size={15} /> {visit.property.neighborhood} ·{" "}
                      {visit.property.code}
                    </p>
                  </div>
                </div>
                <span
                  className={`badge ${visit.status === "COMPLETED" ? "badge-active" : visit.status === "CANCELLED" ? "badge-danger" : "badge-warn"}`}
                >
                  {label(visit.status)}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4 rounded-xl bg-[#f8f6f2] p-3">
                <p className="flex gap-2">
                  <UserRound size={17} /> {visit.applicant.fullName}
                </p>
                <b>{formatDateTime(visit.scheduledAt)}</b>
                <small>مسئول: {visit.assignedAgent.fullName}</small>
                <small>
                  پیشنهادها:{" "}
                  {visit.offers.length
                    ? `دور ${visit.offers[0].round}`
                    : "ثبت نشده"}
                </small>
              </div>
              {visit.feedback && (
                <p className="mt-3 text-sm">بازخورد متقاضی: {visit.feedback}</p>
              )}
              {visit.ownerFeedback && (
                <p className="mt-1 text-sm">
                  بازخورد مالک: {visit.ownerFeedback}
                </p>
              )}
              {visit.applicantRating && (
                <p className="mt-2 text-amber-600">
                  <Star className="inline" size={14} /> امتیاز تجربه:{" "}
                  {visit.applicantRating} از ۵ · علاقه:{" "}
                  {visit.interestLevel || "—"}
                </p>
              )}
              {!closed && (
                <details className="mt-4">
                  <summary className="btn cursor-pointer list-none">
                    ثبت نتیجه و اقدام بعدی
                  </summary>
                  <form
                    action={updateVisitOutcome.bind(null, visit.id)}
                    className="grid md:grid-cols-2 gap-3 mt-3 rounded-xl border p-3"
                  >
                    <select
                      className="select"
                      name="status"
                      defaultValue={
                        visit.status === "SCHEDULED"
                          ? "CONFIRMED"
                          : visit.status === "CONFIRMED"
                            ? "IN_PROGRESS"
                            : "COMPLETED"
                      }
                    >
                      {visit.status === "SCHEDULED" && (
                        <option value="CONFIRMED">تأیید بازدید</option>
                      )}
                      {visit.status !== "IN_PROGRESS" && (
                        <option value="IN_PROGRESS">اعلام حضور</option>
                      )}
                      <option value="COMPLETED">تکمیل بازدید</option>
                      <option value="NO_SHOW">عدم حضور</option>
                      <option value="CANCELLED">لغو</option>
                    </select>
                    <select
                      className="select"
                      name="interestLevel"
                      defaultValue="3"
                    >
                      {[1, 2, 3, 4, 5].map((number) => (
                        <option key={number} value={number}>
                          علاقه {number} از ۵
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="textarea"
                      name="feedback"
                      placeholder="بازخورد متقاضی"
                    />
                    <textarea
                      className="textarea"
                      name="ownerFeedback"
                      placeholder="بازخورد مالک"
                    />
                    <select
                      className="select"
                      name="applicantRating"
                      defaultValue="5"
                    >
                      {[1, 2, 3, 4, 5].map((number) => (
                        <option key={number} value={number}>
                          تجربه بازدید {number} از ۵
                        </option>
                      ))}
                    </select>
                    <JalaliDateInput
                      name="followUpAt"
                      aria-label="تاریخ پیگیری بعدی"
                    />
                    <button className="btn btn-primary md:col-span-2">
                      ذخیره نتیجه
                    </button>
                  </form>
                </details>
              )}
              <div className="flex gap-2 mt-3">
                <Link
                  className="btn p-2 text-xs"
                  href={`/offers?property=${visit.propertyId}&applicant=${visit.applicantId}&visit=${visit.id}`}
                >
                  ثبت پیشنهاد
                </Link>
                <Link
                  className="btn p-2 text-xs"
                  href={`/tasks?property=${visit.propertyId}&contact=${visit.applicantId}`}
                >
                  ایجاد وظیفه
                </Link>
              </div>
            </article>
          );
        })}
        {!items.length && (
          <div className="empty lg:col-span-2">
            بازدیدی در این وضعیت وجود ندارد.
          </div>
        )}
      </div>
    </>
  );
}
