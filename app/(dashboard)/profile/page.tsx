import Image from "next/image";
import { Camera, KeyRound, UserRound } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/auth";
import { changeOwnPassword, updateOwnProfile } from "@/app/profile-actions";

export const metadata = { title: "پروفایل من" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; avatar?: string; error?: string; uploadError?: string }>;
}) {
  const [user, query] = await Promise.all([requireAuthenticatedUser(), searchParams]);
  const message = query.saved
    ? "اطلاعات پروفایل ذخیره شد."
    : query.avatar
      ? "تصویر پروفایل به‌روزرسانی شد."
      : null;
  const error = query.uploadError ||
    (query.error === "email"
      ? "این ایمیل قبلاً استفاده شده است."
      : query.error === "current-password"
        ? "رمز فعلی درست نیست."
        : query.error === "new-password"
          ? "رمز جدید باید حداقل ۱۰ نویسه و شامل حرف انگلیسی، عدد و نویسه ویژه باشد و با تکرار آن یکسان باشد."
          : query.error
            ? "اطلاعات واردشده معتبر نیست."
            : null);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">پروفایل من</h1>
          <p className="subtle">اطلاعات حساب، تصویر و امنیت ورود</p>
        </div>
      </div>
      {message && <div className="toast-note mb-4 text-green-700">{message}</div>}
      {error && <div className="toast-note mb-4 text-red-700">{error}</div>}
      <div className="grid lg:grid-cols-[.7fr_1.3fr] gap-4">
        <section className="card p-5">
          <h2 className="font-black text-lg flex gap-2 mb-5"><Camera className="text-brick" /> تصویر پروفایل</h2>
          <div className="grid place-items-center gap-4">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.fullName} width={160} height={160} unoptimized className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-xl" />
            ) : (
              <div className="w-40 h-40 rounded-full bg-ink text-white grid place-items-center text-6xl font-black shadow-xl">{user.fullName[0]}</div>
            )}
            <form action="/api/profile/avatar" method="post" encType="multipart/form-data" className="w-full grid gap-3">
              <input className="input" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required />
              <small className="subtle">JPG، PNG یا WebP تا ۵ مگابایت</small>
              <button className="btn btn-primary"><Camera size={17} /> بارگذاری تصویر</button>
            </form>
          </div>
        </section>
        <div className="space-y-4">
          <form action={updateOwnProfile} className="card p-5 grid md:grid-cols-2 gap-4">
            <h2 className="font-black text-lg flex gap-2 md:col-span-2"><UserRound className="text-brick" /> اطلاعات شخصی</h2>
            <label><span className="label">نام و نام خانوادگی</span><input className="input" name="fullName" defaultValue={user.fullName} required /></label>
            <label><span className="label">شماره موبایل</span><input className="input ltr text-right" name="mobile" defaultValue={user.mobile} inputMode="tel" required /></label>
            <label className="md:col-span-2"><span className="label">ایمیل ورود</span><input className="input ltr text-right" name="email" type="email" defaultValue={user.email} required /></label>
            <button className="btn btn-primary md:col-span-2">ذخیره تغییرات</button>
          </form>
          <form action={changeOwnPassword} className="card p-5 grid md:grid-cols-2 gap-4">
            <h2 className="font-black text-lg flex gap-2 md:col-span-2"><KeyRound className="text-brick" /> تغییر رمز عبور</h2>
            <label className="md:col-span-2"><span className="label">رمز فعلی</span><input className="input ltr text-right" name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label><span className="label">رمز جدید</span><input className="input ltr text-right" name="newPassword" type="password" autoComplete="new-password" required /></label>
            <label><span className="label">تکرار رمز جدید</span><input className="input ltr text-right" name="confirmation" type="password" autoComplete="new-password" required /></label>
            <small className="subtle md:col-span-2">حداقل ۱۰ نویسه، شامل حرف انگلیسی، عدد و نویسه ویژه</small>
            <button className="btn btn-dark md:col-span-2">تغییر رمز و خروج از همه دستگاه‌ها</button>
          </form>
        </div>
      </div>
    </>
  );
}
