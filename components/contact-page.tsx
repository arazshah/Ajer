import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveContact } from "@/app/actions";
import {
  Phone,
  Plus,
  Search,
  UserRound,
  Home,
  ClipboardList,
} from "lucide-react";
import { formatDate } from "@/lib/format";
export async function ContactPage({
  kind,
  q,
  duplicate,
}: {
  kind: "owner" | "applicant";
  q?: string;
  duplicate?: string;
}) {
  const u = await requireUser(),
    type = kind === "owner" ? "OWNER" : "APPLICANT";
  const cs = await db.contact.findMany({
    where: {
      agencyId: u.agencyId,
      type: { in: [type, "BOTH"] },
      ...(q
        ? { OR: [{ fullName: { contains: q } }, { mobile: { contains: q } }] }
        : {}),
    },
    include: {
      _count: {
        select: { ownedProperties: true, requirements: true, activities: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const title = kind === "owner" ? "مالکان" : "متقاضیان";
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="subtle">دفترچه یکپارچه ارتباطات آژانس</p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            <Plus size={18} /> افزودن {kind === "owner" ? "مالک" : "متقاضی"}
          </summary>
          <form
            action={saveContact}
            className="card p-5 absolute left-6 mt-2 w-[340px] z-20"
          >
            <input type="hidden" name="kind" value={kind} />
            <label className="label">نام و نام خانوادگی</label>
            <input className="input mb-3" name="fullName" required />
            <label className="label">شماره همراه</label>
            <input
              className="input ltr text-right mb-3"
              name="mobile"
              required
              placeholder="09120000000"
            />
            <label className="label">یادداشت</label>
            <textarea className="textarea mb-3" name="notes" />
            <button className="btn btn-primary w-full">ذخیره</button>
          </form>
        </details>
      </div>
      {duplicate && (
        <div className="toast-note text-red-600 mb-4">
          این شماره همراه قبلاً ثبت شده است.
        </div>
      )}
      <form className="card p-3 mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 subtle" size={18} />
          <input
            className="input pr-10"
            name="q"
            defaultValue={q}
            placeholder="جست‌وجوی نام یا شماره همراه…"
          />
        </div>
        <button className="btn btn-dark">جست‌وجو</button>
      </form>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cs.map((c) => (
          <article className="card p-5" key={c.id}>
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#f7e9e2] text-brick grid place-items-center">
                <UserRound />
              </div>
              <div>
                <h2 className="font-black text-lg">{c.fullName}</h2>
                <a
                  className="ltr inline-flex items-center gap-1 text-brick"
                  href={`tel:${c.mobile}`}
                >
                  <Phone size={14} />
                  {c.mobile}
                </a>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-5 text-center">
              <div className="bg-[#f8f6f2] p-2 rounded-xl">
                <Home size={15} className="mx-auto" />
                <b className="block mt-1">{c._count.ownedProperties}</b>
                <small>فایل</small>
              </div>
              <div className="bg-[#f8f6f2] p-2 rounded-xl">
                <ClipboardList size={15} className="mx-auto" />
                <b className="block mt-1">{c._count.requirements}</b>
                <small>درخواست</small>
              </div>
              <div className="bg-[#f8f6f2] p-2 rounded-xl">
                <Phone size={15} className="mx-auto" />
                <b className="block mt-1">{c._count.activities}</b>
                <small>پیگیری</small>
              </div>
            </div>
            <p className="subtle text-xs mt-4">
              ثبت در {formatDate(c.createdAt)} · اطلاعات ساختگی
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
