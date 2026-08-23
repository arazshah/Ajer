import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/labels";
import Link from "next/link";
import { createVisit, updateVisitStatus } from "@/app/actions";
import { CalendarDays, MapPin, UserRound, Star } from "lucide-react";
export const metadata = { title: "بازدیدها" };
export default async function Visits({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const u = await requireUser();
  const query = await searchParams;
  const [items, properties, applicants] = await Promise.all([
    db.visit.findMany({
      where: { agencyId: u.agencyId },
      include: { property: true, applicant: true, assignedAgent: true },
      orderBy: { scheduledAt: "asc" },
    }),
    db.property.findMany({
      where: { agencyId: u.agencyId, status: "ACTIVE" },
      select: { id: true, code: true, title: true },
    }),
    db.contact.findMany({
      where: { agencyId: u.agencyId, type: { in: ["APPLICANT", "BOTH"] } },
      select: { id: true, fullName: true },
    }),
  ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">بازدیدها</h1>
          <p className="subtle">تقویم بازدید فایل‌ها</p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            برنامه‌ریزی بازدید
          </summary>
          <form
            action={createVisit}
            className="card p-4 absolute left-6 mt-2 w-[380px] max-w-[90vw] z-30 grid gap-3"
          >
            <select
              className="select"
              name="propertyId"
              defaultValue={query.property}
              required
            >
              <option value="">انتخاب فایل</option>
              {properties.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.code} · {p.title}
                </option>
              ))}
            </select>
            <select className="select" name="applicantId" required>
              <option value="">انتخاب متقاضی</option>
              {applicants.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
            <input
              className="input ltr"
              type="datetime-local"
              name="scheduledAt"
              required
            />
            <textarea
              className="textarea"
              name="notes"
              placeholder="یادداشت بازدید"
            />
            <button className="btn btn-primary">ثبت بازدید</button>
          </form>
        </details>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((v) => (
          <article className="card p-5" key={v.id}>
            <div className="flex justify-between">
              <div className="w-11 h-11 rounded-xl bg-green-50 text-green-700 grid place-items-center">
                <CalendarDays />
              </div>
              <span
                className={`badge ${v.status === "SCHEDULED" ? "badge-active" : ""}`}
              >
                {label(v.status)}
              </span>
            </div>
            <Link
              href={`/properties/${v.propertyId}`}
              className="font-black text-lg block mt-4"
            >
              {v.property.title}
            </Link>
            <p className="subtle flex gap-1 mt-2">
              <MapPin size={15} />
              {v.property.neighborhood} · {v.property.code}
            </p>
            <p className="flex gap-2 mt-4">
              <UserRound size={17} />
              {v.applicant.fullName}
            </p>
            <div className="mt-4 p-3 rounded-xl bg-[#f8f6f2]">
              <b>{formatDateTime(v.scheduledAt)}</b>
              <small className="block subtle">
                مسئول: {v.assignedAgent.fullName}
              </small>
            </div>
            {v.feedback && (
              <p className="mt-3 text-sm">
                {v.feedback}{" "}
                {v.applicantRating && (
                  <span className="text-amber-500">
                    <Star className="inline" size={14} /> {v.applicantRating}
                  </span>
                )}
              </p>
            )}
            {v.status === "SCHEDULED" && (
              <div className="flex gap-2 mt-3">
                <form action={updateVisitStatus.bind(null, v.id, "COMPLETED")}>
                  <button className="btn p-2 text-xs">تکمیل بازدید</button>
                </form>
                <form action={updateVisitStatus.bind(null, v.id, "CANCELLED")}>
                  <button className="btn p-2 text-xs text-red-600">لغو</button>
                </form>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
