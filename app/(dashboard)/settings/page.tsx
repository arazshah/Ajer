import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveSetting } from "@/app/actions";
import { Save, MapPin, Building2 } from "lucide-react";
export const metadata = { title: "تنظیمات" };
export default async function Settings() {
  const u = await requireAdmin();
  const settings = Object.fromEntries(
    (await db.appSetting.findMany({ where: { agencyId: u.agencyId } })).map(
      (x) => [x.key, x.value],
    ),
  );
  return (
    <>
      <div>
        <h1 className="page-title">تنظیمات آژانس</h1>
        <p className="subtle mb-5">مشخصات عمومی و تنظیمات پیش‌فرض نقشه</p>
      </div>
      <form action={saveSetting} className="space-y-4">
        <div className="card p-5">
          <h2 className="font-black text-lg mb-5 flex gap-2">
            <Building2 className="text-brick" /> مشخصات آژانس
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">نام آژانس</label>
              <input
                className="input"
                name="agencyName"
                defaultValue={u.agency.name}
              />
            </div>
            <div>
              <label className="label">تلفن</label>
              <input
                className="input"
                name="phone"
                defaultValue={u.agency.phone}
              />
            </div>
            <div>
              <label className="label">شهر</label>
              <input
                className="input"
                name="city"
                defaultValue={u.agency.city}
              />
            </div>
            <div>
              <label className="label">نشانی</label>
              <input
                className="input"
                name="address"
                defaultValue={u.agency.address}
              />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-black text-lg mb-5 flex gap-2">
            <MapPin className="text-brick" /> نقشه و نمایش
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">عرض مرکز</label>
              <input
                className="input ltr"
                name="defaultLatitude"
                defaultValue={settings.defaultLatitude}
              />
            </div>
            <div>
              <label className="label">طول مرکز</label>
              <input
                className="input ltr"
                name="defaultLongitude"
                defaultValue={settings.defaultLongitude}
              />
            </div>
            <div>
              <label className="label">بزرگ‌نمایی</label>
              <input
                className="input"
                name="defaultZoom"
                defaultValue={settings.defaultZoom}
              />
            </div>
            <div>
              <label className="label">واحد پول</label>
              <input
                className="input"
                name="currency"
                defaultValue={settings.currency}
              />
            </div>
            <div>
              <label className="label">پیشوند کد فایل</label>
              <input
                className="input ltr text-right"
                name="propertyCodePrefix"
                defaultValue={settings.propertyCodePrefix}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary">
            <Save size={18} /> ذخیره تنظیمات
          </button>
        </div>
      </form>
    </>
  );
}
