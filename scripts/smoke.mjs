import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
const db = new PrismaClient();
const user = await db.user.findUnique({ where: { email: "admin@ajer.ir" } });
if (!user) throw new Error("Demo admin was not seeded");
const key = new TextEncoder().encode(process.env.SESSION_SECRET);
const token = await new SignJWT({ userId: user.id })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(key);
for (const [path, expected] of [
  ["/dashboard", "نبض امروز آژانس"],
  ["/map", "نقشه املاک ارومیه"],
  ["/properties", "فایل‌های ملکی"],
]) {
  const response = await fetch(`http://localhost:3000${path}`, {
    headers: { cookie: `ajer_session=${token}` },
  });
  const body = await response.text();
  if (!response.ok || !body.includes(expected))
    throw new Error(`${path} smoke failed (${response.status})`);
  console.log(`${path}: ${response.status}`);
}
await db.$disconnect();
