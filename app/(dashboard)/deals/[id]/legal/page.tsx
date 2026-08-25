import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FilePlus2,
  FileSignature,
  Link2,
  Paperclip,
  PenLine,
  Plus,
  Printer,
  Scale,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  addContractChecklistItem,
  addContractObligation,
  addContractWitness,
  createContractVersion,
  initializeContractWorkflow,
  saveContractParty,
  saveLegalContractCore,
  toggleContractPartySigned,
  toggleContractWitnessSigned,
  updateContractChecklistStatus,
  updateContractObligationStatus,
  updateContractVersionStatus,
} from "@/app/contract-actions";
import { JalaliDateInput } from "@/components/jalali-date-input";
import { canTransitionContractVersion } from "@/lib/contracts";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";

export const metadata = { title: "پرونده حقوقی قرارداد" };
export const dynamic = "force-dynamic";

const partyRoles = [
  "SELLER",
  "BUYER",
  "LANDLORD",
  "TENANT",
  "OWNER",
  "APPLICANT",
  "GUARANTOR",
  "OTHER",
] as const;

const attachmentKinds = [
  "DRAFT",
  "SIGNED_COPY",
  "IDENTITY",
  "OWNERSHIP",
  "PAYMENT",
  "OTHER",
] as const;

export default async function LegalContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    created?: string;
    uploaded?: string;
    uploadError?: string;
  }>;
}) {
  const user = await requirePermission("deals.view");
  const { id } = await params;
  const query = await searchParams;
  const [canManageAll, canManage] = await Promise.all([
    hasPermission(user, "deals.manage_all"),
    hasPermission(user, "deals.finance"),
  ]);
  const deal = await db.deal.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      ...(!canManageAll ? { assignedAgentId: user.id } : {}),
    },
    include: {
      agency: true,
      owner: true,
      applicant: true,
      property: true,
      contract: {
        include: {
          versions: {
            include: { createdBy: true },
            orderBy: { version: "desc" },
          },
          parties: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          witnesses: { orderBy: { createdAt: "asc" } },
          obligations: {
            include: { responsibleParty: true },
            orderBy: [{ status: "asc" }, { dueAt: "asc" }],
          },
          checklist: {
            include: { verifiedBy: true },
            orderBy: [{ required: "desc" }, { category: "asc" }],
          },
          attachments: {
            include: { asset: true, version: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!deal) notFound();
  if (!deal.contract) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="card p-8 text-center">
          <Scale className="mx-auto mb-4 text-brick" size={46} />
          <h1 className="page-title">پرونده حقوقی معامله</h1>
          <p className="subtle mx-auto mt-3 max-w-xl leading-7">
            با راه‌اندازی پرونده، طرفین از اطلاعات معامله کپی می‌شوند، چک‌لیست
            پایه ساخته می‌شود و نسخه اول پیش‌نویس ایجاد خواهد شد. اطلاعات CRM
            بعدی، snapshot حقوقی قرارداد را بدون اجازه تغییر نمی‌دهد.
          </p>
          {canManage ? (
            <form action={initializeContractWorkflow.bind(null, deal.id)}>
              <button className="btn btn-primary mt-6">
                <FilePlus2 size={18} /> راه‌اندازی پرونده حقوقی
              </button>
            </form>
          ) : (
            <p className="toast-note mt-6">
              این پرونده هنوز توسط مدیر قرارداد ایجاد نشده است.
            </p>
          )}
          <Link className="btn mt-3" href={`/deals/${deal.id}`}>
            بازگشت به معامله
          </Link>
        </div>
      </div>
    );
  }

  const contract = deal.contract;
  const workflowIncomplete =
    contract.versions.length === 0 ||
    contract.parties.length === 0 ||
    contract.checklist.length === 0;
  const latestVersion = contract.versions[0];
  const requiredChecklist = contract.checklist.filter((item) => item.required);
  const verifiedChecklist = requiredChecklist.filter((item) =>
    ["VERIFIED", "NOT_APPLICABLE"].includes(item.status),
  );
  const primaryParties = contract.parties.filter((party) => party.isPrimary);
  const partiesReady =
    primaryParties.length >= 2 &&
    primaryParties.every((party) => party.signedAt);
  const checklistReady =
    requiredChecklist.length > 0 &&
    verifiedChecklist.length === requiredChecklist.length;
  const signedVersion = contract.versions.find(
    (item) => item.status === "SIGNED",
  );
  const overdueCount = contract.obligations.filter(
    (item) => item.status === "PENDING" && item.dueAt < new Date(),
  ).length;
  const readiness = [
    Boolean(contract.contractNumber && contract.contractDate),
    primaryParties.length >= 2,
    partiesReady,
    checklistReady,
    contract.versions.some(
      (item) => item.status === "FINAL" || item.status === "SIGNED",
    ),
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="section-head">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="badge">{label(deal.type)}</span>
            <span
              className={`badge ${signedVersion ? "badge-active" : "badge-warn"}`}
            >
              {signedVersion ? "قرارداد امضاشده" : "در جریان تکمیل"}
            </span>
          </div>
          <h1 className="page-title">پرونده حقوقی {deal.property.code}</h1>
          <p className="subtle">
            {deal.property.title} · {deal.agency.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href={`/deals/${deal.id}`}>
            پرونده معامله
          </Link>
          <Link
            className="btn btn-dark"
            href={`/deals/${deal.id}/contract/print`}
          >
            <Printer size={17} /> نسخه چاپی
          </Link>
        </div>
      </div>

      {(query.error || query.uploadError) && (
        <div className="toast-note text-red-700">
          {query.error === "date"
            ? "تاریخ شمسی واردشده معتبر نیست."
            : query.error === "version"
              ? "عنوان و متن نسخه قرارداد باید کامل باشد."
              : query.error === "sign-readiness"
                ? "برای ثبت امضا، شماره و تاریخ قرارداد، امضای طرفین و تأیید تمام مدارک الزامی است."
                : query.error === "party"
                  ? "اطلاعات طرف قرارداد یا درصد سهم معتبر نیست."
                  : query.error === "obligation"
                    ? "عنوان، مسئول، مبلغ یا تاریخ تعهد را بررسی کنید."
                    : query.uploadError || "اطلاعات واردشده معتبر نیست."}
        </div>
      )}
      {(query.saved || query.created || query.uploaded) && (
        <div className="toast-note text-emerald-700">
          تغییرات پرونده حقوقی ذخیره شد.
        </div>
      )}
      {workflowIncomplete && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-amber-200 bg-amber-50 p-5">
          <div>
            <b>ساختار حقوقی این قرارداد هنوز کامل نشده است.</b>
            <p className="subtle mt-1">
              طرفین، چک‌لیست و پیش‌نویس اولیه از اطلاعات فعلی معامله ساخته
              می‌شوند.
            </p>
          </div>
          {canManage && (
            <form action={initializeContractWorkflow.bind(null, deal.id)}>
              <button className="btn btn-primary">تکمیل پرونده حقوقی</button>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["آمادگی امضا", `${readiness} از ۵`, readiness === 5],
          [
            "نسخه جاری",
            `نسخه ${contract.currentVersion || 1}`,
            Boolean(latestVersion),
          ],
          [
            "مدارک تأیید",
            `${verifiedChecklist.length} از ${requiredChecklist.length}`,
            checklistReady,
          ],
          [
            "امضای طرفین",
            `${primaryParties.filter((item) => item.signedAt).length} از ${primaryParties.length}`,
            partiesReady,
          ],
          ["تعهد عقب‌افتاده", String(overdueCount), overdueCount === 0],
        ].map(([title, value, ready]) => (
          <div className="card p-4" key={String(title)}>
            <small className="subtle">{String(title)}</small>
            <b
              className={`mt-1 block text-xl ${ready ? "text-emerald-700" : "text-amber-700"}`}
            >
              {String(value)}
            </b>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.15fr_.85fr] gap-5">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
              <FileSignature className="text-brick" /> مشخصات و ثبت رسمی
            </h2>
            <form
              action={saveLegalContractCore.bind(null, contract.id)}
              className="grid gap-4"
            >
              <div className="grid md:grid-cols-3 gap-3">
                <label>
                  <span className="label">نوع قرارداد</span>
                  <input
                    className="input"
                    name="contractType"
                    defaultValue={contract.contractType || ""}
                    placeholder="مبایعه‌نامه، اجاره‌نامه…"
                    disabled={!canManage}
                  />
                </label>
                <label>
                  <span className="label">شماره قرارداد</span>
                  <input
                    className="input ltr text-right"
                    name="contractNumber"
                    defaultValue={contract.contractNumber || ""}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  <span className="label">تاریخ قرارداد</span>
                  <JalaliDateInput
                    name="contractDate"
                    defaultValue={contract.contractDate}
                    disabled={!canManage}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="label">موضوع قرارداد</span>
                  <input
                    className="input"
                    name="subject"
                    defaultValue={contract.subject || deal.property.title}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  <span className="label">تاریخ تحویل</span>
                  <JalaliDateInput
                    name="deliveryAt"
                    defaultValue={contract.deliveryAt}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  <span className="label">سامانه ثبت</span>
                  <input
                    className="input"
                    name="registrySystem"
                    defaultValue={contract.registrySystem}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  <span className="label">شناسه ثبت کاتب</span>
                  <input
                    className="input ltr text-right"
                    name="registryReference"
                    defaultValue={contract.registryReference || ""}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  <span className="label">وضعیت ثبت</span>
                  <select
                    className="select"
                    name="registrationStatus"
                    defaultValue={contract.registrationStatus}
                    disabled={!canManage}
                  >
                    {[
                      "NOT_SUBMITTED",
                      "DRAFT",
                      "SUBMITTED",
                      "REGISTERED",
                      "REJECTED",
                    ].map((item) => (
                      <option value={item} key={item}>
                        {label(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span className="label">شروط کلیدی و یادداشت حقوقی</span>
                <textarea
                  className="textarea min-h-28"
                  name="terms"
                  defaultValue={contract.terms || ""}
                  disabled={!canManage}
                />
              </label>
              {canManage && (
                <button className="btn btn-dark justify-center">
                  ذخیره مشخصات حقوقی
                </button>
              )}
            </form>
          </section>

          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <FileClock className="text-brick" /> نسخه‌های قرارداد
                </h2>
                <p className="subtle mt-1">
                  هر تغییر متن در نسخه جدید ثبت می‌شود.
                </p>
              </div>
              <span className="badge">{contract.versions.length} نسخه</span>
            </div>
            {canManage && latestVersion && (
              <details className="mb-5">
                <summary className="btn btn-primary w-fit list-none cursor-pointer">
                  <Plus size={17} /> نسخه جدید
                </summary>
                <form
                  action={createContractVersion.bind(null, contract.id)}
                  className="mt-3 grid gap-3 rounded-2xl border bg-slate-50 p-4"
                >
                  <input
                    className="input"
                    name="title"
                    defaultValue={`بازنگری نسخه ${contract.currentVersion + 1}`}
                    required
                  />
                  <textarea
                    className="textarea min-h-80 font-mono text-sm leading-7"
                    name="body"
                    defaultValue={latestVersion.body}
                    required
                  />
                  <input
                    className="input"
                    name="changeSummary"
                    placeholder="خلاصه تغییرات این نسخه"
                    required
                  />
                  <button className="btn btn-dark justify-center">
                    ذخیره نسخه جدید
                  </button>
                </form>
              </details>
            )}
            <div className="space-y-3">
              {contract.versions.map((version) => (
                <details
                  className="rounded-2xl border p-4"
                  key={version.id}
                  open={version.version === contract.currentVersion}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <b>
                        نسخه {version.version} · {version.title}
                      </b>
                      <small className="block subtle">
                        {version.createdBy.fullName} ·{" "}
                        {formatDateTime(version.createdAt)}
                      </small>
                    </span>
                    <span
                      className={`badge ${version.status === "SIGNED" ? "badge-active" : ""}`}
                    >
                      {label(version.status)}
                    </span>
                  </summary>
                  <div className="mt-4 border-t pt-4">
                    {version.changeSummary && (
                      <p className="toast-note mb-3">
                        تغییرات: {version.changeSummary}
                      </p>
                    )}
                    <pre className="whitespace-pre-wrap font-[inherit] text-sm leading-8">
                      {version.body}
                    </pre>
                    {canManage && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(
                          [
                            "DRAFT",
                            "REVIEW",
                            "FINAL",
                            "SIGNED",
                            "ARCHIVED",
                          ] as const
                        )
                          .filter((next) =>
                            canTransitionContractVersion(version.status, next),
                          )
                          .map((next) => (
                            <form
                              action={updateContractVersionStatus.bind(
                                null,
                                version.id,
                                next,
                              )}
                              key={next}
                            >
                              <button
                                className={
                                  next === "SIGNED" ? "btn btn-primary" : "btn"
                                }
                              >
                                {label(next)}
                              </button>
                            </form>
                          ))}
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
              <Users className="text-brick" /> طرفین قرارداد
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {contract.parties.map((party) => (
                <details className="rounded-2xl border p-4" key={party.id}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                    <span>
                      <b>{party.fullName}</b>
                      <small className="block subtle">
                        {label(party.role)} · سهم {party.shareBasisPoints / 100}
                        ٪
                      </small>
                    </span>
                    <span
                      className={`badge ${party.signedAt ? "badge-active" : "badge-warn"}`}
                    >
                      {party.signedAt ? "امضا ثبت شده" : "بدون امضا"}
                    </span>
                  </summary>
                  <form
                    action={saveContractParty.bind(null, contract.id)}
                    className="mt-4 grid gap-2 border-t pt-4"
                  >
                    <input type="hidden" name="partyId" value={party.id} />
                    <select
                      className="select"
                      name="role"
                      defaultValue={party.role}
                      disabled={!canManage}
                    >
                      {partyRoles.map((item) => (
                        <option value={item} key={item}>
                          {label(item)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      name="fullName"
                      defaultValue={party.fullName}
                      placeholder="نام کامل"
                      disabled={!canManage}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input"
                        name="fatherName"
                        defaultValue={party.fatherName || ""}
                        placeholder="نام پدر"
                        disabled={!canManage}
                      />
                      <input
                        className="input ltr text-right"
                        name="nationalCode"
                        defaultValue={party.nationalCode || ""}
                        placeholder="کد ملی"
                        disabled={!canManage}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input ltr text-right"
                        name="identityNumber"
                        defaultValue={party.identityNumber || ""}
                        placeholder="شماره شناسنامه"
                        disabled={!canManage}
                      />
                      <input
                        className="input ltr text-right"
                        name="mobile"
                        defaultValue={party.mobile || ""}
                        placeholder="شماره همراه"
                        disabled={!canManage}
                      />
                    </div>
                    <input
                      className="input"
                      name="address"
                      defaultValue={party.address || ""}
                      placeholder="نشانی کامل"
                      disabled={!canManage}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input ltr text-right"
                        name="postalCode"
                        defaultValue={party.postalCode || ""}
                        placeholder="کد پستی"
                        disabled={!canManage}
                      />
                      <input
                        className="input ltr text-right"
                        name="sharePercent"
                        defaultValue={party.shareBasisPoints / 100}
                        placeholder="درصد سهم"
                        disabled={!canManage}
                      />
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="isPrimary"
                        defaultChecked={party.isPrimary}
                        disabled={!canManage}
                      />{" "}
                      طرف اصلی قرارداد
                    </label>
                    {canManage && (
                      <button className="btn justify-center">
                        ذخیره اطلاعات طرف
                      </button>
                    )}
                  </form>
                  {canManage && (
                    <form
                      className="mt-2"
                      action={toggleContractPartySigned.bind(null, party.id)}
                    >
                      <button className="btn w-full justify-center">
                        <PenLine size={16} />{" "}
                        {party.signedAt ? "لغو ثبت امضا" : "ثبت دریافت امضا"}
                      </button>
                    </form>
                  )}
                </details>
              ))}
            </div>
            {canManage && (
              <details className="mt-4">
                <summary className="btn list-none cursor-pointer">
                  <Plus size={16} /> افزودن طرف یا ضامن
                </summary>
                <form
                  action={saveContractParty.bind(null, contract.id)}
                  className="mt-3 grid md:grid-cols-3 gap-3 rounded-2xl border p-4"
                >
                  <select className="select" name="role">
                    {partyRoles.map((item) => (
                      <option value={item} key={item}>
                        {label(item)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    name="fullName"
                    placeholder="نام کامل"
                    required
                  />
                  <input
                    className="input"
                    name="fatherName"
                    placeholder="نام پدر"
                  />
                  <input
                    className="input ltr text-right"
                    name="nationalCode"
                    placeholder="کد ملی"
                  />
                  <input
                    className="input ltr text-right"
                    name="identityNumber"
                    placeholder="شماره شناسنامه"
                  />
                  <input
                    className="input ltr text-right"
                    name="mobile"
                    placeholder="شماره همراه"
                  />
                  <input
                    className="input md:col-span-2"
                    name="address"
                    placeholder="نشانی"
                  />
                  <input
                    className="input ltr text-right"
                    name="postalCode"
                    placeholder="کد پستی"
                  />
                  <input
                    className="input ltr text-right"
                    name="sharePercent"
                    defaultValue="100"
                    placeholder="درصد سهم"
                  />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="isPrimary" /> طرف اصلی
                  </label>
                  <button className="btn btn-dark justify-center">
                    افزودن
                  </button>
                </form>
              </details>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
              <ClipboardCheck className="text-brick" /> تعهدات و سررسیدها
            </h2>
            {canManage && (
              <details className="mb-4">
                <summary className="btn list-none cursor-pointer">
                  <Plus size={16} /> تعهد جدید
                </summary>
                <form
                  action={addContractObligation.bind(null, contract.id)}
                  className="mt-3 grid md:grid-cols-2 gap-3 rounded-2xl border p-4"
                >
                  <input
                    className="input"
                    name="title"
                    placeholder="عنوان تعهد"
                    required
                  />
                  <select className="select" name="responsiblePartyId">
                    <option value="">مسئول نامشخص</option>
                    {contract.parties.map((party) => (
                      <option value={party.id} key={party.id}>
                        {party.fullName} · {label(party.role)}
                      </option>
                    ))}
                  </select>
                  <JalaliDateInput name="dueAt" required />
                  <input
                    className="input ltr text-right"
                    name="amountToman"
                    placeholder="مبلغ تعهد؛ اختیاری"
                  />
                  <textarea
                    className="textarea md:col-span-2"
                    name="description"
                    placeholder="شرح دقیق تعهد"
                  />
                  <button className="btn btn-dark justify-center md:col-span-2">
                    ثبت تعهد
                  </button>
                </form>
              </details>
            )}
            <div className="space-y-2">
              {contract.obligations.map((item) => {
                const overdue =
                  item.status === "PENDING" && item.dueAt < new Date();
                return (
                  <div
                    className={`rounded-2xl border p-4 ${overdue ? "border-red-200 bg-red-50" : ""}`}
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <b>{item.title}</b>
                        <small className="block subtle">
                          مسئول:{" "}
                          {item.responsibleParty?.fullName || "تعیین نشده"} ·
                          سررسید {formatDate(item.dueAt)}
                        </small>
                        {item.description && (
                          <p className="mt-2 text-sm">{item.description}</p>
                        )}
                      </div>
                      <div className="text-left">
                        <span
                          className={`badge ${overdue ? "badge-danger" : ""}`}
                        >
                          {overdue ? "عقب‌افتاده" : label(item.status)}
                        </span>
                        {item.amountToman != null && (
                          <b className="mt-1 block">
                            {formatMoney(item.amountToman)}
                          </b>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          [
                            "PENDING",
                            "COMPLETED",
                            "WAIVED",
                            "DISPUTED",
                          ] as const
                        )
                          .filter((status) => status !== item.status)
                          .map((status) => (
                            <form
                              action={updateContractObligationStatus.bind(
                                null,
                                item.id,
                                status,
                              )}
                              key={status}
                            >
                              <button className="btn p-2 text-xs">
                                {label(status)}
                              </button>
                            </form>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {!contract.obligations.length && (
                <p className="empty">تعهدی ثبت نشده است.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
              <BadgeCheck className="text-brick" /> چک‌لیست حقوقی
            </h2>
            <div className="space-y-2">
              {contract.checklist.map((item) => (
                <div className="rounded-xl border p-3" key={item.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <b>{item.title}</b>
                      <small className="block subtle">
                        {item.category}
                        {item.required ? " · الزامی" : ""}
                      </small>
                    </span>
                    <span
                      className={`badge ${item.status === "VERIFIED" ? "badge-active" : ""}`}
                    >
                      {label(item.status)}
                    </span>
                  </div>
                  {canManage && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(
                        [
                          "PENDING",
                          "PROVIDED",
                          "VERIFIED",
                          "REJECTED",
                          "NOT_APPLICABLE",
                        ] as const
                      )
                        .filter((status) => status !== item.status)
                        .map((status) => (
                          <form
                            action={updateContractChecklistStatus.bind(
                              null,
                              item.id,
                              status,
                            )}
                            key={status}
                          >
                            <button className="btn p-1.5 text-xs">
                              {label(status)}
                            </button>
                          </form>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <details className="mt-3">
                <summary className="btn list-none cursor-pointer">
                  <Plus size={15} /> مورد سفارشی
                </summary>
                <form
                  action={addContractChecklistItem.bind(null, contract.id)}
                  className="mt-3 grid gap-2"
                >
                  <input
                    className="input"
                    name="title"
                    placeholder="عنوان مدرک یا کنترل"
                    required
                  />
                  <input
                    className="input"
                    name="category"
                    placeholder="دسته‌بندی"
                  />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="required" defaultChecked />{" "}
                    الزامی
                  </label>
                  <button className="btn justify-center">افزودن</button>
                </form>
              </details>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
              <PenLine className="text-brick" /> شهود
            </h2>
            <div className="space-y-2">
              {contract.witnesses.map((witness) => (
                <div className="rounded-xl border p-3" key={witness.id}>
                  <div className="flex justify-between gap-2">
                    <span>
                      <b>{witness.fullName}</b>
                      <small className="block subtle">
                        {witness.nationalCode || "کد ملی ثبت نشده"}
                      </small>
                    </span>
                    <span
                      className={`badge ${witness.signedAt ? "badge-active" : ""}`}
                    >
                      {witness.signedAt ? "امضا شد" : "بدون امضا"}
                    </span>
                  </div>
                  {canManage && (
                    <form
                      className="mt-2"
                      action={toggleContractWitnessSigned.bind(
                        null,
                        witness.id,
                      )}
                    >
                      <button className="btn w-full justify-center p-2 text-xs">
                        {witness.signedAt ? "لغو امضا" : "ثبت امضا"}
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {!contract.witnesses.length && (
                <p className="empty">شاهدی ثبت نشده است.</p>
              )}
            </div>
            {canManage && (
              <details className="mt-3">
                <summary className="btn list-none cursor-pointer">
                  <Plus size={15} /> افزودن شاهد
                </summary>
                <form
                  action={addContractWitness.bind(null, contract.id)}
                  className="mt-3 grid gap-2"
                >
                  <input
                    className="input"
                    name="fullName"
                    placeholder="نام کامل شاهد"
                    required
                  />
                  <input
                    className="input"
                    name="fatherName"
                    placeholder="نام پدر"
                  />
                  <input
                    className="input ltr text-right"
                    name="nationalCode"
                    placeholder="کد ملی"
                  />
                  <input
                    className="input ltr text-right"
                    name="identityNumber"
                    placeholder="شماره شناسنامه"
                  />
                  <input
                    className="input ltr text-right"
                    name="mobile"
                    placeholder="شماره همراه"
                  />
                  <input className="input" name="address" placeholder="نشانی" />
                  <button className="btn justify-center">افزودن شاهد</button>
                </form>
              </details>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
              <Paperclip className="text-brick" /> پیوست‌ها
            </h2>
            {canManage && (
              <form
                action="/api/uploads"
                method="post"
                encType="multipart/form-data"
                className="grid gap-2 border-b pb-4 mb-4"
              >
                <input type="hidden" name="entityType" value="CONTRACT" />
                <input type="hidden" name="entityId" value={contract.id} />
                <select className="select" name="attachmentKind">
                  {attachmentKinds.map((item) => (
                    <option value={item} key={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
                <select className="select" name="versionId">
                  <option value="">بدون اتصال به نسخه</option>
                  {contract.versions.map((version) => (
                    <option value={version.id} key={version.id}>
                      نسخه {version.version} · {version.title}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  name="title"
                  placeholder="عنوان پیوست"
                />
                <input
                  className="input"
                  type="file"
                  name="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                />
                <button className="btn btn-primary justify-center">
                  <Paperclip size={16} /> بارگذاری امن
                </button>
              </form>
            )}
            <div className="space-y-2">
              {contract.attachments.map((attachment) => (
                <a
                  className="flex items-center justify-between gap-2 rounded-xl border p-3"
                  href={`/api/files/${attachment.assetId}`}
                  target="_blank"
                  rel="noreferrer"
                  key={attachment.id}
                >
                  <span>
                    <b>{attachment.title}</b>
                    <small className="block subtle">
                      {label(attachment.kind)}
                      {attachment.version
                        ? ` · نسخه ${attachment.version.version}`
                        : ""}
                    </small>
                  </span>
                  <Link2 size={17} />
                </a>
              ))}
              {!contract.attachments.length && (
                <p className="empty">پیوستی بارگذاری نشده است.</p>
              )}
            </div>
          </section>

          <section className="card bg-ink p-5 text-white">
            {readiness === 5 ? (
              <CheckCircle2 className="mb-3 text-emerald-300" />
            ) : (
              <ShieldAlert className="mb-3 text-amber-300" />
            )}
            <h3 className="font-black">کنترل پیش از امضا</h3>
            <p className="mt-2 text-sm leading-7 text-white/65">
              نسخه «امضاشده» فقط زمانی ثبت می‌شود که شماره و تاریخ قرارداد کامل،
              نسخه نهایی موجود، همه طرف‌های اصلی امضا و تمام موارد الزامی
              چک‌لیست تأیید شده باشند. متن پیش‌فرض باید توسط کارشناس حقوقی دفتر
              بازبینی شود.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
