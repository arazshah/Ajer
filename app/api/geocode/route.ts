import { getSessionUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/security";

export const runtime = "nodejs";

type CachedResult = {
  expiresAt: number;
  results: Array<{ label: string; latitude: number; longitude: number }>;
};

const cache = new Map<string, CachedResult>();
let upstreamQueue: Promise<void> = Promise.resolve();
let lastUpstreamRequestAt = 0;

async function queuedFetch(url: URL, init: RequestInit) {
  let response!: Response;
  const task = upstreamQueue.then(async () => {
    const delay = Math.max(0, 1_000 - (Date.now() - lastUpstreamRequestAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastUpstreamRequestAt = Date.now();
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
  });
  upstreamQueue = task.catch(() => undefined);
  await task;
  return response;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return Response.json({ error: "برای ادامه وارد حساب شوید." }, { status: 401 });
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 300);
  if (query.length < 3)
    return Response.json({ error: "نشانی برای جست‌وجو کافی نیست." }, { status: 400 });

  const key = query.toLocaleLowerCase("fa");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now())
    return Response.json({ results: cached.results }, { headers: { "Cache-Control": "private, max-age=3600" } });

  const rate = await consumeRateLimit({
    scope: "property-geocode",
    key: user.id,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed)
    return Response.json(
      { error: "تعداد جست‌وجو زیاد است؛ کمی بعد دوباره تلاش کنید." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );

  const endpoint = process.env.GEOCODING_URL || "https://nominatim.openstreetmap.org/search";
  const upstream = new URL(endpoint);
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("format", "jsonv2");
  upstream.searchParams.set("countrycodes", "ir");
  upstream.searchParams.set("accept-language", "fa");
  upstream.searchParams.set("addressdetails", "1");
  upstream.searchParams.set("limit", "5");
  try {
    const response = await queuedFetch(upstream, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Ajer/1.0 (+https://araz.me)",
        Referer: process.env.APP_URL || "https://araz.me",
      },
    });
    if (!response.ok) throw new Error(`geocoding:${response.status}`);
    const payload = (await response.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;
    const results = payload
      .map((item) => ({
        label: String(item.display_name || "محدوده پیشنهادی").slice(0, 300),
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }))
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    cache.set(key, { results, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return Response.json(
      { error: "سرویس نقشه در دسترس نیست؛ می‌توانید نقطه را دستی انتخاب کنید." },
      { status: 503 },
    );
  }
}
