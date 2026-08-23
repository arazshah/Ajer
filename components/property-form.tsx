"use client";
import { useActionState, useState } from "react";
import { saveProperty } from "@/app/actions";
import { DynamicLocationMap } from "./dynamic-map";
import { Save, CheckCircle2, MapPin } from "lucide-react";
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
  p = {},
}: {
  owners: Opt[];
  agents: Agent[];
  p?: P;
}) {
  const [state, action, pending] = useActionState(saveProperty, null);
  const [loc, setLoc] = useState<[number, number]>([
    p.latitude ?? 37.5527,
    p.longitude ?? 45.0761,
  ]);
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
              defaultValue={p.neighborhood}
              required
            />
          </div>
          <div>
            <label className="label">نشانی</label>
            <input
              name="address"
              className="input"
              defaultValue={p.address}
              required
            />
          </div>
        </div>
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
