import { readiness } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await readiness();
  const configuredSecret = process.env.HEALTHCHECK_SECRET;
  const authorized = Boolean(
    configuredSecret &&
      request.headers.get("authorization") === `Bearer ${configuredSecret}`,
  );
  return Response.json(
    authorized
      ? result
      : { status: result.ok ? "ready" : "not-ready", checkedAt: result.checkedAt },
    {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
