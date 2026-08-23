import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PropertyForm } from "@/components/property-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await requireUser(),
    { id } = await params;
  const [p, owners, agents] = await Promise.all([
    db.property.findFirst({ where: { id, agencyId: u.agencyId } }),
    db.contact.findMany({
      where: { agencyId: u.agencyId, type: { in: ["OWNER", "BOTH"] } },
      select: { id: true, fullName: true },
    }),
    db.user.findMany({
      where: { agencyId: u.agencyId, isActive: true },
      select: { id: true, fullName: true },
    }),
  ]);
  if (!p) notFound();
  return (
    <>
      <h1 className="page-title mb-5">ویرایش {p.code}</h1>
      <PropertyForm
        owners={owners}
        agents={agents}
        p={{
          ...p,
          priceTotal: p.priceTotal?.toString(),
          depositAmount: p.depositAmount?.toString(),
          monthlyRent: p.monthlyRent?.toString(),
        }}
      />
    </>
  );
}
