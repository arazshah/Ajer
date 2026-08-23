import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import Link from "next/link";
import Image from "next/image";
import { Plus, Search, Eye, Pencil, Copy } from "lucide-react";
import { archiveProperty, duplicateProperty } from "@/app/actions";
import { ConfirmArchive } from "@/components/confirm-action";
import { AiPropertySearch } from "@/components/ai-property-search";
export const metadata = { title: "فایل‌های ملکی" };
export default async function Properties({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const u = await requireUser(),
    s = await searchParams,
    q = s.q?.trim(),
    page = Math.max(1, Number(s.page) || 1);
  const where = {
    agencyId: u.agencyId,
    ...(s.status ? { status: s.status as never } : {}),
    ...(s.type ? { transactionType: s.type as never } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q } },
            { title: { contains: q } },
            { neighborhood: { contains: q } },
            { address: { contains: q } },
            { owner: { fullName: { contains: q } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.property.findMany({
      where,
      include: {
        owner: true,
        assignedAgent: true,
        images: { where: { isCover: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 10,
      take: 10,
    }),
    db.property.count({ where }),
  ]);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">فایل‌های ملکی</h1>
          <p className="subtle">{total} فایل مطابق فیلترها</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn" href="/api/export/properties">
            خروجی CSV
          </Link>
          <Link className="btn btn-primary" href="/properties/new">
            <Plus size={18} /> افزودن فایل
          </Link>
        </div>
      </div>
      <AiPropertySearch />
      <form className="card p-3 mb-4 grid md:grid-cols-[1fr_180px_180px_auto] gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-3 subtle" size={18} />
          <input
            className="input pr-10"
            name="q"
            defaultValue={q}
            placeholder="کد، عنوان، محله یا مالک…"
          />
        </div>
        <select className="select" name="type" defaultValue={s.type}>
          <option value="">همه معاملات</option>
          <option value="SALE">فروش</option>
          <option value="MORTGAGE_RENT">رهن و اجاره</option>
          <option value="RENT">اجاره</option>
        </select>
        <select className="select" name="status" defaultValue={s.status}>
          <option value="">همه وضعیت‌ها</option>
          <option value="ACTIVE">فعال</option>
          <option value="RESERVED">رزرو</option>
          <option value="SOLD">فروخته‌شده</option>
          <option value="INACTIVE">غیرفعال</option>
        </select>
        <button className="btn btn-dark">اعمال فیلتر</button>
      </form>
      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>فایل</th>
              <th>نوع</th>
              <th>محله</th>
              <th>قیمت</th>
              <th>مسئول</th>
              <th>وضعیت</th>
              <th>ثبت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="flex gap-3 items-center">
                    <Image
                      className="w-14 h-12 rounded-lg property-img"
                      src={p.images[0]?.url ?? "/property-1.png"}
                      alt=""
                      width={56}
                      height={48}
                    />
                    <div>
                      <Link
                        href={`/properties/${p.id}`}
                        className="font-bold hover:text-brick"
                      >
                        {p.title}
                      </Link>
                      <small className="block subtle ltr text-right">
                        {p.code} · {p.area} متر
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge">{label(p.transactionType)}</span>
                </td>
                <td>{p.neighborhood}</td>
                <td className="font-bold">
                  {formatMoney(p.priceTotal ?? p.depositAmount)}
                </td>
                <td>{p.assignedAgent.fullName}</td>
                <td>
                  <span
                    className={`badge ${p.status === "ACTIVE" ? "badge-active" : p.status === "INACTIVE" ? "badge-danger" : "badge-warn"}`}
                  >
                    {label(p.status)}
                  </span>
                </td>
                <td>{formatDate(p.createdAt)}</td>
                <td>
                  <div className="flex gap-1">
                    <Link
                      className="btn p-2"
                      href={`/properties/${p.id}`}
                      aria-label="نمایش"
                    >
                      <Eye size={16} />
                    </Link>
                    <Link
                      className="btn p-2"
                      href={`/properties/${p.id}/edit`}
                      aria-label="ویرایش"
                    >
                      <Pencil size={16} />
                    </Link>
                    <form action={duplicateProperty.bind(null, p.id)}>
                      <button className="btn p-2" aria-label="کپی">
                        <Copy size={16} />
                      </button>
                    </form>
                    <ConfirmArchive action={archiveProperty.bind(null, p.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="empty">فایلی مطابق جست‌وجوی شما پیدا نشد.</div>
        )}
      </div>
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: Math.ceil(total / 10) }, (_, i) => (
          <Link
            className={`btn p-2.5 ${i + 1 === page ? "btn-dark" : ""}`}
            href={`?page=${i + 1}`}
            key={i}
          >
            {i + 1}
          </Link>
        ))}
      </div>
    </>
  );
}
