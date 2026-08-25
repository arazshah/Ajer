import Link from "next/link";
import { CheckCircle2, CircleDashed, ListTodo, TimerOff } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { createWorkTask, updateWorkTaskStatus } from "@/app/operations-actions";
import { JalaliDateInput } from "@/components/jalali-date-input";

export const metadata = { title: "وظایف تیم" };
export const dynamic = "force-dynamic";

export default async function Tasks({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    property?: string;
    contact?: string;
    created?: string;
    error?: string;
  }>;
}) {
  const user = await requirePermission("activities.manage");
  const canManageAll = await hasPermission(user, "activities.manage_all");
  const query = await searchParams;
  const tab = query.tab || "open";
  const now = new Date();
  const [tasks, agents, contacts, properties] = await Promise.all([
    db.workTask.findMany({
      where: {
        agencyId: user.agencyId,
        ...(!canManageAll ? { assignedToId: user.id } : {}),
        ...(tab === "completed"
          ? { status: "COMPLETED" }
          : tab === "overdue"
            ? {
                status: { in: ["OPEN", "IN_PROGRESS"] },
                dueAt: { lt: now },
              }
            : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
      },
      include: {
        assignedTo: true,
        createdBy: true,
        contact: true,
        property: true,
      },
      orderBy: { dueAt: "asc" },
      take: 200,
    }),
    db.user.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.contact.findMany({
      where: { agencyId: user.agencyId },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 300,
    }),
    db.property.findMany({
      where: {
        agencyId: user.agencyId,
        status: { in: ["ACTIVE", "RESERVED"] },
      },
      select: { id: true, code: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">وظایف تیم</h1>
          <p className="subtle">واگذاری، اولویت، سررسید و یادآوری خودکار</p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            وظیفه جدید
          </summary>
          <form
            action={createWorkTask}
            className="card p-4 absolute left-6 mt-2 w-[430px] max-w-[90vw] z-30 grid gap-3"
          >
            <input
              className="input"
              name="title"
              placeholder="عنوان وظیفه"
              minLength={3}
              required
            />
            <textarea
              className="textarea"
              name="description"
              placeholder="شرح و نتیجه مورد انتظار"
            />
            {canManageAll && (
              <select
                className="select"
                name="assignedToId"
                defaultValue={user.id}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    مسئول: {agent.fullName}
                  </option>
                ))}
              </select>
            )}
            <select
              className="select"
              name="contactId"
              defaultValue={query.contact || ""}
            >
              <option value="">بدون مخاطب</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.fullName}
                </option>
              ))}
            </select>
            <select
              className="select"
              name="propertyId"
              defaultValue={query.property || ""}
            >
              <option value="">بدون فایل</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code} · {property.title}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select className="select" name="priority" defaultValue="NORMAL">
                <option value="LOW">کم</option>
                <option value="NORMAL">عادی</option>
                <option value="HIGH">زیاد</option>
              </select>
              <JalaliDateInput name="dueAt" includeTime required />
            </div>
            <button className="btn btn-primary">واگذاری وظیفه</button>
          </form>
        </details>
      </div>
      {query.created && (
        <div className="toast-note mb-4 text-green-700">
          وظیفه ایجاد و به مسئول آن اعلان شد.
        </div>
      )}
      {query.error && (
        <div className="toast-note mb-4 text-red-700">
          اطلاعات وظیفه معتبر نیست.
        </div>
      )}
      <div className="flex gap-2 mb-4">
        {[
          ["open", "باز"],
          ["overdue", "عقب‌افتاده"],
          ["completed", "تکمیل‌شده"],
        ].map(([value, title]) => (
          <Link
            className={`btn ${tab === value ? "btn-dark" : ""}`}
            href={`/tasks?tab=${value}`}
            key={value}
          >
            {title}
          </Link>
        ))}
      </div>
      <div className="card overflow-hidden">
        {tasks.map((task) => {
          const overdue = task.status !== "COMPLETED" && task.dueAt < now;
          return (
            <article
              className="p-4 border-b flex flex-col md:flex-row md:items-center gap-4"
              key={task.id}
            >
              <span
                className={`w-11 h-11 rounded-xl grid place-items-center ${overdue ? "bg-red-50 text-red-600" : task.status === "COMPLETED" ? "bg-green-50 text-green-700" : "bg-orange-50 text-brick"}`}
              >
                {task.status === "COMPLETED" ? (
                  <CheckCircle2 />
                ) : overdue ? (
                  <TimerOff />
                ) : (
                  <ListTodo />
                )}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  <b>{task.title}</b>
                  <span
                    className={`badge ${task.priority === "HIGH" ? "badge-danger" : ""}`}
                  >
                    {label(task.priority)}
                  </span>
                  <span className="badge">{label(task.status)}</span>
                </div>
                <p className="subtle text-sm">
                  {task.description || "بدون توضیح"}
                </p>
                <small>
                  {task.contact?.fullName}
                  {task.property ? ` · ${task.property.code}` : ""} ·
                  ایجادکننده: {task.createdBy.fullName}
                </small>
              </div>
              <div className="md:text-left">
                <b className={overdue ? "text-red-600" : ""}>
                  {formatDateTime(task.dueAt)}
                </b>
                <small className="block subtle">
                  مسئول: {task.assignedTo.fullName}
                </small>
              </div>
              {task.status !== "COMPLETED" && (
                <div className="flex gap-2">
                  <form
                    action={updateWorkTaskStatus.bind(
                      null,
                      task.id,
                      "IN_PROGRESS",
                    )}
                  >
                    <button className="btn p-2" aria-label="شروع">
                      <CircleDashed size={17} />
                    </button>
                  </form>
                  <form
                    action={updateWorkTaskStatus.bind(
                      null,
                      task.id,
                      "COMPLETED",
                    )}
                  >
                    <button
                      className="btn p-2 text-green-700"
                      aria-label="تکمیل"
                    >
                      <CheckCircle2 size={17} />
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
        {!tasks.length && (
          <div className="empty">وظیفه‌ای در این بخش نیست.</div>
        )}
      </div>
    </>
  );
}
