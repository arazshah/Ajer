import { describe, expect, it, vi } from "vitest";
import { smsRetryDelayMinutes } from "@/lib/operations";
import { fetchJsonWithPolicy, ProviderHttpError } from "@/lib/provider-http";

describe("external integration policy", () => {
  it("retries a transient provider failure and parses JSON", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "busy" }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const result = await fetchJsonWithPolicy<{ ok: boolean }>({
      provider: "TEST",
      url: "https://provider.example.test/resource",
      init: { method: "POST" },
      timeoutMs: 1000,
      maxAttempts: 2,
      fetcher,
      wait: async () => undefined,
    });
    expect(result.data.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent 400 response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid" }), { status: 400 }),
    );
    await expect(
      fetchJsonWithPolicy({
        provider: "TEST",
        url: "https://provider.example.test/resource",
        init: { method: "POST" },
        timeoutMs: 1000,
        maxAttempts: 3,
        fetcher,
        wait: async () => undefined,
      }),
    ).rejects.toMatchObject({
      code: "http-400",
      retryable: false,
    } satisfies Partial<ProviderHttpError>);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses bounded durable SMS retry intervals", () => {
    expect([1, 2, 3].map(smsRetryDelayMinutes)).toEqual([5, 20, 60]);
    expect(smsRetryDelayMinutes(10)).toBe(60);
  });
});
