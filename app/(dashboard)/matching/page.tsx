import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreMatch } from "@/lib/matching";
import { formatMoney } from "@/lib/format";
import { createRequirement } from "@/app/actions";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  Phone,
  Plus,
} from "lucide-react";
export const metadata = { title: "تطبیق هوشمند" };
export default async function Matching({
  searchParams,
}: {
  searchParams: Promise<{ requirement?: string }>;
}) {
  const user = await requireUser(),
    query = await searchParams;
  const requirements = await db.requirement.findMany({
    where: { agencyId: user.agencyId, status: "ACTIVE" },
    include: { applicant: true },
    orderBy: { createdAt: "desc" },
  });
  const applicants = await db.contact.findMany({
    where: { agencyId: user.agencyId, type: { in: ["APPLICANT", "BOTH"] } },
  });
  const requirement =
    requirements.find((item) => item.id === query.requirement) ??
    requirements[0];
  const properties = await db.property.findMany({
    where: { agencyId: user.agencyId, status: "ACTIVE" },
    include: { images: { where: { isCover: true }, take: 1 } },
  });
  const matches = requirement
    ? properties
        .map((property) => ({
          property,
          match: scoreMatch(property, {
            ...requirement,
            propertyTypes: JSON.parse(requirement.propertyTypesJson),
            neighborhoods: JSON.parse(requirement.neighborhoodsJson),
          }),
        }))
        .sort((a, b) => b.match.score - a.match.score)
    : [];
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title flex gap-2">
            <Sparkles className="text-brick" /> تطبیق هوشمند
          </h1>
          <p className="subtle">
            امتیازدهی شفاف و قاعده‌محور؛ بدون ادعای یادگیری ماشین
          </p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            <Plus size={17} /> ثبت درخواست
          </summary>
          <form
            action={createRequirement}
            className="card p-5 absolute left-6 mt-2 w-[420px] max-w-[90vw] z-30 grid gap-3"
          >
            <input
              className="input"
              name="title"
              placeholder="عنوان درخواست"
              required
            />
            <select className="select" name="applicantId" required>
              <option value="">انتخاب متقاضی</option>
              {applicants.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
            <select className="select" name="transactionType">
              <option value="SALE">خرید</option>
              <option value="MORTGAGE_RENT">رهن و اجاره</option>
              <option value="RENT">اجاره</option>
            </select>
            <div className="flex flex-wrap gap-3">
              {[
                ["APARTMENT", "آپارتمان"],
                ["HOUSE", "خانه"],
                ["VILLA", "ویلا"],
                ["LAND", "زمین"],
              ].map(([v, l]) => (
                <label key={v}>
                  <input
                    type="checkbox"
                    name="propertyTypes"
                    value={v}
                    defaultChecked={v === "APARTMENT"}
                  />{" "}
                  {l}
                </label>
              ))}
            </div>
            <input
              className="input"
              name="neighborhoods"
              placeholder="محله‌ها با ، جدا شوند"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                type="number"
                name="minArea"
                placeholder="حداقل متراژ"
              />
              <input
                className="input"
                type="number"
                name="maxArea"
                placeholder="حداکثر متراژ"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                name="minBudget"
                placeholder="حداقل بودجه"
              />
              <input
                className="input"
                name="maxBudget"
                placeholder="حداکثر بودجه"
              />
            </div>
            <div className="flex gap-4">
              <label>
                <input type="checkbox" name="parkingRequired" /> پارکینگ الزامی
              </label>
              <label>
                <input type="checkbox" name="elevatorRequired" /> آسانسور الزامی
              </label>
            </div>
            <button className="btn btn-primary">ذخیره و تطبیق</button>
          </form>
        </details>
      </div>
      <form className="card p-4 mb-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="label">درخواست متقاضی</label>
          <select
            name="requirement"
            className="select"
            defaultValue={requirement?.id}
          >
            {requirements.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title} · {item.applicant.fullName}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary">اجرای تطبیق</button>
      </form>
      {requirement && (
        <div className="toast-note mb-4">
          مبنای تطبیق: {requirement.title} · محله‌ها:{" "}
          {(JSON.parse(requirement.neighborhoodsJson) as string[]).join("، ")}
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {matches.map(({ property, match }) => (
          <article className="card p-4 flex gap-4" key={property.id}>
            <div className="relative">
              <Image
                className="w-36 h-32 rounded-xl property-img"
                src={property.images[0]?.url ?? "/property-1.png"}
                alt=""
                width={144}
                height={128}
              />
              <div className="absolute -top-2 -right-2 w-14 h-14 rounded-full bg-ink text-white grid place-items-center font-black text-lg border-4 border-white">
                {match.score}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/properties/${property.id}`}
                className="font-black text-lg block truncate"
              >
                {property.title}
              </Link>
              <p className="subtle">
                {property.code} · {property.neighborhood} · {property.area} متر
              </p>
              <b className="text-brick block mt-1">
                {formatMoney(property.priceTotal ?? property.depositAmount)}
              </b>
              <div className="flex flex-wrap gap-1 mt-2">
                {match.reasons.slice(0, 4).map((reason) => (
                  <span
                    key={reason}
                    className={`badge ${reason.includes("فاقد") || reason.includes("خارج") ? "badge-danger" : "badge-active"}`}
                  >
                    {reason.includes("فاقد") ? (
                      <AlertCircle size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}{" "}
                    {reason}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/activities?property=${property.id}`}
                  className="btn p-2 text-xs"
                >
                  <Phone size={14} /> پیگیری
                </Link>
                <Link
                  href={`/visits?property=${property.id}`}
                  className="btn p-2 text-xs"
                >
                  <CalendarPlus size={14} /> بازدید
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
