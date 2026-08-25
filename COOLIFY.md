# استقرار آجر روی Coolify

## Docker Compose

1. در Coolify یک Resource از نوع Docker Compose بسازید و مخزن GitHub را انتخاب کنید.
2. فایل Compose را `docker-compose.yaml` و سرویس دامنه را `ajer` قرار دهید.
3. دامنه HTTPS نهایی را پیش از اولین پرداخت در `APP_URL` بنویسید.
4. متغیرهای `.env.coolify.example` را در Environment Variables تعریف کنید.

حداقل متغیرهای اجباری:

```env
APP_URL=https://your-domain.example
SESSION_SECRET=a-random-secret-at-least-32-characters
SETTINGS_ENCRYPTION_KEY=another-random-secret-at-least-32-characters
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=output-of-openssl-rand-base64-32
POSTGRES_PASSWORD=a-long-random-database-password
SUPER_ADMIN_EMAIL=your-private-email
SUPER_ADMIN_PASSWORD=a-private-password-at-least-12-characters
CRON_SECRET=another-long-random-secret
HEALTHCHECK_SECRET=another-independent-random-secret
```

`SESSION_SECRET`، `SETTINGS_ENCRYPTION_KEY` و `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` باید مستقل باشند. کلید آخر هم به‌عنوان Build Argument و هم متغیر زمان اجرا به Compose داده می‌شود تا Server Actionهای استقرارهای متوالی و چند replica سازگار بمانند.

پس از اولین ورود به `/super-admin`، تنظیمات AI، پیامک، زرین‌پال، دامنه عمومی، پشتیبانی و ثبت‌نام را از خود پنل وارد کنید. مقادیر محیطی همچنان به‌عنوان مقدار اولیه و fallback پشتیبانی می‌شوند. `SETTINGS_ENCRYPTION_KEY` کلید مادر رمزگذاری این مقادیر است؛ آن را تغییر ندهید و در backup امن نگه دارید.

## PostgreSQL و ماندگاری

- volume با نام `ajer_postgres` داده PostgreSQL را نگه می‌دارد.
- volume با نام `ajer_uploads` مدارک و رسانه‌ها را در `/app/uploads` نگه می‌دارد؛ فایل‌ها public نیستند و فقط از مسیر احراز هویت‌شده تحویل داده می‌شوند.
- migration در هر شروع با `prisma migrate deploy` اجرا می‌شود.
- `SEED_DEMO_DATA` در تولید باید `false` بماند. seed فقط برای نمایش و داده‌های ساختگی است.
- از دیتابیس و فایل‌های آپلودی snapshot منظم بگیرید و بازیابی backup را آزمایش کنید.

Compose سرویس `backup` را نیز اجرا می‌کند. این سرویس بلافاصله و سپس هر ۲۴ ساعت یک `pg_dump` فشرده، آرشیو فایل‌های محلی و checksum می‌سازد و ۱۴ روز نگه می‌دارد. تنظیم‌ها:

```env
BACKUP_MONITOR_ENABLED=true
BACKUP_MAX_AGE_HOURS=30
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=14
```

volume داخلی backup به‌تنهایی برای خرابی کامل سرور کافی نیست؛ snapshot آن را روزانه به فضای مستقل از سرور Coolify منتقل کنید. حداقل ماهی یک‌بار بازیابی را روی یک محیط جدا آزمایش کنید.

### بازیابی کنترل‌شده

ابتدا ترافیک و سرویس‌های `ajer` و `backup` را متوقف کنید، سپس در ترمینال Resource و با نام دقیق فایل اجرا کنید:

```bash
docker compose run --rm --entrypoint /usr/local/bin/restore-backup \
  -e ALLOW_RESTORE=yes backup \
  /backups/ajer-db-YYYYMMDDTHHMMSSZ.dump \
  /backups/ajer-uploads-YYYYMMDDTHHMMSSZ.tar.gz
```

پس از بازیابی، برنامه را بالا بیاورید تا migration اجرا شود و پیش از بازکردن ترافیک، تست‌های گرم را انجام دهید. اسکریپت بدون `ALLOW_RESTORE=yes` عمداً اجرا نمی‌شود.

## فایل خصوصی و S3-compatible

حالت پیش‌فرض `local` و volume خصوصی است. برای MinIO، Cloudflare R2 یا سرویس S3-compatible این مقادیر را تنظیم کنید:

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://object-storage.example.com
S3_REGION=auto
S3_BUCKET=ajer-private
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

bucket باید private باشد، دسترسی عمومی نداشته باشد و Versioning/Lifecycle آن در سرویس ذخیره‌سازی فعال شود. فایل همچنان فقط پس از احراز هویت و کنترل دفتر/سطح رکورد از خود آجر تحویل داده می‌شود.

## راه‌اندازی مدیریت کل

در اولین شروع، اسکریپت bootstrap فقط در صورتی حساب سوپرادمین می‌سازد که `SUPER_ADMIN_EMAIL` و `SUPER_ADMIN_PASSWORD` تنظیم شده باشند. آدرس ورود آن `/super-admin/login` است و فرم عضویت ندارد. تغییر بعدی رمز باید با روال امن مدیریتی و نه از طریق ثبت‌نام عمومی انجام شود.

## بررسی سلامت

Coolify باید healthcheck سرویس‌های `ajer`، `backup` و PostgreSQL را سبز نشان دهد. مسیر `/api/health/live` زنده‌بودن فرایند و `/api/health/ready` اتصال دیتابیس، فضای فایل و تازگی backup را بررسی می‌کند. جزئیات readiness فقط با هدر `Authorization: Bearer $HEALTHCHECK_SECRET` نمایش داده می‌شود.

- `/` لندینگ عمومی
- `/signup` ثبت‌نام دفتر
- `/login` ورود کاربران
- `/super-admin/login` ورود خصوصی مالک پلتفرم

callback زرین‌پال به‌صورت خودکار از `APP_URL` ساخته می‌شود؛ بنابراین دامنه باید عمومی، HTTPS و دقیق باشد.

## زمان‌بندی عملیات فروش

برای ارسال یادآورهای بازدید، وضعیت پیشنهاد و اعلان وظایف، در Coolify یک Cron هر ۵ دقیقه تعریف کنید که درخواست زیر را ارسال کند:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.example/api/cron/operations
```

در پنل سوپرادمین، شناسه قالب‌های «یادآوری بازدید» و «وضعیت پیشنهاد» SMS.ir را وارد کنید. پردازشگر ناموفق‌ها را حداکثر سه بار امتحان می‌کند و درخواست Cron بدون `CRON_SECRET` معتبر پذیرفته نمی‌شود.
