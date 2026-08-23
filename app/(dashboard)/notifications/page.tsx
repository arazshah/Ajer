import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
export const metadata = { title: "اعلان‌ها" };
export default async function Notifications() {
  const u = await requireUser();
  const ns = await db.notification.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <h1 className="page-title mb-5">اعلان‌ها</h1>
      <div className="card overflow-hidden">
        {ns.map((n) => (
          <Link
            href={n.link ?? "/dashboard"}
            className={`flex gap-4 p-4 border-b ${n.read ? "opacity-60" : "bg-orange-50/40"}`}
            key={n.id}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-brick grid place-items-center">
              {n.read ? <CheckCircle2 /> : <Bell />}
            </div>
            <div>
              <b>{n.title}</b>
              <p className="subtle">{n.message}</p>
              <small>{formatDateTime(n.createdAt)}</small>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
