import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  aiPropertyCriteriaSchema,
  aiSearchSystemPrompt,
  scorePropertyForAiSearch,
} from "@/lib/ai-property-search";
import { serializeBigInt } from "@/lib/format";

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

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = requestSchema.safeParse(await request.json());
    if (!input.success)
      return Response.json(
        { error: input.error.issues[0]?.message ?? "درخواست نامعتبر است." },
        { status: 400 },
      );
    const apiKey = process.env.AVALAI_API_KEY;
    if (!apiKey)
      return Response.json(
        {
          error:
            "کلید AvalAI روی سرور تنظیم نشده است. مدیر سامانه باید AVALAI_API_KEY را تعریف کند.",
        },
        { status: 503 },
      );
    const baseUrl = (
      process.env.AVALAI_BASE_URL || "https://api.avalai.ir/v1"
    ).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AVALAI_MODEL || "gpt-5.4-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: aiSearchSystemPrompt },
          { role: "user", content: input.data.query },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        "AvalAI request failed",
        response.status,
        await response.text(),
      );
      return Response.json(
        {
          error:
            "ارتباط با سرویس هوش مصنوعی برقرار نشد. تنظیمات AvalAI را بررسی کنید.",
        },
        { status: 502 },
      );
    }
    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = completion.choices?.[0]?.message?.content;
    if (!content)
      return Response.json(
        { error: "پاسخ قابل استفاده‌ای از هوش مصنوعی دریافت نشد." },
        { status: 502 },
      );
    const criteria = aiPropertyCriteriaSchema.parse(
      JSON.parse(cleanJson(content)),
    );
    const properties = await db.property.findMany({
      where: {
        agencyId: user.agencyId,
        status: { in: ["ACTIVE", "RESERVED"] },
      },
      include: {
        images: { where: { isCover: true }, take: 1 },
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
        imageUrl: property.images[0]?.url ?? "/property-1.png",
        assignedAgent: property.assignedAgent.fullName,
        score: match.score,
        reasons: match.reasons,
      }));
    return Response.json(serializeBigInt({ criteria, results }));
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: "هوش مصنوعی پاسخ نامعتبر داد؛ لطفاً عبارت را ساده‌تر بنویسید.",
        },
        { status: 502 },
      );
    if (error instanceof Error && error.name === "TimeoutError")
      return Response.json(
        { error: "زمان پاسخ AvalAI بیش از حد طولانی شد؛ دوباره تلاش کنید." },
        { status: 504 },
      );
    console.error("AI property search error", error);
    return Response.json(
      { error: "جست‌وجوی هوشمند انجام نشد. دوباره تلاش کنید." },
      { status: 500 },
    );
  }
}
