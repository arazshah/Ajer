import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { privateAssetResponse } from "@/lib/file-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSuperAdmin();
  const { id } = await params;
  const billingRequest = await db.billingRequest.findUnique({
    where: { id },
    include: { receiptAsset: true },
  });
  if (!billingRequest?.receiptAsset) {
    return new Response("Not found", { status: 404 });
  }
  return privateAssetResponse(billingRequest.receiptAsset);
}
