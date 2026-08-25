import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSuperAdmin } from "@/lib/auth";
import { SuperAdminLoginForm } from "@/components/super-admin-login-form";

export const metadata = { title: "مدیریت کل" };
export default async function SuperAdminLoginPage() {
  if (await getSuperAdmin()) redirect("/super-admin");
  return (
    <main className="min-h-screen bg-ink grid place-items-center p-5">
      <div className="card p-7 w-full max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white grid place-items-center mb-5">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-black">مدیریت کل آجر</h1>
        <p className="subtle mt-2 mb-6">
          این بخش ثبت‌نام عمومی ندارد و فقط برای مالک پلتفرم است.
        </p>
        <SuperAdminLoginForm />
      </div>
    </main>
  );
}
