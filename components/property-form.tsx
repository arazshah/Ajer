"use client";
import { useActionState, useState } from "react";
import { saveProperty } from "@/app/actions";
import { DynamicLocationMap } from "./dynamic-map";
import { Save, CheckCircle2, MapPin, Search, LoaderCircle, Images } from "lucide-react";
import Link from "next/link";
type Opt = { id: string; fullName: string };
type Agent = { id: string; fullName: string };
type P = {
  id?: string;
  title?: string;
  transactionType?: string;
  propertyType?: string;
  ownerId?: string;
  assignedAgentId?: string;
  neighborhood?: string;
  address?: string;
  area?: number;
  bedrooms?: number | null;
  latitude?: number;
  longitude?: number;
  description?: string;
  priceTotal?: string | null;
  depositAmount?: string | null;
  monthlyRent?: string | null;
  parking?: boolean;
  elevator?: boolean;
  storage?: boolean;
  balcony?: boolean;
};
export function PropertyForm({
  owners,
  agents,
  city,
  p = {},
}: {
  owners: Opt[];
  agents: Agent[];
  city: string;
  p?: P;
}) {
  const [state, action, pending] = useActionState(saveProperty, null);
  const [loc, setLoc] = useState<[number, number]>([
    p.latitude ?? 37.5527,
    p.longitude ?? 45.0761,
  ]);
  const [neighborhood, setNeighborhood] = useState(p.neighborhood ?? "");
  const [address, setAddress] = useState(p.address ?? "");
  const [mapMessage, setMapMessage] = useState("");
  const [mapResults, setMapResults] = useState<
    Array<{ label: string; latitude: number; longitude: number }>
  >([]);
  const [locating, setLocating] = useState(false);

  async function findArea() {
    const query = [address, neighborhood, city, "ایران"].filter(Boolean).join("، ");
    if (query.length < 3) {
      setMapMessage("ابتدا محله یا نشانی را وارد کنید.");
      return;
    }
    setLocating(true);
    setMapMessage("");
    setMapResults([]);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const body = (await response.json()) as {
        results?: Array<{ label: string; latitude: number; longitude: number }>;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "جست‌وجوی محدوده انجام نشد.");
      const results = body.results ?? [];
      setMapResults(results);
      if (results[0]) {
        setLoc([results[0].latitude, results[0].longitude]);
        setMapMessage("محدوده پیدا شد؛ نقطه دقیق را روی نقشه کلیک کنید.");
      } else setMapMessage("محدوده‌ای پیدا نشد؛ نشانی را دقیق‌تر وارد کنید.");
    } catch (error) {
      setMapMessage(error instanceof Error ? error.message : "خطا در جست‌وجوی محدوده.");
    } finally {
      setLocating(false);
    }
  }
  return (
    <form action={action} className="space-y-5">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="card p-5">
        <h2 className="font-black text-lg mb-5">۱. اطلاعات پایه</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">عنوان فایل</label>
            <input
              name="title"
              className="input"
              defaultValue={p.title}
              placeholder="مثلاً آپارتمان نورگیر در استادان"
              required
            />
          </div>
          <div>
            <label className="label">نوع معامله</label>
            <select
              name="transactionType"
              className="select"
              defaultValue={p.transactionType ?? "SALE"}
            >
              <option value="SALE">فروش</option>
              <option value="MORTGAGE_RENT">رهن و اجاره</option>
              <option value="RENT">اجاره</option>
              <option value="PRESALE">پیش‌فروش</option>
            </select>
          </div>
          <div>
            <label className="label">نوع ملک</label>
            <select
              name="propertyType"
              className="select"
              defaultValue={p.propertyType ?? "APARTMENT"}
            >
              {[
                ["APARTMENT", "آپارتمان"],
                ["HOUSE", "خانه"],
                ["VILLA", "ویلا"],
                ["LAND", "زمین"],
                ["COMMERCIAL", "تجاری"],
                ["OFFICE", "اداری"],
                ["STORE", "مغازه"],
                ["WAREHOUSE", "انبار"],
              ].map((x) => (
                <option value={x[0]} key={x[0]}>
                  {x[1]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">مالک</label>
            <select
              name="ownerId"
              className="select"
              defaultValue={p.ownerId}
              required
            >
              <option value="">انتخاب مالک</option>
              {owners.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">مسئول فایل</label>
            <select
              name="assignedAgentId"
              className="select"
              defaultValue={p.assignedAgentId ?? agents[0]?.id}
            >
              {agents.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-black text-lg mb-5 flex gap-2">
          <MapPin className="text-brick" />
          ۲. موقعیت روی نقشه
        </h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">محله</label>
            <input
              name="neighborhood"
              className="input"
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">نشانی</label>
            <input
              name="address"
              className="input"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            className="btn"
            onClick={findArea}
            disabled={locating}
          >
            {locating ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />}
            یافتن محدوده روی نقشه
          </button>
          {mapMessage && <small className="subtle">{mapMessage}</small>}
        </div>
        {mapResults.length > 1 && (
          <div className="grid md:grid-cols-2 gap-2 mb-3">
            {mapResults.map((result) => (
              <button
                type="button"
                className="text-right rounded-xl border bg-white p-2 text-sm hover:border-brick"
                key={`${result.latitude}-${result.longitude}`}
                onClick={() => {
                  setLoc([result.latitude, result.longitude]);
                  setMapMessage("محدوده انتخاب شد؛ نقطه دقیق را روی نقشه کلیک کنید.");
                }}
              >
                {result.label}
              </button>
            ))}
          </div>
        )}
        <DynamicLocationMap value={loc} onChange={setLoc} />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="label">عرض جغرافیایی</label>
            <input
              name="latitude"
              className="input ltr"
              value={loc[0]}
              onChange={(e) => setLoc([Number(e.target.value), loc[1]])}
            />
          </div>
          <div>
            <label className="label">طول جغرافیایی</label>
            <input
              name="longitude"
              className="input ltr"
              value={loc[1]}
              onChange={(e) => setLoc([loc[0], Number(e.target.value)])}
            />
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-black text-lg mb-5">۳. مشخصات و امکانات</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">متراژ</label>
            <input
              type="number"
              name="area"
              className="input"
              defaultValue={p.area}
              required
            />
          </div>
          <div>
            <label className="label">تعداد خواب</label>
            <input
              type="number"
              name="bedrooms"
              className="input"
              defaultValue={p.bedrooms ?? ""}
            />
          </div>
          <div className="md:col-span-3 flex flex-wrap gap-5">
            {[
              ["parking", "پارکینگ", p.parking],
              ["elevator", "آسانسور", p.elevator],
              ["storage", "انباری", p.storage],
              ["balcony", "بالکن", p.balcony],
            ].map(([n, l, c]) => (
              <label className="flex gap-2 items-center" key={String(n)}>
                <input
                  type="checkbox"
                  name={String(n)}
                  defaultChecked={Boolean(c)}
                />
                {String(l)}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-black text-lg mb-5">۴. قیمت و توضیحات</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label">قیمت کل (تومان)</label>
            <input
              name="priceTotal"
              className="input ltr text-right"
              defaultValue={p.priceTotal ?? ""}
            />
          </div>
          <div>
            <label className="label">ودیعه (تومان)</label>
            <input
              name="depositAmount"
              className="input ltr text-right"
              defaultValue={p.depositAmount ?? ""}
            />
          </div>
          <div>
            <label className="label">اجاره ماهانه</label>
            <input
              name="monthlyRent"
              className="input ltr text-right"
              defaultValue={p.monthlyRent ?? ""}
            />
          </div>
          <div className="md:col-span-3">
            <label className="label">توضیحات</label>
            <textarea
              name="description"
              className="textarea"
              rows={5}
              defaultValue={p.description}
              required
            />
          </div>
        </div>
      </div>
      <div className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-lg flex items-center gap-2">
            <Images className="text-brick" /> ۵. تصاویر، پلان و ویدئو
          </h2>
          <p className="subtle mt-2">
            {p.id
              ? "رسانه‌ها را در صفحه پرونده ملک ببینید، حذف کنید یا تصویر اصلی را تغییر دهید."
              : "پس از ذخیره فایل به صفحه پرونده هدایت می‌شوید و می‌توانید رسانه‌ها را بارگذاری و مدیریت کنید."}
          </p>
        </div>
        {p.id && (
          <Link className="btn" href={`/properties/${p.id}#property-media`}>
            مدیریت رسانه‌ها
          </Link>
        )}
      </div>
      {state?.error && (
        <div className="toast-note text-red-600">{state.error}</div>
      )}
      <div className="sticky bottom-3 card p-3 flex justify-end gap-2 z-10">
        <button name="intent" value="draft" disabled={pending} className="btn">
          <Save size={18} /> ذخیره پیش‌نویس
        </button>
        <button
          name="intent"
          value="active"
          disabled={pending}
          className="btn btn-primary"
        >
          <CheckCircle2 size={18} /> ذخیره و فعال‌سازی
        </button>
      </div>
    </form>
  );
}
