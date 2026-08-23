import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeBigInt, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { DynamicPropertyMap } from "@/components/dynamic-map";
import Link from "next/link";
import Image from "next/image";
import { Search, SlidersHorizontal, MapPinned } from "lucide-react";
export const metadata = { title: "نقشه املاک" };
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    neighborhood?: string;
  }>;
}) {
  const u = await requireUser(),
    s = await searchParams;
  const where = {
    agencyId: u.agencyId,
    ...(s.type ? { transactionType: s.type as never } : {}),
    ...(s.status ? { status: s.status as never } : {}),
    ...(s.neighborhood ? { neighborhood: s.neighborhood } : {}),
    ...(s.q
      ? {
          OR: [
            { title: { contains: s.q } },
            { code: { contains: s.q } },
            { address: { contains: s.q } },
          ],
        }
      : {}),
  };
  const [ps, ns] = await Promise.all([
    db.property.findMany({
      where,
      include: { images: { where: { isCover: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.property.findMany({
      where: { agencyId: u.agencyId },
      distinct: ["neighborhood"],
      select: { neighborhood: true },
    }),
  ]);
  const data = serializeBigInt(
    ps.map((p) => ({
      ...p,
      priceTotal: p.priceTotal?.toString(),
      depositAmount: p.depositAmount?.toString(),
      monthlyRent: p.monthlyRent?.toString(),
    })),
  );
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">نقشه املاک ارومیه</h1>
          <p className="subtle">{ps.length} فایل در محدوده نمایش</p>
        </div>
        <span className="badge badge-warn">
          <MapPinned size={15} /> کاشی نقشه نیازمند اینترنت است
        </span>
      </div>
      <form className="card p-3 grid md:grid-cols-[1fr_repeat(3,160px)_auto] gap-2 mb-4">
        <div className="relative">
          <Search className="absolute right-3 top-3 subtle" size={18} />
          <input
            className="input pr-10"
            name="q"
            placeholder="جست‌وجوی روی نقشه…"
            defaultValue={s.q}
          />
        </div>
        <select name="type" className="select" defaultValue={s.type}>
          <option value="">همه معاملات</option>
          <option value="SALE">فروش</option>
          <option value="MORTGAGE_RENT">رهن و اجاره</option>
          <option value="RENT">اجاره</option>
        </select>
        <select name="status" className="select" defaultValue={s.status}>
          <option value="">همه وضعیت‌ها</option>
          <option value="ACTIVE">فعال</option>
          <option value="RESERVED">رزرو</option>
          <option value="SOLD">فروخته‌شده</option>
        </select>
        <select
          name="neighborhood"
          className="select"
          defaultValue={s.neighborhood}
        >
          <option value="">همه محله‌ها</option>
          {ns.map((n) => (
            <option key={n.neighborhood}>{n.neighborhood}</option>
          ))}
        </select>
        <button className="btn btn-dark">
          <SlidersHorizontal size={17} /> فیلتر
        </button>
      </form>
      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="card p-3 max-h-[620px] overflow-auto">
          {ps.map((p) => (
            <Link
              href={`/properties/${p.id}`}
              className="flex gap-3 p-3 border-b hover:bg-[#faf8f5] rounded-xl"
              key={p.id}
            >
              <Image
                className="w-24 h-20 rounded-xl property-img"
                src={p.images[0]?.url ?? "/property-1.png"}
                alt=""
                width={96}
                height={80}
              />
              <div className="min-w-0">
                <b className="block truncate">{p.title}</b>
                <small className="subtle">
                  {p.code} · {p.neighborhood}
                </small>
                <p className="font-bold mt-2 text-brick">
                  {formatMoney(p.priceTotal ?? p.depositAmount)}
                </p>
                <span className="badge">{label(p.status)}</span>
              </div>
            </Link>
          ))}
          {!ps.length && <div className="empty">در این محدوده فایلی نیست.</div>}
        </div>
        <DynamicPropertyMap properties={data} />
      </div>
    </>
  );
}
