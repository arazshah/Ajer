import { requirePermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { csvSafe, formatDate } from "@/lib/format";
import { label } from "@/lib/labels";
export async function GET() {
  const user = await requirePermission("data.export");
  const properties = await db.property.findMany({
    where: { agencyId: user.agencyId },
    include: { owner: true, assignedAgent: true },
    orderBy: { createdAt: "desc" },
  });
  const rows = [
    [
      "کد",
      "عنوان",
      "نوع معامله",
      "نوع ملک",
      "محله",
      "متراژ",
      "مالک",
      "مسئول",
      "وضعیت",
      "تاریخ ثبت",
    ],
    ...properties.map((p) => [
      p.code,
      p.title,
      label(p.transactionType),
      label(p.propertyType),
      p.neighborhood,
      p.area,
      p.owner.fullName,
      p.assignedAgent.fullName,
      label(p.status),
      formatDate(p.createdAt),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvSafe).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=ajer-properties.csv",
    },
  });
}
