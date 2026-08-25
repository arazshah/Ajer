import { z } from "zod";
import { db } from "@/lib/db";
import {
  aiPropertyCriteriaSchema,
  aiSearchSystemPrompt,
  scorePropertyForAiSearch,
} from "@/lib/ai-property-search";
import { getSessionUser } from "@/lib/auth";
import { getAgencyEntitlement } from "@/lib/entitlements";
import { serializeBigInt } from "@/lib/format";
import {
  recordIntegrationFailure,
  recordIntegrationSuccess,
} from "@/lib/integrations";
import { hasPermission } from "@/lib/permissions";
import { getPlatformSettings } from "@/lib/platform-settings";
import { fetchJsonWithPolicy, ProviderHttpError } from "@/lib/provider-http";
import { consumeRateLimit } from "@/lib/security";
import { propertyCoverUrl } from "@/lib/property-media";

const requestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, "شرایط جست‌وجو را کامل‌تر بنویسید.")
    .max(1000, "متن جست‌وجو بیش از حد طولانی است."),
});

function cleanJson(content: string) {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function jsonError(
  error: string,
  status: number,
  extraHeaders?: Record<string, string>,
) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", ...extraHeaders } },
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonError("برای ادامه وارد حساب خود شوید.", 401);
  if (!(await hasPermission(user, "ai.use")))
    return jsonError("اجازه استفاده از جست‌وجوی هوشمند را ندارید.", 403);
  const entitlement = await getAgencyEntitlement(user.agencyId);
  if (!entitlement.active)
    return jsonError("اشتراک دفتر فعال نیست.", 402);
  if (!entitlement.aiEnabled)
    return jsonError("افزونه هوش مصنوعی برای اشتراک این دفتر فعال نیست.", 402);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return jsonError("نوع محتوای درخواست باید JSON باشد.", 415);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("بدنه JSON معتبر نیست.", 400);
  }
  const input = requestSchema.safeParse(body);
  if (!input.success)
    return jsonError(
      input.error.issues[0]?.message ?? "درخواست نامعتبر است.",
      400,
    );

  const rateLimit = await consumeRateLimit({
    scope: "api:ai-search",
    key: `${user.agencyId}:${user.id}`,
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed)
    return jsonError(
      "تعداد جست‌وجوهای هوشمند بیش از حد مجاز است؛ کمی بعد تلاش کنید.",
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );

  const context = { agencyId: user.agencyId, userId: user.id };
  let providerCompleted = false;
  try {
    const { ai } = await getPlatformSettings();
    if (!ai.enabled)
      return jsonError(
        "جست‌وجوی هوشمند موقتاً توسط مدیر سامانه غیرفعال شده است.",
        503,
      );
    if (!ai.apiKey)
      return jsonError(
        "سرویس هوش مصنوعی روی سرور تنظیم نشده است. با مدیر سامانه تماس بگیرید.",
        503,
      );
    const result = await fetchJsonWithPolicy<{
      choices?: Array<{ message?: { content?: string } }>;
    }>({
      provider: "AI",
      url: `${ai.baseUrl.replace(/\/$/, "")}/chat/completions`,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ai.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ai.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: aiSearchSystemPrompt },
            { role: "user", content: input.data.query },
          ],
        }),
      },
      timeoutMs: 25_000,
      maxAttempts: 2,
    });
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) {
      const error = new ProviderHttpError(
        "AI response did not contain content.",
        "empty-content",
        false,
        {
          provider: "AI",
          statusCode: result.statusCode,
          attempts: result.attempts,
          latencyMs: result.latencyMs,
          requestId: result.requestId,
        },
      );
      await recordIntegrationFailure("AI", "property-search", error, context);
      return jsonError("پاسخ قابل استفاده‌ای از هوش مصنوعی دریافت نشد.", 502);
    }
    let criteria: z.infer<typeof aiPropertyCriteriaSchema>;
    try {
      criteria = aiPropertyCriteriaSchema.parse(JSON.parse(cleanJson(content)));
    } catch {
      const error = new ProviderHttpError(
        "AI returned invalid criteria.",
        "invalid-payload",
        false,
        {
          provider: "AI",
          statusCode: result.statusCode,
          attempts: result.attempts,
          latencyMs: result.latencyMs,
          requestId: result.requestId,
        },
      );
      await recordIntegrationFailure("AI", "property-search", error, context);
      return jsonError(
        "هوش مصنوعی پاسخ نامعتبر داد؛ لطفاً عبارت را ساده‌تر بنویسید.",
        502,
      );
    }
    await recordIntegrationSuccess("AI", "property-search", result, context);
    providerCompleted = true;
    const properties = await db.property.findMany({
      where: {
        agencyId: user.agencyId,
        status: { in: ["ACTIVE", "RESERVED"] },
      },
      include: {
        images: { where: { isCover: true }, take: 1 },
        media: {
          where: { isCover: true, asset: { mimeType: { startsWith: "image/" } } },
          include: { asset: { select: { mimeType: true } } },
          take: 1,
        },
        assignedAgent: { select: { fullName: true } },
      },
      take: 100,
    });
    const results = properties
      .map((property) => ({
        property,
        match: scorePropertyForAiSearch(property, criteria),
      }))
      .filter(
        (
          item,
        ): item is typeof item & { match: NonNullable<typeof item.match> } =>
          item.match !== null,
      )
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 12)
      .map(({ property, match }) => ({
        id: property.id,
        code: property.code,
        title: property.title,
        neighborhood: property.neighborhood,
        area: property.area,
        bedrooms: property.bedrooms,
        transactionType: property.transactionType,
        propertyType: property.propertyType,
        priceTotal: property.priceTotal,
        depositAmount: property.depositAmount,
        monthlyRent: property.monthlyRent,
        imageUrl: propertyCoverUrl(property),
        assignedAgent: property.assignedAgent.fullName,
        score: match.score,
        reasons: match.reasons,
      }));
    return Response.json(serializeBigInt({ criteria, results }), {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    if (!providerCompleted)
      await recordIntegrationFailure("AI", "property-search", error, context);
    console.error(
      "AI property search failed",
      error instanceof ProviderHttpError ? error.code : "unexpected-error",
    );
    if (error instanceof ProviderHttpError && error.code === "timeout")
      return jsonError(
        "زمان پاسخ هوش مصنوعی بیش از حد طولانی شد؛ دوباره تلاش کنید.",
        504,
      );
    return jsonError(
      error instanceof ProviderHttpError
        ? "ارتباط با سرویس هوش مصنوعی برقرار نشد؛ دوباره تلاش کنید."
        : "جست‌وجوی هوشمند انجام نشد. دوباره تلاش کنید.",
      error instanceof ProviderHttpError ? 502 : 500,
    );
  }
}
