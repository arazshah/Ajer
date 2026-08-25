import { randomUUID } from "node:crypto";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly details: {
      provider: string;
      statusCode?: number;
      attempts: number;
      latencyMs: number;
      requestId: string;
    },
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

export type ProviderHttpResult<T> = {
  data: T;
  statusCode: number;
  attempts: number;
  latencyMs: number;
  requestId: string;
};

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function abortError(error: unknown) {
  return (
    error instanceof Error &&
    ["AbortError", "TimeoutError"].includes(error.name)
  );
}

export async function fetchJsonWithPolicy<T>(options: {
  provider: string;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  maxAttempts?: number;
  maxResponseBytes?: number;
  fetcher?: Fetcher;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<ProviderHttpResult<T>> {
  const fetcher = options.fetcher || fetch;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts || 1, 3));
  const maxResponseBytes = options.maxResponseBytes || 1_000_000;
  const wait =
    options.wait ||
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const requestId = randomUUID();
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const headers = new Headers(options.init.headers);
      headers.set("X-Ajer-Request-Id", requestId);
      const response = await fetcher(options.url, {
        ...options.init,
        headers,
        signal: AbortSignal.timeout(options.timeoutMs),
        cache: "no-store",
      });
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > maxResponseBytes)
        throw new ProviderHttpError(
          "Provider response is too large.",
          "response-too-large",
          false,
          {
            provider: options.provider,
            statusCode: response.status,
            attempts: attempt,
            latencyMs: Date.now() - startedAt,
            requestId,
          },
        );
      if (!response.ok) {
        const retryable = retryableStatus(response.status);
        if (retryable && attempt < maxAttempts) {
          await wait(Math.min(1_000, 250 * 2 ** (attempt - 1)));
          continue;
        }
        throw new ProviderHttpError(
          "Provider rejected the request.",
          `http-${response.status}`,
          retryable,
          {
            provider: options.provider,
            statusCode: response.status,
            attempts: attempt,
            latencyMs: Date.now() - startedAt,
            requestId,
          },
        );
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxResponseBytes)
        throw new ProviderHttpError(
          "Provider response is too large.",
          "response-too-large",
          false,
          {
            provider: options.provider,
            statusCode: response.status,
            attempts: attempt,
            latencyMs: Date.now() - startedAt,
            requestId,
          },
        );
      try {
        return {
          data: JSON.parse(text) as T,
          statusCode: response.status,
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
          requestId,
        };
      } catch {
        throw new ProviderHttpError(
          "Provider returned invalid JSON.",
          "invalid-json",
          false,
          {
            provider: options.provider,
            statusCode: response.status,
            attempts: attempt,
            latencyMs: Date.now() - startedAt,
            requestId,
          },
        );
      }
    } catch (error) {
      if (error instanceof ProviderHttpError) throw error;
      const timedOut = abortError(error);
      if (attempt < maxAttempts) {
        await wait(Math.min(1_000, 250 * 2 ** (attempt - 1)));
        continue;
      }
      throw new ProviderHttpError(
        timedOut ? "Provider request timed out." : "Provider is unavailable.",
        timedOut ? "timeout" : "network-error",
        true,
        {
          provider: options.provider,
          attempts: attempt,
          latencyMs: Date.now() - startedAt,
          requestId,
        },
      );
    }
  }
  throw new Error("Unreachable provider retry state.");
}
