import { hasPermission, requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import Link from "next/link";
import { Search, Building2, Users, ClipboardList } from "lucide-react";
export const metadata = { title: "جست‌وجو" };
export default async function GlobalSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const u = await requirePermission("properties.view"),
    q = (await searchParams).q?.trim() ?? "";
  const [canViewContacts, canViewRequirements] = await Promise.all([
    hasPermission(u, "contacts.view"),
    hasPermission(u, "requirements.manage"),
  ]);
  const [ps, cs, rs] = q
    ? await Promise.all([
        db.property.findMany({
          where: {
            agencyId: u.agencyId,
            OR: [
              { code: { contains: q } },
              { title: { contains: q } },
              { address: { contains: q } },
              { neighborhood: { contains: q } },
            ],
          },
          take: 8,
        }),
        canViewContacts
          ? db.contact.findMany({
              where: {
                agencyId: u.agencyId,
                OR: [
                  { fullName: { contains: q } },
                  { mobile: { contains: q } },
                ],
              },
              take: 8,
            })
          : Promise.resolve([]),
        canViewRequirements
          ? db.requirement.findMany({
              where: { agencyId: u.agencyId, title: { contains: q } },
              include: { applicant: true },
              take: 8,
            })
          : Promise.resolve([]),
      ])
    : [[], [], []];
  return (
    <>
      <h1 className="page-title mb-4">جست‌وجوی سراسری</h1>
      <form className="card p-4 mb-4 flex gap-2">
        <input
          autoFocus
          className="input text-lg"
          name="q"
          defaultValue={q}
          placeholder="کد فایل، نشانی، نام یا شماره همراه…"
        />
        <button className="btn btn-primary">
          <Search /> جست‌وجو
        </button>
      </form>
      {q && (
        <div className="grid lg:grid-cols-3 gap-4">
          <section className="card p-4">
            <h2 className="font-black flex gap-2 mb-3">
              <Building2 /> فایل‌ها
            </h2>
            {ps.map((p) => (
              <Link
                className="block p-3 border-b hover:text-brick"
                href={`/properties/${p.id}`}
                key={p.id}
              >
                <b>{p.title}</b>
                <small className="block subtle">
                  {p.code} · {p.neighborhood}
                </small>
              </Link>
            ))}
          </section>
          <section className="card p-4">
            <h2 className="font-black flex gap-2 mb-3">
              <Users /> مخاطبان
            </h2>
            {cs.map((c) => (
              <Link
                href={`/contacts/${c.id}`}
                className="block p-3 border-b hover:text-brick"
                key={c.id}
              >
                <b>{c.fullName}</b>
                <small className="block subtle ltr text-right">
                  {c.mobile}
                </small>
              </Link>
            ))}
          </section>
          <section className="card p-4">
            <h2 className="font-black flex gap-2 mb-3">
              <ClipboardList /> درخواست‌ها
            </h2>
            {rs.map((r) => (
              <Link
                href={`/matching?requirement=${r.id}`}
                className="block p-3 border-b"
                key={r.id}
              >
                <b>{r.title}</b>
                <small className="block subtle">{r.applicant.fullName}</small>
              </Link>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
