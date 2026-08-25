"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Sparkles,
  Search,
  Loader2,
  ArrowLeft,
  MapPin,
  Bot,
  RotateCcw,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { label } from "@/lib/labels";

type Result = {
  id: string;
  code: string;
  title: string;
  neighborhood: string;
  area: number;
  bedrooms: number | null;
  transactionType: string;
  propertyType: string;
  priceTotal: string | null;
  depositAmount: string | null;
  monthlyRent: string | null;
  imageUrl: string;
  assignedAgent: string;
  score: number;
  reasons: string[];
};
type SearchResponse = { criteria: { summary: string }; results: Result[] };

export function AiPropertySearch() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3)
      return setError("شرایط جست‌وجو را کمی کامل‌تر بنویسید.");
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await fetch("/api/ai/property-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = (await response.json()) as SearchResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "جست‌وجو انجام نشد.");
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "جست‌وجو انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card overflow-hidden mb-5 border-[#e6c9b8]">
      <div className="p-5 md:p-6 bg-gradient-to-l from-[#fff8f3] to-white">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-brick text-white grid place-items-center">
            <Sparkles size={22} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">جست‌وجوی هوشمند فایل</h2>
              <span className="badge badge-warn">
                <Bot size={13} /> دستیار هوشمند آجر
              </span>
            </div>
            <p className="subtle mt-1">
              شرایط مشتری را همان‌طور که صحبت می‌کند بنویسید؛ آجر مناسب‌ترین
              فایل‌ها را پیدا می‌کند.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col md:flex-row gap-2">
          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="textarea flex-1 min-h-[86px] md:min-h-[64px] text-base"
            placeholder="مثلاً: یک آپارتمان دوخوابه در استادان یا دانشکده، حدود ۱۰۰ متر، تا ۶ میلیارد تومان، حتماً پارکینگ و آسانسور داشته باشد"
            aria-label="شرایط جست‌وجوی هوشمند"
          />
          <button
            disabled={loading}
            className="btn btn-primary md:w-40"
            type="submit"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Search size={18} />
            )}{" "}
            {loading ? "در حال بررسی…" : "پیدا کن"}
          </button>
        </form>
        <div className="flex flex-wrap gap-2 mt-3 text-xs subtle">
          <span>نمونه:</span>
          {[
            "ویلای فروشی در بند تا ۱۰ میلیارد",
            "رهن و اجاره آپارتمان با پارکینگ",
            "مغازه در خیام بالای ۷۰ متر",
          ].map((sample) => (
            <button
              type="button"
              className="hover:text-brick"
              onClick={() => setQuery(sample)}
              key={sample}
            >
              «{sample}»
            </button>
          ))}
        </div>
        {error && (
          <div
            className="mt-4 p-3 rounded-xl bg-red-50 text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
      {data && (
        <div className="border-t border-[#eaded5] p-5">
          <div className="section-head">
            <div>
              <b>برداشت آجر:</b>{" "}
              <span className="subtle">{data.criteria.summary}</span>
              <p className="text-sm mt-1">
                {data.results.length} فایل مناسب پیدا شد.
              </p>
            </div>
            <button
              type="button"
              className="btn p-2"
              onClick={() => {
                setData(null);
                setQuery("");
              }}
            >
              <RotateCcw size={16} /> جست‌وجوی تازه
            </button>
          </div>
          {data.results.length ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.results.map((item) => (
                <article
                  className="rounded-2xl border border-[#ece5dc] p-3 flex gap-3 bg-white"
                  key={item.id}
                >
                  <Image
                    className="w-24 h-24 rounded-xl object-cover property-img"
                    src={item.imageUrl}
                    width={96}
                    height={96}
                    alt=""
                    unoptimized={item.imageUrl.startsWith("/api/files/")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <Link
                        href={`/properties/${item.id}`}
                        className="font-black truncate hover:text-brick"
                      >
                        {item.title}
                      </Link>
                      <span className="badge badge-active shrink-0">
                        {item.score}٪
                      </span>
                    </div>
                    <p className="subtle text-xs mt-1">
                      <MapPin size={12} className="inline" />{" "}
                      {item.neighborhood} · {item.area} متر ·{" "}
                      {label(item.transactionType)}
                    </p>
                    <b className="block text-brick mt-2 text-sm">
                      {formatMoney(
                        item.priceTotal
                          ? BigInt(item.priceTotal)
                          : item.depositAmount
                            ? BigInt(item.depositAmount)
                            : null,
                      )}
                    </b>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.reasons.slice(0, 2).map((reason) => (
                        <span className="badge text-[10px]" key={reason}>
                          {reason}
                        </span>
                      ))}
                    </div>
                    <Link
                      className="text-brick font-bold text-xs block mt-2"
                      href={`/properties/${item.id}`}
                    >
                      مشاهده فایل <ArrowLeft className="inline" size={12} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              فایلی دقیقاً مطابق شرایط پیدا نشد؛ بخشی از محدودیت‌ها را کمتر
              کنید.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
