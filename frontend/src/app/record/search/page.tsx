"use client";

import { ArrowLeft, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, Suspense, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  type MealItem,
  type Slot,
  SLOTS,
  SLOT_LABEL,
  appendToMeal,
  getFrequentFoods,
  isSlot,
  nf,
  searchFoods,
  slotForNow,
  todayISO,
} from "@/lib/nutrition";

// Shown until the user has history of their own.
const STARTER_FOODS: MealItem[] = [
  {
    name: "サラダチキン プレーン",
    detail: "1袋 110g",
    kcal: 114,
    protein: 24,
    fat: 1.5,
    carbs: 0.3,
    salt: 1.1,
    sugar: 0.3,
    confidence: "high",
  },
  {
    name: "納豆ごはん",
    detail: "ごはん150g+納豆1P",
    kcal: 336,
    protein: 12,
    fat: 5,
    carbs: 60,
    salt: 0.8,
    sugar: 58,
    confidence: "high",
  },
  {
    name: "おにぎり (鮭)",
    detail: "1個 110g",
    kcal: 180,
    protein: 5,
    fat: 1.4,
    carbs: 37,
    salt: 1.2,
    sugar: 36,
    confidence: "high",
  },
  {
    name: "ブラックコーヒー",
    detail: "Mサイズ",
    kcal: 8,
    protein: 0.3,
    fat: 0,
    carbs: 1.4,
    salt: 0,
    sugar: 0,
    confidence: "high",
  },
];

function SearchScreen({ initialSlot }: { initialSlot: Slot }) {
  const router = useRouter();
  const [slot, setSlot] = useState<Slot>(initialSlot);
  const [query, setQuery] = useState("");
  const [searchedFor, setSearchedFor] = useState("");
  const [results, setResults] = useState<MealItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [frequent, setFrequent] = useState<MealItem[] | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFrequentFoods()
      .then((items) => {
        if (!cancelled) setFrequent(items.length > 0 ? items : STARTER_FOODS);
      })
      .catch(() => {
        if (!cancelled) setFrequent(STARTER_FOODS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchFoods(q));
      setSearchedFor(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSearching(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void runSearch();
    }
  }

  async function add(item: MealItem, idx: number) {
    if (adding !== null) return;
    setAdding(idx);
    setError(null);
    try {
      await appendToMeal(todayISO(), slot, "manual", [item]);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setAdding(null);
    }
  }

  const heading = searching ? "検索中…" : results ? `「${searchedFor}」の候補` : "よく食べるもの";
  const list = results ?? frequent ?? [];

  return (
    <main className="flex flex-1 flex-col gap-[18px] px-[18px] pt-[22px] pb-[120px]">
      <div className="flex items-center gap-3">
        <Link
          href="/record/"
          className="border-line bg-card text-ink flex h-11 w-11 flex-none items-center justify-center rounded-full border shadow-[0_2px_8px_rgba(23,21,15,0.06)]"
          aria-label="戻る"
        >
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="text-[25px] font-black">食品をさがす</h1>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="例：サラダチキン"
          maxLength={100}
          className="border-line bg-card text-ink focus:border-green min-h-12 min-w-0 flex-1 rounded-2xl border px-3.5 text-[15px] outline-none"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching || !query.trim()}
          className="bg-green flex min-h-12 items-center gap-1.5 rounded-2xl px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          <Search size={16} aria-hidden />
          検索
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-faint text-xs">追加先</span>
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            className={`min-h-9 rounded-full px-3.5 text-xs font-medium ${
              s === slot ? "bg-green text-white" : "border-line bg-card text-muted border"
            }`}
          >
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <p className="text-rose-text text-sm">失敗しました（{error}）</p>}

      <section className="flex flex-col gap-2.5">
        <div className="text-muted pl-1 text-[13px] font-bold">{heading}</div>
        {frequent === null && !results && <p className="text-faint pl-1 text-sm">読み込み中...</p>}
        {results && results.length === 0 && (
          <p className="text-faint pl-1 text-sm">候補が見つかりませんでした。</p>
        )}
        {list.map((r, idx) => (
          <div
            key={`${r.name}-${idx}`}
            className="bg-card flex items-center gap-3 rounded-[20px] px-4 py-3.5 shadow-[0_2px_12px_rgba(23,21,15,0.05)]"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-faint text-[11px]">{r.detail}</div>
            </div>
            <div className="font-mono text-sm">
              {nf(r.kcal)}
              <span className="text-faint text-[11px]"> kcal</span>
            </div>
            <button
              type="button"
              onClick={() => add(r, idx)}
              disabled={adding !== null}
              className="bg-green-soft text-green-deep flex h-11 w-11 flex-none items-center justify-center rounded-full text-xl disabled:opacity-40"
              aria-label={`${r.name}を${SLOT_LABEL[slot]}に追加`}
            >
              {adding === idx ? "…" : <Plus size={20} aria-hidden />}
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

function SearchPageInner() {
  const params = useSearchParams();
  const slotParam = params.get("slot");
  return <SearchScreen initialSlot={isSlot(slotParam) ? slotParam : slotForNow()} />;
}

export default function SearchPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <SearchPageInner />
      </Suspense>
    </AppShell>
  );
}
