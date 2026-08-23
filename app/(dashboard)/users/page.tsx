import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ShieldCheck, UserRound, Plus } from "lucide-react";
import { createUser } from "@/app/actions";
export const metadata = { title: "کاربران" };
export default async function Users() {
  const u = await requireAdmin();
  const users = await db.user.findMany({
    where: { agencyId: u.agencyId },
    orderBy: { createdAt: "asc" },
  });
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">کاربران</h1>
          <p className="subtle">مدیریت اعضای تیم و سطح دسترسی</p>
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
              <option value="AGENT">مشاور</option>
              <option value="MANAGER">مدیر داخلی</option>
              <option value="ADMIN">مدیر سامانه</option>
            </select>
            <input
              className="input ltr text-right"
              type="password"
              name="password"
              placeholder="رمز موقت، حداقل ۸ نویسه"
              minLength={8}
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
              <th>شماره همراه</th>
              <th>وضعیت</th>
              <th>تاریخ عضویت</th>
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
                    ) : (
                      "مشاور"
                    )}
                  </span>
                </td>
                <td className="ltr text-right">{x.mobile}</td>
                <td>
                  <span
                    className={`badge ${x.isActive ? "badge-active" : "badge-danger"}`}
                  >
                    {x.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </td>
                <td>{formatDate(x.createdAt)}</td>
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
