import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { checkPrivateStorage, storageDriver } from "@/lib/uploads";

export type HealthCheck = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
};

async function timed(check: () => Promise<unknown>): Promise<HealthCheck> {
  const startedAt = Date.now();
  try {
    await check();
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    };
  }
}

async function checkBackupFreshness(): Promise<HealthCheck> {
  if (process.env.BACKUP_MONITOR_ENABLED !== "true")
    return { ok: true, message: "disabled" };
  try {
    const marker = path.join(
      process.env.BACKUP_DIR || "/app/backups",
      "last-success.txt",
    );
    const value = (await readFile(marker, "utf8")).trim();
    const completedAt = new Date(value);
    const maxHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 30);
    if (
      Number.isNaN(completedAt.getTime()) ||
      Date.now() - completedAt.getTime() > maxHours * 60 * 60 * 1000
    )
      return { ok: false, message: "backup-stale" };
    return { ok: true, message: completedAt.toISOString() };
  } catch {
    return { ok: false, message: "backup-missing" };
  }
}

export async function readiness() {
  const [database, storage, backup] = await Promise.all([
    timed(() => db.$queryRaw`SELECT 1`),
    timed(() => checkPrivateStorage()),
    checkBackupFreshness(),
  ]);
  return {
    ok: database.ok && storage.ok && backup.ok,
    checks: { database, storage, backup },
    storageDriver: storageDriver(),
    checkedAt: new Date().toISOString(),
  };
}
