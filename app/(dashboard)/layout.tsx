import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
import { getAgencyEntitlement } from "@/lib/entitlements";
import { getUserPermissions } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthenticatedUser();
  const [unread, entitlement, permissions] = await Promise.all([
    db.notification.count({ where: { userId: user.id, read: false } }),
    getAgencyEntitlement(user.agencyId),
    getUserPermissions(user),
  ]);
  return (
    <Shell
      user={{ fullName: user.fullName, role: user.role }}
      unread={unread}
      access={entitlement.source}
      permissions={[...permissions]}
    >
      {children}
    </Shell>
  );
}
