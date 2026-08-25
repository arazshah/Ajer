import { requireAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { privateAssetResponse } from "@/lib/file-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuthenticatedUser();
  if (user.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const { id } = await params;
  const billingRequest = await db.billingRequest.findFirst({
    where: { id, agencyId: user.agencyId },
    include: { receiptAsset: true },
  });
  if (!billingRequest?.receiptAsset) return new Response("Not found", { status: 404 });
  return privateAssetResponse(billingRequest.receiptAsset);
}
