import { hasPermission, requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";
import { label } from "@/lib/labels";
import { updateDealStatus, createDeal } from "@/app/actions";
import Link from "next/link";
import { Handshake, ArrowLeft, Eye } from "lucide-react";
const stages = [
  "NEGOTIATION",
  "AGREED",
  "CONTRACTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const metadata = { title: "معاملات" };
export default async function Deals({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const u = await requirePermission("deals.view");
  const [canManageAll, canCreate, canManage] = await Promise.all([
    hasPermission(u, "deals.manage_all"),
    hasPermission(u, "deals.create"),
    hasPermission(u, "deals.manage"),
  ]);
  const query = await searchParams;
  const [deals, properties, applicants] = await Promise.all([
    db.deal.findMany({
      where: {
        agencyId: u.agencyId,
        ...(!canManageAll ? { assignedAgentId: u.id } : {}),
      },
      include: {
        property: true,
        applicant: true,
        owner: true,
        assignedAgent: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.property.findMany({
      where: { agencyId: u.agencyId, status: { in: ["ACTIVE", "RESERVED"] } },
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
          <h1 className="page-title">خط لوله معاملات</h1>
          <p className="subtle">مدیریت مذاکره تا قرارداد نهایی</p>
        </div>
        {canCreate && (
          <details>
            <summary className="btn btn-primary list-none cursor-pointer">
              ایجاد معامله
            </summary>
            <form
              action={createDeal}
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
                className="input"
                name="agreedPrice"
                placeholder="قیمت توافقی (تومان)"
              />
              <textarea
                className="textarea"
                name="notes"
                placeholder="یادداشت مذاکره"
              />
              <button className="btn btn-primary">ثبت در مذاکره</button>
            </form>
          </details>
        )}
      </div>
      <div className="kanban">
        {stages.map((stage, idx) => (
          <section className="kanban-col" key={stage}>
            <div className="flex justify-between items-center px-2 py-2">
              <b>{label(stage)}</b>
              <span className="badge">
                {deals.filter((d) => d.status === stage).length}
              </span>
            </div>
            {deals
              .filter((d) => d.status === stage)
              .map((d) => (
                <article className="card p-4 mb-3" key={d.id}>
                  <div className="flex gap-2 items-center">
                    <Handshake size={17} className="text-brick" />
                    <Link
                      href={`/properties/${d.propertyId}`}
                      className="font-bold"
                    >
                      {d.property.title}
                    </Link>
                  </div>
                  <p className="subtle text-xs mt-2">
                    {d.applicant.fullName} ↔ {d.owner.fullName}
                  </p>
                  <b className="block mt-3">
                    {formatMoney(d.agreedPrice ?? d.depositAmount)}
                  </b>
                  <small className="subtle">
                    کمیسیون: {formatMoney(d.commissionAmount)}
                  </small>
                  <div className="flex justify-between mt-4">
                    <small>{formatDate(d.createdAt)}</small>
                    {idx < 3 && canManage && (
                      <form
                        action={updateDealStatus.bind(
                          null,
                          d.id,
                          stages[idx + 1],
                        )}
                      >
                        <button className="text-brick font-bold text-xs">
                          مرحله بعد <ArrowLeft className="inline" size={13} />
                        </button>
                      </form>
                    )}
                  </div>
                  <Link
                    href={`/deals/${d.id}`}
                    className="btn mt-3 w-full justify-center text-xs"
                  >
                    <Eye size={14} /> پرونده کامل معامله
                  </Link>
                </article>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
