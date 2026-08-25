import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { ShieldCheck, UserRound, Plus, SlidersHorizontal } from "lucide-react";
import {
  createUser,
  saveUserPermissions,
  unlockUserAccess,
  updateEmployeeProfile,
} from "@/app/actions";
import { label } from "@/lib/labels";
import { JalaliDateInput } from "@/components/jalali-date-input";
import {
  defaultPermissions,
  permissionCatalog,
  requirePermission,
} from "@/lib/permissions";
export const metadata = { title: "کاربران" };
const personnelLabels: Record<string, string> = {
  OWNER: "مالک / مدیر دفتر",
  MANAGER: "مدیر داخلی",
  AGENT: "مشاور معامله",
  MARKETER: "بازاریاب / فایل‌یاب",
  CONTRACT_EXPERT: "کارشناس قرارداد",
  RECEPTIONIST: "پذیرش",
  ACCOUNTANT: "حسابدار",
  PHOTOGRAPHER: "عکاس",
  OTHER: "سایر",
};
export default async function Users() {
  const u = await requirePermission("users.manage");
  const users = await db.user.findMany({
    where: { agencyId: u.agencyId },
    include: { employeeProfile: true, permissionOverrides: true },
    orderBy: { createdAt: "asc" },
  });
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">کاربران</h1>
          <p className="subtle">مشاور و بازاریاب نامحدود با حساب مستقل</p>
        </div>
        <details>
          <summary className="btn btn-primary list-none cursor-pointer">
            <Plus size={18} /> افزودن کاربر
          </summary>
          <form
            action={createUser}
            className="card p-4 absolute left-6 mt-2 w-[360px] max-w-[90vw] z-30 grid gap-3"
          >
            <input
              className="input"
              name="fullName"
              placeholder="نام کامل"
              required
            />
            <input
              className="input ltr text-right"
              type="email"
              name="email"
              placeholder="ایمیل"
              required
            />
            <input
              className="input ltr text-right"
              name="mobile"
              placeholder="شماره همراه"
              required
            />
            <select className="select" name="role">
              <option value="AGENT">مشاور / بازاریاب</option>
              <option value="MANAGER">مدیر داخلی</option>
              <option value="ADMIN">مدیر سامانه</option>
            </select>
            <select className="select" name="personnelType">
              <option value="AGENT">مشاور معامله</option>
              <option value="MARKETER">بازاریاب / فایل‌یاب</option>
              <option value="MANAGER">مدیر داخلی</option>
              <option value="CONTRACT_EXPERT">کارشناس قرارداد</option>
              <option value="RECEPTIONIST">پذیرش</option>
              <option value="ACCOUNTANT">حسابدار</option>
              <option value="PHOTOGRAPHER">عکاس</option>
              <option value="OTHER">سایر</option>
            </select>
            <input className="input" name="jobTitle" placeholder="عنوان شغلی" />
            <input
              className="input ltr text-right"
              type="number"
              min="0"
              max="100"
              step="0.01"
              name="defaultCommissionPercent"
              defaultValue="50"
              placeholder="سهم پیش‌فرض از کمیسیون (درصد)"
            />
            <input
              className="input ltr text-right"
              type="password"
              name="password"
              placeholder="حداقل ۱۰ نویسه؛ حرف، عدد و نماد"
              minLength={10}
              required
            />
            <button className="btn btn-primary">ایجاد کاربر</button>
          </form>
        </details>
      </div>
      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>نقش</th>
              <th>سمت سازمانی</th>
              <th>سهم پیش‌فرض</th>
              <th>شماره همراه</th>
              <th>وضعیت</th>
              <th>تاریخ عضویت</th>
              <th>پرونده</th>
            </tr>
          </thead>
          <tbody>
            {users.map((x) => (
              <tr key={x.id}>
                <td>
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl grid place-items-center">
                      <UserRound />
                    </div>
                    <div>
                      <b>{x.fullName}</b>
                      <small className="block subtle ltr text-right">
                        {x.email}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge">
                    {x.role === "ADMIN" ? (
                      <>
                        <ShieldCheck size={13} /> مدیر
                      </>
                    ) : x.role === "MANAGER" ? (
                      "مدیر داخلی"
                    ) : (
                      "کاربر دفتر"
                    )}
                  </span>
                </td>
                <td>
                  <b className="block">
                    {
                      personnelLabels[
                        x.employeeProfile?.personnelType || "AGENT"
                      ]
                    }
                  </b>
                  <small className="subtle">
                    {x.employeeProfile?.jobTitle || "بدون عنوان تکمیلی"}
                  </small>
                </td>
                <td>
                  {(
                    (x.employeeProfile?.defaultCommissionBasisPoints || 0) / 100
                  ).toLocaleString("fa-IR")}
                  ٪
                </td>
                <td className="ltr text-right">{x.mobile}</td>
                <td>
                  <span
                    className={`badge ${x.isActive ? "badge-active" : "badge-danger"}`}
                  >
                    {x.isActive ? "فعال" : "غیرفعال"}
                  </span>
                  {x.lockedUntil && x.lockedUntil > new Date() && (
                    <form action={unlockUserAccess} className="mt-2">
                      <input type="hidden" name="userId" value={x.id} />
                      <button className="btn p-2 text-xs text-amber-700">
                        رفع قفل ورود
                      </button>
                    </form>
                  )}
                </td>
                <td>{formatDate(x.createdAt)}</td>
                <td>
                  <div className="flex gap-2">
                    {x.employeeProfile ? (
                      <details className="relative">
                        <summary
                          className="btn list-none cursor-pointer p-2"
                          aria-label={`ویرایش پرونده ${x.fullName}`}
                        >
                          <SlidersHorizontal size={17} />
                        </summary>
                        <form
                          action={updateEmployeeProfile}
                          className="card fixed inset-x-4 top-20 mx-auto max-h-[75vh] w-[720px] max-w-[calc(100vw-2rem)] overflow-auto p-5 z-50 grid gap-4"
                        >
                          <input type="hidden" name="userId" value={x.id} />
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h2 className="font-black text-lg">
                                پرونده پرسنلی {x.fullName}
                              </h2>
                              <small className="subtle">
                                کد: {x.employeeProfile.employeeCode}
                              </small>
                            </div>
                            <span className="badge">
                              {label(x.employeeProfile.employmentStatus)}
                            </span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <label>
                              <span className="label">نوع همکاری</span>
                              <select
                                className="select"
                                name="personnelType"
                                defaultValue={x.employeeProfile.personnelType}
                              >
                                {[
                                  "OWNER",
                                  "MANAGER",
                                  "AGENT",
                                  "MARKETER",
                                  "CONTRACT_EXPERT",
                                  "RECEPTIONIST",
                                  "ACCOUNTANT",
                                  "PHOTOGRAPHER",
                                  "OTHER",
                                ].map((item) => (
                                  <option value={item} key={item}>
                                    {personnelLabels[item]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="label">وضعیت همکاری</span>
                              <select
                                className="select"
                                name="employmentStatus"
                                defaultValue={
                                  x.employeeProfile.employmentStatus
                                }
                              >
                                {[
                                  "ACTIVE",
                                  "ON_LEAVE",
                                  "SUSPENDED",
                                  "ENDED",
                                ].map((item) => (
                                  <option value={item} key={item}>
                                    {label(item)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="label">عنوان شغلی</span>
                              <input
                                className="input"
                                name="jobTitle"
                                defaultValue={x.employeeProfile.jobTitle || ""}
                              />
                            </label>
                            <label>
                              <span className="label">مدیر مستقیم</span>
                              <select
                                className="select"
                                name="managerId"
                                defaultValue={x.employeeProfile.managerId || ""}
                              >
                                <option value="">بدون مدیر مستقیم</option>
                                {users
                                  .filter(
                                    (member) =>
                                      member.id !== x.id && member.isActive,
                                  )
                                  .map((member) => (
                                    <option value={member.id} key={member.id}>
                                      {member.fullName}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label>
                              <span className="label">تاریخ شروع همکاری</span>
                              <JalaliDateInput
                                name="hiredAt"
                                defaultValue={x.employeeProfile.hiredAt}
                              />
                            </label>
                            <label>
                              <span className="label">کد ملی</span>
                              <input
                                className="input ltr text-right"
                                name="nationalCode"
                                defaultValue={
                                  x.employeeProfile.nationalCode || ""
                                }
                              />
                            </label>
                            <label>
                              <span className="label">
                                سهم پیش‌فرض کمیسیون (درصد)
                              </span>
                              <input
                                className="input ltr text-right"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                name="defaultCommissionPercent"
                                defaultValue={
                                  x.employeeProfile
                                    .defaultCommissionBasisPoints / 100
                                }
                              />
                            </label>
                            <label>
                              <span className="label">
                                حقوق ثابت ماهانه (تومان)
                              </span>
                              <input
                                className="input ltr text-right"
                                name="fixedSalaryToman"
                                defaultValue={
                                  x.employeeProfile.fixedSalaryToman?.toString() ||
                                  ""
                                }
                                placeholder={
                                  x.employeeProfile.fixedSalaryToman
                                    ? formatMoney(
                                        x.employeeProfile.fixedSalaryToman,
                                      )
                                    : ""
                                }
                              />
                            </label>
                            <label>
                              <span className="label">بانک</span>
                              <input
                                className="input"
                                name="bankName"
                                defaultValue={x.employeeProfile.bankName || ""}
                              />
                            </label>
                            <label>
                              <span className="label">شماره شبا</span>
                              <input
                                className="input ltr text-right"
                                name="iban"
                                defaultValue={x.employeeProfile.iban || ""}
                              />
                            </label>
                          </div>
                          <label>
                            <span className="label">یادداشت مدیریتی</span>
                            <textarea
                              className="textarea"
                              name="notes"
                              defaultValue={x.employeeProfile.notes || ""}
                            />
                          </label>
                          <div className="flex justify-end">
                            <button className="btn btn-primary">
                              ذخیره پرونده پرسنلی
                            </button>
                          </div>
                        </form>
                      </details>
                    ) : (
                      "—"
                    )}
                    {x.role !== "ADMIN" && (
                      <details className="relative">
                        <summary
                          className="btn list-none cursor-pointer p-2"
                          aria-label={`دسترسی‌های ${x.fullName}`}
                        >
                          <ShieldCheck size={17} />
                        </summary>
                        <form
                          action={saveUserPermissions}
                          className="card fixed inset-x-4 top-14 mx-auto max-h-[82vh] w-[820px] max-w-[calc(100vw-2rem)] overflow-auto p-5 z-50"
                        >
                          <input type="hidden" name="userId" value={x.id} />
                          <div className="mb-5">
                            <h2 className="font-black text-xl">
                              دسترسی‌های {x.fullName}
                            </h2>
                            <p className="subtle">
                              مجوزهای اختصاصی جایگزین پیش‌فرض نقش «
                              {x.role === "MANAGER"
                                ? "مدیر داخلی"
                                : "کاربر دفتر"}
                              » می‌شوند.
                            </p>
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            {permissionCatalog.map(
                              ([permission, group, description]) => {
                                const base = defaultPermissions(x.role);
                                const override = x.permissionOverrides.find(
                                  (item) => item.permission === permission,
                                );
                                const checked =
                                  override?.allowed ?? base.has(permission);
                                return (
                                  <label
                                    className="rounded-xl border border-slate-200 p-3 flex items-start gap-3"
                                    key={permission}
                                  >
                                    <input
                                      className="mt-1 accent-[var(--brick)]"
                                      type="checkbox"
                                      name={`permission:${permission}`}
                                      defaultChecked={checked}
                                    />
                                    <span>
                                      <b className="block">{group}</b>
                                      <small className="subtle">
                                        {description}
                                      </small>
                                    </span>
                                  </label>
                                );
                              },
                            )}
                          </div>
                          <div className="mt-5 flex justify-end">
                            <button className="btn btn-primary">
                              ذخیره دسترسی‌ها
                            </button>
                          </div>
                        </form>
                      </details>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toast-note mt-4">
        برای حفظ دسترسی، غیرفعال‌کردن تنها مدیر فعال سامانه مجاز نیست.
      </div>
    </>
  );
}
