import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  FileText,
  History,
  Phone,
  ShieldCheck,
  Tags,
  Upload,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { saveContactCrmProfile, setDocumentStatus } from "@/app/crm-actions";
import { JalaliDateInput } from "@/components/jalali-date-input";

export const dynamic = "force-dynamic";

export default async function ContactDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    uploaded?: string;
    uploadError?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const user = await requirePermission("contacts.view");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [contact, agents, canManage, canVerify] = await Promise.all([
    db.contact.findFirst({
      where: { id, agencyId: user.agencyId },
      include: {
        assignedAgent: true,
        tagAssignments: { include: { tag: true } },
        documents: {
          include: { asset: true, verifiedBy: true },
          orderBy: { createdAt: "desc" },
        },
        ownedProperties: {
          include: { images: { where: { isCover: true }, take: 1 } },
          orderBy: { createdAt: "desc" },
        },
        requirements: { orderBy: { createdAt: "desc" } },
        activities: {
          include: { user: true, property: true },
          orderBy: { occurredAt: "desc" },
          take: 30,
        },
        visits: {
          include: { property: true, assignedAgent: true },
          orderBy: { scheduledAt: "desc" },
          take: 20,
        },
        dealsAsApplicant: {
          include: { property: true },
          orderBy: { createdAt: "desc" },
        },
        dealsAsOwner: {
          include: { property: true },
          orderBy: { createdAt: "desc" },
        },
        dealReceipts: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.user.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    hasPermission(user, "contacts.manage"),
    hasPermission(user, "documents.verify"),
  ]);
  if (!contact) notFound();
  const deals = [...contact.dealsAsApplicant, ...contact.dealsAsOwner].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const received = contact.dealReceipts
    .filter((item) => item.status === "CLEARED")
    .reduce((sum, item) => sum + item.amountToman, 0n);

  return (
    <>
      <div className="section-head">
        <div className="flex items-center gap-3">
          <div className="feature-icon">
            <UserRound />
          </div>
          <div>
            <div className="flex flex-wrap gap-2 mb-1">
              <span className="badge badge-warn">{label(contact.type)}</span>
              <span className="badge badge-active">
                {label(contact.leadStatus)}
              </span>
              {contact.doNotContact && (
                <span className="badge badge-danger">عدم تماس</span>
              )}
            </div>
            <h1 className="page-title">{contact.fullName}</h1>
            <p className="subtle">
              پروفایل ۳۶۰ درجه مخاطب · امتیاز سرنخ {contact.leadScore} از ۱۰۰
            </p>
          </div>
        </div>
        <a className="btn btn-primary" href={`tel:${contact.mobile}`}>
          <Phone size={17} /> تماس
        </a>
      </div>

      {query.uploaded && (
        <div className="toast-note mb-4 text-green-700">
          فایل با موفقیت و به‌صورت خصوصی بارگذاری شد.
        </div>
      )}
      {query.uploadError && (
        <div className="toast-note mb-4 text-red-700">{query.uploadError}</div>
      )}
      {query.saved && (
        <div className="toast-note mb-4 text-green-700">
          پروفایل CRM با موفقیت ذخیره شد.
        </div>
      )}
      {query.error === "duplicate" && (
        <div className="toast-note mb-4 text-red-700">
          شماره همراه یا کد ملی در مخاطب دیگری از همین دفتر ثبت شده است.
        </div>
      )}

      <section className="grid md:grid-cols-4 gap-3 mb-5">
        {[
          ["فایل ملکی", contact.ownedProperties.length],
          ["درخواست", contact.requirements.length],
          ["معامله", deals.length],
          ["دریافت ثبت‌شده", formatMoney(received)],
        ].map(([title, value]) => (
          <div className="card stat" key={String(title)}>
            <small className="subtle">{title}</small>
            <strong
              className={String(value).includes("تومان") ? "text-base" : ""}
            >
              {String(value)}
            </strong>
          </div>
        ))}
      </section>

      <div className="grid xl:grid-cols-[1.15fr_.85fr] gap-5">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="font-black text-lg mb-4 flex gap-2">
              <BriefcaseBusiness className="text-brick" /> اطلاعات CRM
            </h2>
            {canManage ? (
              <form action={saveContactCrmProfile} className="grid gap-4">
                <input type="hidden" name="contactId" value={contact.id} />
                <div className="grid md:grid-cols-3 gap-3">
                  <label>
                    <span className="label">نام کامل</span>
                    <input
                      className="input"
                      name="fullName"
                      defaultValue={contact.fullName}
                      required
                    />
                  </label>
                  <label>
                    <span className="label">همراه</span>
                    <input
                      className="input ltr text-right"
                      name="mobile"
                      defaultValue={contact.mobile}
                      required
                    />
                  </label>
                  <label>
                    <span className="label">تلفن جایگزین</span>
                    <input
                      className="input ltr text-right"
                      name="alternatePhone"
                      defaultValue={contact.alternatePhone || ""}
                    />
                  </label>
                  <label>
                    <span className="label">کد ملی</span>
                    <input
                      className="input ltr text-right"
                      name="nationalCode"
                      defaultValue={contact.nationalCode || ""}
                    />
                  </label>
                  <label>
                    <span className="label">ایمیل</span>
                    <input
                      className="input ltr text-right"
                      type="email"
                      name="email"
                      defaultValue={contact.email || ""}
                    />
                  </label>
                  <label>
                    <span className="label">تاریخ تولد</span>
                    <JalaliDateInput
                      name="birthDate"
                      defaultValue={contact.birthDate}
                    />
                  </label>
                  <label>
                    <span className="label">وضعیت سرنخ</span>
                    <select
                      className="select"
                      name="leadStatus"
                      defaultValue={contact.leadStatus}
                    >
                      {[
                        "NEW",
                        "CONTACTED",
                        "QUALIFIED",
                        "NEGOTIATING",
                        "CUSTOMER",
                        "LOST",
                        "ARCHIVED",
                      ].map((item) => (
                        <option value={item} key={item}>
                          {label(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">نوع مخاطب</span>
                    <select
                      className="select"
                      name="type"
                      defaultValue={contact.type}
                    >
                      <option value="OWNER">مالک</option>
                      <option value="APPLICANT">متقاضی</option>
                      <option value="BOTH">مالک و متقاضی</option>
                    </select>
                  </label>
                  <label>
                    <span className="label">منبع جذب</span>
                    <select
                      className="select"
                      name="source"
                      defaultValue={contact.source}
                    >
                      <option value="OWNER">مراجعه مستقیم مالک</option>
                      <option value="REFERRAL">معرفی</option>
                      <option value="FIELD_RESEARCH">بازاریابی میدانی</option>
                      <option value="WEBSITE">وب‌سایت</option>
                      <option value="SOCIAL_MEDIA">شبکه اجتماعی</option>
                      <option value="OTHER">سایر</option>
                    </select>
                  </label>
                  <label>
                    <span className="label">امتیاز سرنخ</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="100"
                      name="leadScore"
                      defaultValue={contact.leadScore}
                    />
                  </label>
                  <label>
                    <span className="label">مسئول ارتباط</span>
                    <select
                      className="select"
                      name="assignedAgentId"
                      defaultValue={contact.assignedAgentId || ""}
                    >
                      <option value="">بدون مسئول</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">شغل</span>
                    <input
                      className="input"
                      name="occupation"
                      defaultValue={contact.occupation || ""}
                    />
                  </label>
                  <label>
                    <span className="label">شرکت</span>
                    <input
                      className="input"
                      name="companyName"
                      defaultValue={contact.companyName || ""}
                    />
                  </label>
                  <label>
                    <span className="label">روش ارتباط ترجیحی</span>
                    <select
                      className="select"
                      name="preferredContactMethod"
                      defaultValue={contact.preferredContactMethod}
                    >
                      <option>تماس تلفنی</option>
                      <option>پیامک</option>
                      <option>واتساپ</option>
                      <option>ایمیل</option>
                    </select>
                  </label>
                  <label>
                    <span className="label">استان</span>
                    <input
                      className="input"
                      name="province"
                      defaultValue={contact.province || ""}
                    />
                  </label>
                  <label>
                    <span className="label">شهر</span>
                    <input
                      className="input"
                      name="city"
                      defaultValue={contact.city || ""}
                    />
                  </label>
                  <label>
                    <span className="label">کد پستی</span>
                    <input
                      className="input ltr text-right"
                      name="postalCode"
                      defaultValue={contact.postalCode || ""}
                    />
                  </label>
                </div>
                <label>
                  <span className="label">نشانی</span>
                  <input
                    className="input"
                    name="address"
                    defaultValue={contact.address || ""}
                  />
                </label>
                <label>
                  <span className="label">برچسب‌ها با ویرگول</span>
                  <input
                    className="input"
                    name="tags"
                    defaultValue={contact.tagAssignments
                      .map((item) => item.tag.name)
                      .join("، ")}
                    placeholder="سرمایه‌گذار، مشتری ویژه"
                  />
                </label>
                <label>
                  <span className="label">یادداشت داخلی</span>
                  <textarea
                    className="textarea"
                    name="notes"
                    defaultValue={contact.notes || ""}
                  />
                </label>
                <div className="flex flex-wrap gap-5">
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      name="marketingConsent"
                      defaultChecked={contact.marketingConsent}
                    />{" "}
                    رضایت دریافت پیام‌های بازاریابی
                  </label>
                  <label className="flex gap-2 text-red-700">
                    <input
                      type="checkbox"
                      name="doNotContact"
                      defaultChecked={contact.doNotContact}
                    />{" "}
                    عدم تماس
                  </label>
                </div>
                <div className="flex justify-end">
                  <button className="btn btn-primary">ذخیره پروفایل CRM</button>
                </div>
              </form>
            ) : (
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <p>
                  <b>همراه:</b> {contact.mobile}
                </p>
                <p>
                  <b>مسئول:</b>{" "}
                  {contact.assignedAgent?.fullName || "تعیین نشده"}
                </p>
                <p>
                  <b>شغل:</b> {contact.occupation || "—"}
                </p>
                <p>
                  <b>نشانی:</b> {contact.address || "—"}
                </p>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-black text-lg mb-4 flex gap-2">
              <Building2 className="text-blue-600" /> فایل‌ها و درخواست‌ها
            </h2>
            <div className="grid md:grid-cols-2 gap-3">
              {contact.ownedProperties.map((property) => (
                <Link
                  className="rounded-xl border p-3 hover:border-brick"
                  href={`/properties/${property.id}`}
                  key={property.id}
                >
                  <b>
                    {property.code} · {property.title}
                  </b>
                  <small className="block subtle mt-1">
                    {label(property.transactionType)} · {property.neighborhood}
                  </small>
                </Link>
              ))}
              {contact.requirements.map((requirement) => (
                <div className="rounded-xl border p-3" key={requirement.id}>
                  <b>{requirement.title}</b>
                  <small className="block subtle mt-1">
                    {label(requirement.transactionType)} ·{" "}
                    {label(requirement.status)}
                  </small>
                </div>
              ))}
              {!contact.ownedProperties.length &&
                !contact.requirements.length && (
                  <p className="subtle">هنوز فایل یا درخواستی ثبت نشده است.</p>
                )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-black text-lg mb-4 flex gap-2">
              <History className="text-purple-600" /> تاریخچه تعامل و معامله
            </h2>
            <div className="space-y-3">
              {contact.activities.map((activity) => (
                <div className="border-r-2 border-brick pr-3" key={activity.id}>
                  <b>{activity.subject}</b>
                  <p className="subtle text-sm">{activity.description}</p>
                  <small className="subtle">
                    {activity.user.fullName} ·{" "}
                    {formatDateTime(activity.occurredAt)}
                  </small>
                </div>
              ))}
              {deals.map((deal) => (
                <Link
                  className="block border-r-2 border-green-500 pr-3"
                  href={`/deals/${deal.id}`}
                  key={deal.id}
                >
                  <b>معامله {deal.property.code}</b>
                  <p className="subtle text-sm">
                    {label(deal.status)} ·{" "}
                    {formatMoney(deal.agreedPrice ?? deal.depositAmount)}
                  </p>
                </Link>
              ))}
              {!contact.activities.length && !deals.length && (
                <p className="subtle">تاریخچه‌ای ثبت نشده است.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="font-black text-lg mb-4 flex gap-2">
              <Tags className="text-brick" /> برچسب‌ها
            </h2>
            <div className="flex flex-wrap gap-2">
              {contact.tagAssignments.map(({ tag }) => (
                <span className="badge" key={tag.id}>
                  {tag.name}
                </span>
              ))}
              {!contact.tagAssignments.length && (
                <span className="subtle">بدون برچسب</span>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-black text-lg mb-4 flex gap-2">
              <FileText className="text-green-600" /> مدارک خصوصی
            </h2>
            {canManage && (
              <form
                action="/api/uploads"
                method="post"
                encType="multipart/form-data"
                className="grid gap-3 mb-5 rounded-xl bg-slate-50 p-3"
              >
                <input type="hidden" name="entityType" value="CONTACT" />
                <input type="hidden" name="entityId" value={contact.id} />
                <input type="hidden" name="kind" value="DOCUMENT" />
                <select className="select" name="documentType">
                  <option value="NATIONAL_CARD">کارت ملی</option>
                  <option value="IDENTITY_BOOKLET">شناسنامه</option>
                  <option value="POWER_OF_ATTORNEY">وکالت‌نامه</option>
                  <option value="COMPANY_DOCUMENT">مدرک شرکتی</option>
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
                  <Upload size={16} /> بارگذاری امن
                </button>
              </form>
            )}
            <div className="space-y-3">
              {contact.documents.map((document) => (
                <article className="rounded-xl border p-3" key={document.id}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <a
                        className="font-bold text-brick"
                        href={`/api/files/${document.assetId}`}
                        target="_blank"
                      >
                        {document.title}
                      </a>
                      <small className="block subtle">
                        {document.asset.originalName} ·{" "}
                        {Math.ceil(
                          document.asset.sizeBytes / 1024,
                        ).toLocaleString("fa-IR")}{" "}
                        KB
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
                    </div>
                    <span
                      className={`badge ${document.status === "VERIFIED" ? "badge-active" : document.status === "REJECTED" ? "badge-danger" : "badge-warn"}`}
                    >
                      {label(document.status)}
                    </span>
                  </div>
                  {canVerify && document.status !== "VERIFIED" && (
                    <div className="flex gap-2 mt-3">
                      <form
                        action={setDocumentStatus.bind(
                          null,
                          "CONTACT",
                          document.id,
                          "VERIFIED",
                        )}
                      >
                        <button className="btn p-2 text-green-700">
                          <BadgeCheck size={15} /> تأیید
                        </button>
                      </form>
                      <form
                        action={setDocumentStatus.bind(
                          null,
                          "CONTACT",
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
              {!contact.documents.length && (
                <p className="subtle">مدرکی بارگذاری نشده است.</p>
              )}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-black text-lg mb-3 flex gap-2">
              <ShieldCheck className="text-blue-600" /> حریم ارتباط
            </h2>
            <p className="subtle text-sm leading-7">
              مدارک فقط برای اعضای مجاز همین دفتر قابل مشاهده‌اند. وضعیت رضایت
              بازاریابی و عدم تماس پیش از ارسال پیام باید کنترل شود.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
