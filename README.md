# آجر؛ سامانه نقشه‌محور مدیریت املاک

آجر یک MVP کامل و راست‌به‌چپ برای مدیریت فایل‌های ملکی، مالکان، متقاضیان، پیگیری‌ها، بازدیدها و معاملات است. شهر نمایشی محصول ارومیه است و تمام نام‌ها، شماره‌ها، نشانی‌ها و رکوردها کاملاً ساختگی‌اند.

طراحی و توسعه: [آراز شاه‌کرمی](https://araz.me)

## امکانات اصلی

- داشبورد داده‌محور، نمودار و نقشه فایل‌های فعال
- جست‌وجو، فیلتر، ایجاد، ویرایش، کپی و بایگانی فایل
- نقشه OpenStreetMap با نشانگر فایل‌های ارومیه و انتخاب موقعیت
- دفترچه مالکان و متقاضیان با جلوگیری از موبایل تکراری
- تطبیق شفاف درخواست و ملک با امتیاز و دلیل
- جست‌وجوی فایل با زبان طبیعی از طریق AvalAI و امتیازدهی محلی نتایج
- پیگیری، بازدید، خط لوله معامله، گزارش، اعلان و جست‌وجوی سراسری
- نقش مدیر و مشاور، رمز bcrypt و نشست HTTP-only

## فناوری

Next.js App Router، TypeScript strict، React، Tailwind CSS، Prisma، SQLite، React Leaflet، Recharts، Zod، React Hook Form، Lucide و Vitest.

## راه‌اندازی

پیش‌نیاز: Node.js 20 یا جدیدتر و npm.

```bash
npm install
cp .env.example .env
# مقدار SESSION_SECRET را با یک رشته تصادفی حداقل ۳۲ نویسه‌ای عوض کنید
# برای جست‌وجوی هوشمند AVALAI_API_KEY را نیز تنظیم کنید
npm run db:migrate
npm run db:seed
npm run dev
```

برنامه در `http://localhost:3000` اجرا می‌شود. دریافت کاشی‌های OpenStreetMap نیازمند اینترنت است؛ سایر داده‌ها و تصاویر نسخه نمایشی محلی هستند.

## تنظیم AvalAI

متغیرهای زیر فقط روی سرور استفاده می‌شوند:

```env
AVALAI_API_KEY=your-avalai-api-key
AVALAI_BASE_URL=https://api.avalai.ir/v1
AVALAI_MODEL=gpt-5.4-mini
```

آجر متن فارسی کاربر را برای استخراج معیارهای جست‌وجو به AvalAI می‌فرستد، اما اطلاعات مالکان و متقاضیان را ارسال نمی‌کند. فیلتر و امتیازدهی نهایی روی داده‌های محلی SQLite انجام می‌شود.

## Docker و Coolify

برای اجرای محلی Compose:

```bash
cp .env.coolify.example .env.coolify
# مقادیر secret و AvalAI را ویرایش کنید
docker compose --env-file .env.coolify up --build
```

راهنمای کامل استقرار و volumeهای پایدار در [COOLIFY.md](./COOLIFY.md) آمده است.

## حساب‌های نمایشی

- مدیر: `admin@ajer.ir` / `Ajer123!`
- مشاور: `agent@ajer.ir` / `Ajer123!`

## پایگاه داده و فایل‌ها

- فایل SQLite: `prisma/dev.db`
- تصاویر آپلودی: `public/uploads`
- تصاویر نمونه: `public/property-*.png`

بازنشانی کامل داده‌ها:

```bash
npm run db:reset
```

## کنترل کیفیت

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## ساختار پروژه

- `app/`: مسیرها، layoutها و Server Actionها
- `components/`: اجزای مشترک، فرم، نقشه و نمودار
- `lib/`: احراز هویت، دیتابیس، اعتبارسنجی و ابزارها
- `prisma/`: schema، migration و seed قطعی
- `tests/`: تست‌های واحد موتور تطبیق و ابزارهای دامنه

## محدودیت‌های MVP و مسیر تولید

آپلود محلی برای استقرار چندسروری مناسب نیست و باید با object storage جایگزین شود. برای تولید، PostgreSQL/PostGIS، پشتیبان‌گیری زمان‌بندی‌شده، پیامک واقعی، rate limiting، session store قابل ابطال، سیاست مناسب سرویس کاشی نقشه، کنترل حریم خصوصی و ممیزی کامل لازم است. مرز محله‌های نمایش‌داده‌شده رسمی نیست. خروجی تقویم شمسی نمایشی است اما ورودی تاریخ ماشین ISO باقی می‌ماند.
