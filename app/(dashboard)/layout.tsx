import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unread = await db.notification.count({
    where: { userId: user.id, read: false },
  });
  return (
    <Shell user={{ fullName: user.fullName, role: user.role }} unread={unread}>
      {children}
    </Shell>
  );
}
