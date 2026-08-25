import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";

export const metadata = { title: "چاپ قرارداد" };
export const dynamic = "force-dynamic";

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("deals.view");
  const { id } = await params;
  const canManageAll = await hasPermission(user, "deals.manage_all");
  const deal = await db.deal.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
    include: {
      agency: true,
      property: true,
      contract: {
        include: {
          versions: { orderBy: { version: "desc" } },
          parties: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          witnesses: { orderBy: { createdAt: "asc" } },
          obligations: {
            include: { responsibleParty: true },
            orderBy: { dueAt: "asc" },
          },
          checklist: { orderBy: [{ required: "desc" }, { category: "asc" }] },
        },
      },
    },
  });
  if (!deal?.contract) notFound();
  const contract = deal.contract;
  const version =
    contract.versions.find((item) => item.status === "SIGNED") ||
    contract.versions.find((item) => item.status === "FINAL") ||
    contract.versions[0];
  if (!version) notFound();

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black">
      <div className="no-print mb-5 flex items-center justify-between gap-3">
        <Link className="btn" href={`/deals/${deal.id}/legal`}>
          بازگشت به پرونده حقوقی
        </Link>
        <PrintButton />
      </div>

      <article className="contract-print border border-black/20 p-[12mm]">
        <header className="mb-8 border-b-2 border-black pb-5 text-center">
          <div className="text-sm">بسمه تعالی</div>
          <h1 className="mt-3 text-2xl font-black">
            {contract.contractType || "قرارداد ملکی"}
          </h1>
          <p className="mt-2 font-bold">{deal.agency.name}</p>
          <p className="mt-1 text-sm">
            شماره: {contract.contractNumber || "—"} · تاریخ:{" "}
            {contract.contractDate ? formatDate(contract.contractDate) : "—"} ·
            نسخه {version.version}
          </p>
        </header>

        <section className="mb-7 break-inside-avoid">
          <h2 className="mb-3 border-b pb-2 text-lg font-black">
            مشخصات قرارداد
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p>
              <b>موضوع:</b> {contract.subject || deal.property.title}
            </p>
            <p>
              <b>وضعیت ثبت:</b> {label(contract.registrationStatus)}
            </p>
            <p>
              <b>سامانه ثبت:</b> {contract.registrySystem}
            </p>
            <p>
              <b>شناسه ثبت:</b> {contract.registryReference || "—"}
            </p>
            <p className="col-span-2">
              <b>ملک:</b> {deal.property.title}، {deal.property.address}
            </p>
            <p>
              <b>تاریخ تحویل:</b>{" "}
              {contract.deliveryAt
                ? formatDate(contract.deliveryAt)
                : "طبق متن قرارداد"}
            </p>
            <p>
              <b>وضعیت نسخه:</b> {label(version.status)}
            </p>
          </div>
        </section>

        <section className="mb-7 break-inside-avoid">
          <h2 className="mb-3 border-b pb-2 text-lg font-black">
            طرفین قرارداد
          </h2>
          <div className="space-y-3">
            {contract.parties.map((party, index) => (
              <div
                className="rounded-lg border border-black/30 p-3 text-sm"
                key={party.id}
              >
                <b>
                  {index + 1}. {party.fullName} ({label(party.role)})
                </b>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span>نام پدر: {party.fatherName || "—"}</span>
                  <span>کد ملی: {party.nationalCode || "—"}</span>
                  <span>شماره شناسنامه: {party.identityNumber || "—"}</span>
                  <span>همراه: {party.mobile || "—"}</span>
                  <span>سهم: {party.shareBasisPoints / 100}٪</span>
                  <span>کد پستی: {party.postalCode || "—"}</span>
                  <span className="col-span-2">
                    نشانی: {party.address || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-7">
          <h2 className="mb-3 border-b pb-2 text-lg font-black">
            متن نسخه قرارداد
          </h2>
          <div className="whitespace-pre-wrap text-justify text-sm leading-8">
            {version.body}
          </div>
        </section>

        {contract.obligations.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-3 border-b pb-2 text-lg font-black">
              تعهدات و سررسیدها
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2">تعهد</th>
                  <th className="border p-2">مسئول</th>
                  <th className="border p-2">سررسید</th>
                  <th className="border p-2">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                {contract.obligations.map((item) => (
                  <tr key={item.id}>
                    <td className="border p-2">{item.title}</td>
                    <td className="border p-2">
                      {item.responsibleParty?.fullName || "—"}
                    </td>
                    <td className="border p-2">{formatDate(item.dueAt)}</td>
                    <td className="border p-2">
                      {item.amountToman == null
                        ? "—"
                        : formatMoney(item.amountToman)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-3 border-b pb-2 text-lg font-black">کنترل مدارک</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {contract.checklist.map((item) => (
              <p key={item.id}>
                □ {item.title}: <b>{label(item.status)}</b>
              </p>
            ))}
          </div>
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-5 border-b pb-2 text-lg font-black">امضاها</h2>
          <div className="grid grid-cols-2 gap-x-10 gap-y-16 text-center text-sm">
            {contract.parties.map((party) => (
              <div className="border-t border-black pt-2" key={party.id}>
                امضای {label(party.role)} · {party.fullName}
                {party.signedAt
                  ? ` · ثبت‌شده ${formatDate(party.signedAt)}`
                  : ""}
              </div>
            ))}
            {contract.witnesses.map((witness) => (
              <div className="border-t border-black pt-2" key={witness.id}>
                امضای شاهد · {witness.fullName}
                {witness.signedAt
                  ? ` · ثبت‌شده ${formatDate(witness.signedAt)}`
                  : ""}
              </div>
            ))}
            <div className="border-t border-black pt-2">
              مهر و امضای {deal.agency.name}
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t pt-3 text-center text-xs text-black/60">
          خروجی سامانه آجر · این نسخه باید پیش از امضا توسط طرفین و کارشناس
          حقوقی بررسی شود.
        </footer>
      </article>
    </div>
  );
}
