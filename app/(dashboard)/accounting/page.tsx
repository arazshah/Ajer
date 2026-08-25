import Link from "next/link";
import {
  CircleDollarSign,
  Landmark,
  Plus,
  ReceiptText,
  Scale,
  WalletCards,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import {
  approvePayroll,
  createCheckRecord,
  createFinanceCategory,
  createFinanceTransaction,
  createFinancialAccount,
  createPayrollRecord,
  payPayroll,
  settleFinanceObligation,
  updateCheckStatus,
  voidFinanceTransaction,
} from "@/app/accounting-actions";
import {
  calculateAccountBalances,
  calculateProfitAndLoss,
} from "@/lib/accounting";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { JalaliDateInput } from "@/components/jalali-date-input";

export const metadata = { title: "حسابداری دفتر" };
export const dynamic = "force-dynamic";

const tabs = [
  ["overview", "داشبورد مالی"],
  ["transactions", "گردش‌ها"],
  ["obligations", "بدهکار و بستانکار"],
  ["checks", "چک‌ها"],
  ["payroll", "حقوق و پورسانت"],
  ["settings", "حساب‌ها و دسته‌ها"],
] as const;

type AccountingTransaction = Prisma.FinanceTransactionGetPayload<{
  include: {
    sourceAccount: true;
    destinationAccount: true;
    category: true;
    contact: true;
    employee: true;
    createdBy: true;
    check: true;
  };
}>;
type AccountingCheck = Prisma.CheckRecordGetPayload<{
  include: { contact: true; account: true };
}>;
type AccountingPayroll = Prisma.PayrollRecordGetPayload<{
  include: { user: true; employeeProfile: true };
}>;
type AccountingEmployee = Prisma.UserGetPayload<{
  include: { employeeProfile: true };
}>;
type AccountingAccount = Prisma.FinancialAccountGetPayload<object>;
type AccountingCategory = Prisma.FinanceCategoryGetPayload<object>;

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    created?: string;
    error?: string;
  }>;
}) {
  const user = await requirePermission("accounting.view");
  const canManage = await hasPermission(user, "accounting.manage");
  const query = await searchParams;
  const tab = tabs.some(([value]) => value === query.tab)
    ? query.tab!
    : "overview";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    accounts,
    categories,
    transactions,
    monthTransactions,
    checks,
    payrolls,
    contacts,
    properties,
    deals,
    employees,
  ] = await Promise.all([
    db.financialAccount.findMany({
      where: { agencyId: user.agencyId },
      orderBy: [{ isActive: "desc" }, { type: "asc" }],
    }),
    db.financeCategory.findMany({
      where: { agencyId: user.agencyId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.financeTransaction.findMany({
      where: { agencyId: user.agencyId },
      include: {
        sourceAccount: true,
        destinationAccount: true,
        category: true,
        contact: true,
        employee: true,
        createdBy: true,
        check: true,
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    db.financeTransaction.findMany({
      where: { agencyId: user.agencyId, occurredAt: { gte: monthStart } },
      select: { type: true, status: true, amountToman: true },
    }),
    db.checkRecord.findMany({
      where: { agencyId: user.agencyId },
      include: { contact: true, account: true },
      orderBy: { dueAt: "asc" },
      take: 200,
    }),
    db.payrollRecord.findMany({
      where: { agencyId: user.agencyId },
      include: { user: true, employeeProfile: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 200,
    }),
    db.contact.findMany({
      where: { agencyId: user.agencyId },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 500,
    }),
    db.property.findMany({
      where: { agencyId: user.agencyId },
      select: { id: true, code: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.deal.findMany({
      where: { agencyId: user.agencyId },
      include: { property: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.user.findMany({
      where: { agencyId: user.agencyId, isActive: true },
      include: { employeeProfile: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const balances = calculateAccountBalances(accounts, transactions);
  const totalCash = [...balances.values()].reduce(
    (sum, amount) => sum + amount,
    0n,
  );
  const pnl = calculateProfitAndLoss(monthTransactions);
  const obligations = transactions.filter(
    (item) =>
      ["RECEIVABLE", "PAYABLE"].includes(item.type) && item.status === "POSTED",
  );
  const receivable = obligations
    .filter((item) => item.type === "RECEIVABLE")
    .reduce((sum, item) => sum + item.amountToman, 0n);
  const payable = obligations
    .filter((item) => item.type === "PAYABLE")
    .reduce((sum, item) => sum + item.amountToman, 0n);
  const activeAccounts = accounts.filter((item) => item.isActive);

  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title flex gap-2">
            <Landmark className="text-brick" /> حسابداری دفتر
          </h1>
          <p className="subtle">
            صندوق، بانک، تنخواه، تعهدات، چک، حقوق و سود و زیان
          </p>
        </div>
        {canManage && tab === "transactions" && (
          <details>
            <summary className="btn btn-primary list-none cursor-pointer">
              <Plus size={16} /> گردش جدید
            </summary>
            <TransactionForm
              accounts={activeAccounts}
              categories={categories}
              contacts={contacts}
              properties={properties}
              deals={deals}
              employees={employees}
            />
          </details>
        )}
      </div>
      {query.created && (
        <div className="toast-note mb-4 text-green-700">
          عملیات مالی با موفقیت ثبت شد.
        </div>
      )}
      {query.error && (
        <div className="toast-note mb-4 text-red-700">
          اطلاعات مالی معتبر نیست یا حساب و دسته انتخاب‌شده با نوع عملیات سازگار
          نیست.
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([value, title]) => (
          <Link
            className={`btn ${tab === value ? "btn-dark" : ""}`}
            href={`/accounting?tab=${value}`}
            key={value}
          >
            {title}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid-auto mb-5">
            <Stat
              icon={WalletCards}
              title="موجودی نقد و بانک"
              value={formatMoney(totalCash)}
              color="text-blue-600"
            />
            <Stat
              icon={CircleDollarSign}
              title="درآمد این ماه"
              value={formatMoney(pnl.income)}
              color="text-green-600"
            />
            <Stat
              icon={ReceiptText}
              title="هزینه این ماه"
              value={formatMoney(pnl.expense)}
              color="text-red-600"
            />
            <Stat
              icon={Scale}
              title="سود خالص این ماه"
              value={formatMoney(pnl.profit)}
              color={pnl.profit >= 0n ? "text-green-700" : "text-red-700"}
            />
          </div>
          <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-5">
            <section className="card p-5">
              <h2 className="font-black text-lg mb-4">مانده حساب‌ها</h2>
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                    key={account.id}
                  >
                    <div>
                      <b>{account.name}</b>
                      <small className="block subtle">
                        {label(account.type)} · {account.code}
                      </small>
                    </div>
                    <strong>{formatMoney(balances.get(account.id))}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-5">
              <h2 className="font-black text-lg mb-4">تعهدات و سررسید</h2>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-green-50 p-4">
                  <small>حساب‌های دریافتنی</small>
                  <b className="block text-green-700 mt-1">
                    {formatMoney(receivable)}
                  </b>
                </div>
                <div className="rounded-xl bg-red-50 p-4">
                  <small>حساب‌های پرداختنی</small>
                  <b className="block text-red-700 mt-1">
                    {formatMoney(payable)}
                  </b>
                </div>
              </div>
              {obligations.slice(0, 6).map((item) => (
                <div
                  className="flex justify-between border-b py-3"
                  key={item.id}
                >
                  <span>{item.description}</span>
                  <b>{formatMoney(item.amountToman)}</b>
                </div>
              ))}
            </section>
          </div>
        </>
      )}

      {tab === "transactions" && (
        <TransactionTable transactions={transactions} canManage={canManage} />
      )}

      {tab === "obligations" && (
        <section className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>نوع</th>
                <th>شرح و طرف حساب</th>
                <th>مبلغ</th>
                <th>سررسید</th>
                <th>تسویه</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span
                      className={`badge ${item.type === "RECEIVABLE" ? "badge-active" : "badge-danger"}`}
                    >
                      {label(item.type)}
                    </span>
                  </td>
                  <td>
                    <b>{item.description}</b>
                    <small className="block subtle">
                      {item.contact?.fullName || item.employee?.fullName || "—"}
                    </small>
                  </td>
                  <td>{formatMoney(item.amountToman)}</td>
                  <td>{item.dueAt ? formatDate(item.dueAt) : "—"}</td>
                  <td>
                    {canManage && (
                      <form
                        action={settleFinanceObligation.bind(null, item.id)}
                        className="flex gap-2"
                      >
                        <select
                          className="select min-w-36"
                          name="accountId"
                          required
                        >
                          <option value="">انتخاب حساب</option>
                          {activeAccounts.map((account) => (
                            <option value={account.id} key={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn p-2">تسویه کامل</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!obligations.length && (
            <div className="empty">تعهد بازی وجود ندارد.</div>
          )}
        </section>
      )}

      {tab === "checks" && (
        <ChecksTab
          checks={checks}
          contacts={contacts}
          accounts={activeAccounts}
          canManage={canManage}
        />
      )}

      {tab === "payroll" && (
        <PayrollTab
          payrolls={payrolls}
          employees={employees}
          accounts={activeAccounts}
          canManage={canManage}
        />
      )}

      {tab === "settings" && (
        <SettingsTab
          accounts={accounts}
          balances={balances}
          categories={categories}
          canManage={canManage}
        />
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  title,
  value,
  color,
}: {
  icon: typeof Landmark;
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card stat">
      <Icon className={color} />
      <span className="subtle">{title}</span>
      <strong className="text-base">{value}</strong>
    </div>
  );
}

function TransactionForm({
  accounts,
  categories,
  contacts,
  properties,
  deals,
  employees,
}: {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
  contacts: Array<{ id: string; fullName: string }>;
  properties: Array<{ id: string; code: string; title: string }>;
  deals: Array<{ id: string; property: { code: string } }>;
  employees: Array<{ id: string; fullName: string }>;
}) {
  return (
    <form
      action={createFinanceTransaction}
      className="card absolute left-6 z-30 mt-2 grid w-[680px] max-w-[94vw] gap-3 p-5"
    >
      <div className="grid md:grid-cols-3 gap-3">
        <select className="select" name="type" required>
          <option value="INCOME">درآمد نقدی</option>
          <option value="EXPENSE">هزینه نقدی</option>
          <option value="TRANSFER">انتقال بین حساب‌ها</option>
          <option value="RECEIVABLE">ثبت طلب</option>
          <option value="PAYABLE">ثبت بدهی</option>
          <option value="PETTY_CASH_ADVANCE">پرداخت تنخواه</option>
          <option value="PETTY_CASH_SETTLEMENT">تسویه تنخواه</option>
          <option value="REFUND">بازپرداخت</option>
        </select>
        <input
          className="input ltr text-right"
          name="amountToman"
          placeholder="مبلغ تومان"
          required
        />
        <JalaliDateInput name="occurredAt" defaultValue={new Date()} required />
        <select className="select" name="sourceAccountId">
          <option value="">حساب مبدا / پرداخت</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select className="select" name="destinationAccountId">
          <option value="">حساب مقصد / دریافت</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select className="select" name="categoryId">
          <option value="">دسته مالی</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.type === "INCOME" ? "درآمد" : "هزینه"} · {item.name}
            </option>
          ))}
        </select>
        <select className="select" name="contactId">
          <option value="">بدون طرف حساب</option>
          {contacts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName}
            </option>
          ))}
        </select>
        <select className="select" name="propertyId">
          <option value="">بدون ملک</option>
          {properties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.title}
            </option>
          ))}
        </select>
        <select className="select" name="dealId">
          <option value="">بدون معامله</option>
          {deals.map((item) => (
            <option key={item.id} value={item.id}>
              معامله {item.property.code}
            </option>
          ))}
        </select>
        <select className="select" name="employeeId">
          <option value="">بدون پرسنل</option>
          {employees.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName}
            </option>
          ))}
        </select>
        <JalaliDateInput name="dueAt" aria-label="سررسید" />
        <input className="input" name="reference" placeholder="شماره مرجع" />
      </div>
      <input
        className="input"
        name="description"
        placeholder="شرح گردش مالی"
        required
      />
      <textarea className="textarea" name="notes" placeholder="یادداشت داخلی" />
      <small className="subtle">
        برای درآمد حساب مقصد، برای هزینه حساب مبدا و برای انتقال هر دو حساب را
        انتخاب کنید. طلب و بدهی فقط به سررسید نیاز دارند.
      </small>
      <button className="btn btn-primary">ثبت قطعی گردش</button>
    </form>
  );
}

function TransactionTable({
  transactions,
  canManage,
}: {
  transactions: AccountingTransaction[];
  canManage: boolean;
}) {
  return (
    <section className="card table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>شماره و تاریخ</th>
            <th>نوع و شرح</th>
            <th>حساب</th>
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {transactions.map((item) => (
            <tr key={item.id}>
              <td>
                <b className="ltr">{item.transactionNumber}</b>
                <small className="block subtle">
                  {formatDateTime(item.occurredAt)}
                </small>
              </td>
              <td>
                <span className="badge">{label(item.type)}</span>
                <b className="block mt-1">{item.description}</b>
                <small>
                  {item.contact?.fullName ||
                    item.employee?.fullName ||
                    item.category?.name ||
                    "—"}
                </small>
              </td>
              <td>
                <small>
                  {item.sourceAccount?.name || "—"} ←{" "}
                  {item.destinationAccount?.name || "—"}
                </small>
              </td>
              <td
                className={
                  item.destinationAccountId
                    ? "text-green-700"
                    : item.sourceAccountId
                      ? "text-red-700"
                      : ""
                }
              >
                {formatMoney(item.amountToman)}
              </td>
              <td>
                <span
                  className={`badge ${item.status === "VOID" ? "badge-danger" : item.status === "SETTLED" ? "badge-active" : ""}`}
                >
                  {label(item.status)}
                </span>
              </td>
              <td>
                {canManage &&
                  item.status === "POSTED" &&
                  !item.check &&
                  !["RECEIVABLE", "PAYABLE"].includes(item.type) && (
                    <form action={voidFinanceTransaction.bind(null, item.id)}>
                      <button className="btn p-2 text-red-700">ابطال</button>
                    </form>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!transactions.length && (
        <div className="empty">گردش مالی ثبت نشده است.</div>
      )}
    </section>
  );
}

function ChecksTab({
  checks,
  contacts,
  accounts,
  canManage,
}: {
  checks: AccountingCheck[];
  contacts: Array<{ id: string; fullName: string }>;
  accounts: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  return (
    <div className="space-y-5">
      {canManage && (
        <details>
          <summary className="btn btn-primary list-none cursor-pointer w-fit">
            ثبت چک
          </summary>
          <form
            action={createCheckRecord}
            className="card mt-3 grid md:grid-cols-4 gap-3 p-5"
          >
            <select className="select" name="direction">
              <option value="RECEIVABLE">چک دریافتی</option>
              <option value="PAYABLE">چک پرداختی</option>
            </select>
            <input
              className="input"
              name="checkNumber"
              placeholder="شماره چک"
              required
            />
            <input className="input" name="sayadId" placeholder="شناسه صیادی" />
            <input
              className="input ltr text-right"
              name="amountToman"
              placeholder="مبلغ تومان"
              required
            />
            <input
              className="input"
              name="bankName"
              placeholder="بانک"
              required
            />
            <input className="input" name="branchName" placeholder="شعبه" />
            <input
              className="input"
              name="issuerName"
              placeholder="صادرکننده / ذی‌نفع"
              required
            />
            <select className="select" name="contactId">
              <option value="">طرف حساب</option>
              {contacts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>
            <label>
              <span className="label">تاریخ صدور</span>
              <JalaliDateInput name="issuedAt" />
            </label>
            <label>
              <span className="label">سررسید</span>
              <JalaliDateInput name="dueAt" required />
            </label>
            <textarea
              className="textarea md:col-span-2"
              name="notes"
              placeholder="توضیحات"
            />
            <button className="btn btn-primary md:col-span-4">
              ثبت چک و تعهد
            </button>
          </form>
        </details>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {checks.map((check) => (
          <article className="card p-5" key={check.id}>
            <div className="flex justify-between">
              <div>
                <span
                  className={`badge ${check.direction === "RECEIVABLE" ? "badge-active" : "badge-danger"}`}
                >
                  {label(check.direction)}
                </span>
                <h3 className="font-black mt-2">
                  چک {check.checkNumber} · {check.bankName}
                </h3>
              </div>
              <span className="badge">{label(check.status)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <span>مبلغ</span>
              <b>{formatMoney(check.amountToman)}</b>
              <span>سررسید</span>
              <b>{formatDate(check.dueAt)}</b>
              <span>طرف حساب</span>
              <b>{check.contact?.fullName || check.issuerName}</b>
            </div>
            {canManage && !["CLEARED", "CANCELLED"].includes(check.status) && (
              <div className="flex flex-wrap gap-2 mt-4">
                <form
                  action={updateCheckStatus.bind(null, check.id, "DEPOSITED")}
                >
                  <button className="btn p-2">واگذاری به بانک</button>
                </form>
                <form
                  action={updateCheckStatus.bind(null, check.id, "BOUNCED")}
                >
                  <button className="btn p-2 text-red-700">برگشتی</button>
                </form>
                <form
                  action={updateCheckStatus.bind(null, check.id, "CLEARED")}
                  className="flex gap-2"
                >
                  <select className="select" name="accountId" required>
                    <option value="">حساب وصول/پرداخت</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn p-2 text-green-700">وصول</button>
                </form>
              </div>
            )}
          </article>
        ))}
        {!checks.length && (
          <div className="empty lg:col-span-2">چکی ثبت نشده است.</div>
        )}
      </div>
    </div>
  );
}

function PayrollTab({
  payrolls,
  employees,
  accounts,
  canManage,
}: {
  payrolls: AccountingPayroll[];
  employees: AccountingEmployee[];
  accounts: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const now = new Date();
  return (
    <div className="space-y-5">
      {canManage && (
        <details>
          <summary className="btn btn-primary list-none cursor-pointer w-fit">
            محاسبه حقوق ماه
          </summary>
          <form
            action={createPayrollRecord}
            className="card mt-3 grid md:grid-cols-4 gap-3 p-5"
          >
            <select className="select" name="employeeId" required>
              <option value="">انتخاب پرسنل</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>
            <input
              className="input ltr text-right"
              name="year"
              defaultValue={new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
                year: "numeric",
              }).format(now)}
              placeholder="سال شمسی"
              required
            />
            <input
              className="input ltr text-right"
              name="month"
              placeholder="ماه ۱ تا ۱۲"
              required
            />
            <input
              className="input ltr text-right"
              name="baseSalaryToman"
              placeholder="حقوق پایه"
            />
            <input
              className="input ltr text-right"
              name="commissionToman"
              placeholder="پورسانت"
            />
            <input
              className="input ltr text-right"
              name="bonusToman"
              placeholder="پاداش"
            />
            <input
              className="input ltr text-right"
              name="deductionToman"
              placeholder="کسورات"
            />
            <textarea
              className="textarea md:col-span-3"
              name="notes"
              placeholder="توضیحات فیش"
            />
            <button className="btn btn-primary">ساخت فیش</button>
          </form>
        </details>
      )}
      <div className="card table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>پرسنل / دوره</th>
              <th>حقوق پایه</th>
              <th>پورسانت و پاداش</th>
              <th>کسورات</th>
              <th>خالص</th>
              <th>وضعیت و عملیات</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map((payroll) => (
              <tr key={payroll.id}>
                <td>
                  <b>{payroll.user.fullName}</b>
                  <small className="block subtle">
                    {payroll.year}/{payroll.month}
                  </small>
                </td>
                <td>{formatMoney(payroll.baseSalaryToman)}</td>
                <td>
                  {formatMoney(payroll.commissionToman + payroll.bonusToman)}
                </td>
                <td>{formatMoney(payroll.deductionToman)}</td>
                <td>
                  <b>{formatMoney(payroll.netPayableToman)}</b>
                </td>
                <td>
                  <span className="badge">{label(payroll.status)}</span>
                  {canManage && payroll.status === "DRAFT" && (
                    <form
                      className="inline mr-2"
                      action={approvePayroll.bind(null, payroll.id)}
                    >
                      <button className="btn p-2">تأیید</button>
                    </form>
                  )}
                  {canManage && payroll.status === "APPROVED" && (
                    <form
                      className="inline-flex gap-2 mr-2"
                      action={payPayroll.bind(null, payroll.id)}
                    >
                      <select className="select" name="accountId" required>
                        <option value="">حساب پرداخت</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn p-2 text-green-700">پرداخت</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!payrolls.length && (
          <div className="empty">فیش حقوقی ثبت نشده است.</div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({
  accounts,
  balances,
  categories,
  canManage,
}: {
  accounts: AccountingAccount[];
  balances: Map<string, bigint>;
  categories: AccountingCategory[];
  canManage: boolean;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-5">
        <div className="flex justify-between">
          <h2 className="font-black text-lg">صندوق و حساب‌ها</h2>
          {canManage && (
            <details>
              <summary className="btn p-2 list-none cursor-pointer">
                افزودن
              </summary>
              <form
                action={createFinancialAccount}
                className="absolute left-8 card p-4 z-20 grid gap-2 w-80"
              >
                <input
                  className="input"
                  name="name"
                  placeholder="نام حساب"
                  required
                />
                <input
                  className="input ltr"
                  name="code"
                  placeholder="کد لاتین؛ BANK2"
                  required
                />
                <select className="select" name="type">
                  <option value="CASH">صندوق</option>
                  <option value="BANK">بانک</option>
                  <option value="PETTY_CASH">تنخواه</option>
                </select>
                <input
                  className="input"
                  name="bankName"
                  placeholder="نام بانک"
                />
                <input
                  className="input ltr"
                  name="accountNumber"
                  placeholder="شماره حساب"
                />
                <input className="input ltr" name="iban" placeholder="شبا" />
                <input
                  className="input ltr text-right"
                  name="openingBalanceToman"
                  placeholder="مانده اول دوره"
                />
                <button className="btn btn-primary">ذخیره حساب</button>
              </form>
            </details>
          )}
        </div>
        {accounts.map((account) => (
          <div className="flex justify-between border-b py-3" key={account.id}>
            <div>
              <b>{account.name}</b>
              <small className="block subtle">
                {label(account.type)} · {account.code}
              </small>
            </div>
            <b>{formatMoney(balances.get(account.id))}</b>
          </div>
        ))}
      </section>
      <section className="card p-5">
        <div className="flex justify-between">
          <h2 className="font-black text-lg">دسته‌های درآمد و هزینه</h2>
          {canManage && (
            <details>
              <summary className="btn p-2 list-none cursor-pointer">
                افزودن
              </summary>
              <form
                action={createFinanceCategory}
                className="absolute left-8 card p-4 z-20 grid gap-2 w-80"
              >
                <input
                  className="input"
                  name="name"
                  placeholder="نام دسته"
                  required
                />
                <select className="select" name="type">
                  <option value="INCOME">درآمد</option>
                  <option value="EXPENSE">هزینه</option>
                </select>
                <button className="btn btn-primary">ذخیره دسته</button>
              </form>
            </details>
          )}
        </div>
        {categories.map((category) => (
          <div className="flex justify-between border-b py-3" key={category.id}>
            <span>{category.name}</span>
            <span
              className={`badge ${category.type === "INCOME" ? "badge-active" : "badge-danger"}`}
            >
              {label(category.type)}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
