import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/labels";
import { toggleActivity, createActivity } from "@/app/actions";
import {
  CheckCircle2,
  Circle,
  Phone,
  MessageSquare,
  ClipboardCheck,
} from "lucide-react";
export const metadata = { title: "پیگیری‌ها" };
export default async function Activities({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; property?: string }>;
}) {
  const u = await requireUser(),
    s = await searchParams,
    now = new Date();
  const tab = s.tab ?? "today";
  const where = {
    agencyId: u.agencyId,
    ...(tab === "completed"
      ? { completed: true }
      : tab === "overdue"
        ? { completed: false, nextActionAt: { lt: now } }
        : { completed: false }),
  };
  const [items, contacts, properties] = await Promise.all([
    db.activity.findMany({
      where,
      include: { contact: true, property: true, user: true },
      orderBy: { nextActionAt: "asc" },
      take: 100,
    }),
    db.contact.findMany({
      where: { agencyId: u.agencyId },
      select: { id: true, fullName: true },
    }),
    db.property.findMany({
      where: { agencyId: u.agencyId, status: "ACTIVE" },
      select: { id: true, code: true, title: true },
    }),
  ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">پیگیری‌ها</h1>
          <p className="subtle">تماس‌ها و اقدامات بعدی تیم</p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            ثبت پیگیری
          </summary>
          <form
            action={createActivity}
            className="card p-4 absolute left-6 mt-2 w-[380px] max-w-[90vw] z-30 grid gap-3"
          >
            <input
              className="input"
              name="subject"
              placeholder="موضوع پیگیری"
              required
            />
            <textarea
              className="textarea"
              name="description"
              placeholder="شرح پیگیری"
              required
            />
            <select className="select" name="contactId">
              <option value="">انتخاب مخاطب</option>
              {contacts.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
            <select
              className="select"
              name="propertyId"
              defaultValue={s.property}
            >
              <option value="">بدون فایل مرتبط</option>
              {properties.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.code} · {p.title}
                </option>
              ))}
            </select>
            <input
              className="input ltr"
              type="datetime-local"
              name="nextActionAt"
              required
            />
            <button className="btn btn-primary">ذخیره پیگیری</button>
          </form>
        </details>
      </div>
      <div className="flex gap-2 mb-4">
        {[
          ["today", "باز"],
          ["overdue", "عقب‌افتاده"],
          ["completed", "تکمیل‌شده"],
        ].map(([v, l]) => (
          <a
            href={`?tab=${v}`}
            className={`btn ${tab === v ? "btn-dark" : ""}`}
            key={v}
          >
            {l}
          </a>
        ))}
      </div>
      <div className="card overflow-hidden">
        {items.map((a) => {
          const overdue =
            !a.completed && a.nextActionAt && a.nextActionAt < now;
          return (
            <div className="flex gap-4 items-center p-4 border-b" key={a.id}>
              <form action={toggleActivity.bind(null, a.id)}>
                <button
                  className={a.completed ? "text-green-600" : "text-slate-300"}
                  aria-label="تغییر وضعیت"
                >
                  {a.completed ? <CheckCircle2 /> : <Circle />}
                </button>
              </form>
              <div
                className={`w-10 h-10 rounded-xl grid place-items-center ${overdue ? "bg-red-50 text-red-600" : "bg-orange-50 text-brick"}`}
              >
                {a.type === "CALL" ? (
                  <Phone size={18} />
                ) : a.type === "MESSAGE" ? (
                  <MessageSquare size={18} />
                ) : (
                  <ClipboardCheck size={18} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex gap-2">
                  <b>{a.subject}</b>
                  <span className={`badge ${overdue ? "badge-danger" : ""}`}>
                    {label(a.priority)}
                  </span>
                </div>
                <p className="subtle text-sm">
                  {a.contact?.fullName} {a.property && `· ${a.property.code}`} ·{" "}
                  {a.description}
                </p>
              </div>
              <div className="text-left">
                <b className={overdue ? "text-red-600" : ""}>
                  {a.nextActionAt
                    ? formatDateTime(a.nextActionAt)
                    : "بدون موعد"}
                </b>
                <small className="block subtle">{a.user.fullName}</small>
              </div>
            </div>
          );
        })}
        {!items.length && <div className="empty">موردی در این بخش نیست.</div>}
      </div>
    </>
  );
}
