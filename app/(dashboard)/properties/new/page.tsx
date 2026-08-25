import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PropertyForm } from "@/components/property-form";
export const metadata = { title: "افزودن فایل" };
export default async function NewProperty() {
  const u = await requirePermission("properties.create");
  const [owners, agents] = await Promise.all([
    db.contact.findMany({
      where: { agencyId: u.agencyId, type: { in: ["OWNER", "BOTH"] } },
      select: { id: true, fullName: true },
    }),
    db.user.findMany({
      where: { agencyId: u.agencyId, isActive: true },
      select: { id: true, fullName: true },
    }),
  ]);
  return (
    <>
      <h1 className="page-title mb-1">افزودن فایل جدید</h1>
      <p className="subtle mb-5">
        مشخصات فایل را کامل کنید و محل آن را روی نقشه نشان دهید.
      </p>
      <PropertyForm owners={owners} agents={agents} />
    </>
  );
}
