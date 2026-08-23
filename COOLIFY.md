# استقرار آجر روی Coolify

## روش پیشنهادی: Docker Compose

1. در Coolify یک Resource از نوع **Docker Compose** بسازید و مخزن GitHub پروژه را انتخاب کنید.
2. فایل Compose را `docker-compose.yml` قرار دهید و پورت سرویس را `3000` انتخاب کنید.
3. دامنه دلخواه را به سرویس `ajer` متصل کنید.
4. متغیرهای زیر را در بخش Environment Variables تعریف کنید:

```env
SESSION_SECRET=یک-رشته-تصادفی-حداقل-۳۲-نویسه‌ای
AVALAI_API_KEY=کلید-AvalAI
AVALAI_BASE_URL=https://api.avalai.ir/v1
AVALAI_MODEL=gpt-5.4-mini
SEED_DEMO_DATA=true
```

برای ساخت secret می‌توانید از `openssl rand -base64 48` استفاده کنید. کلید AvalAI فقط در سرور نگهداری می‌شود و نباید پیشوند `NEXT_PUBLIC_` داشته باشد.

## ماندگاری داده

- `ajer_database` فایل SQLite را در `/app/data/ajer.db` نگه می‌دارد.
- `ajer_uploads` برای فایل‌های محلی در `/app/public/uploads` است.
- migration در هر شروع کانتینر اجرا می‌شود.
- seed نمایشی فقط زمانی اجرا می‌شود که فایل دیتابیس هنوز وجود نداشته باشد. برای یک پایگاه خالی تولیدی، `SEED_DEMO_DATA=false` قرار دهید و کاربر اولیه را با روال مدیریتی مناسب ایجاد کنید.

## AvalAI

آجر از endpoint سازگار با OpenAI در `https://api.avalai.ir/v1/chat/completions` استفاده می‌کند. در صورت نیاز به دامنه داخلی جایگزین می‌توانید `AVALAI_BASE_URL=https://api.avalapis.ir/v1` تنظیم کنید.

## پشتیبان‌گیری

از volume دیتابیس به‌صورت منظم snapshot بگیرید. هنگام کپی مستقیم فایل SQLite بهتر است نوشتن برنامه موقتاً متوقف شود یا از روش backup سازگار با SQLite استفاده شود.
