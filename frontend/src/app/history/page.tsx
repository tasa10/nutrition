"use client";

import { Award, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AccountSection from "@/components/AccountSection";
import AppShell from "@/components/AppShell";
import QuestCard from "@/components/QuestCard";
import SlotIcon from "@/components/SlotIcon";
import Wordmark from "@/components/Wordmark";
import {
  type Day,
  type History,
  type Stats,
  SLOTS,
  SLOT_LABEL,
  SOURCE_LABEL,
  addDays,
  formatDateJP,
  formatMonthDay,
  formatTime,
  getDay,
  getHistory,
  getStats,
  isISODate,
  mealKcal,
  nf,
  todayISO,
  weekdayJP,
} from "@/lib/nutrition";

const WINDOW_DAYS = 7;

function HistoryScreen({ initialDate }: { initialDate: string }) {
  const today = todayISO();
  const [selected, setSelected] = useState(initialDate);
  // Last day of the 7-day chart window; moves in whole weeks, never past today.
  const [windowEnd, setWindowEnd] = useState(initialDate > today ? today : initialDate);
  const [history, setHistory] = useState<History | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStats(today)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    getHistory(windowEnd, WINDOW_DAYS)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [windowEnd]);

  useEffect(() => {
    let cancelled = false;
    getDay(selected)
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function shiftWindow(weeks: number) {
    const next = addDays(windowEnd, weeks * WINDOW_DAYS);
    const end = next > today ? today : next;
    setWindowEnd(end);
    setSelected(end);
  }

  function jumpToToday() {
    setWindowEnd(today);
    setSelected(today);
  }

  const windowStart = addDays(windowEnd, -(WINDOW_DAYS - 1));
  const canGoForward = windowEnd < today;
  const target = history?.target_kcal ?? 0;
  const recorded = history?.days.filter((d) => d.meals > 0) ?? [];
  const avg = recorded.length ? recorded.reduce((a, d) => a + d.kcal, 0) / recorded.length : 0;
  const maxKcal = Math.max(target * 1.2, ...(history?.days.map((d) => d.kcal) ?? []), 1);

  return (
    <main className="flex flex-1 flex-col gap-[18px] px-[18px] pt-[22px] pb-[120px]">
      <div className="relative flex justify-center">
        <Wordmark size="sm" />
        {selected !== today && (
          <button
            type="button"
            onClick={jumpToToday}
            className="text-green-text absolute top-1/2 right-0 -translate-y-1/2 text-xs underline"
          >
            今日へ
          </button>
        )}
      </div>

      {error && <p className="text-rose-text text-sm">データを取得できませんでした（{error}）</p>}

      <section className="bg-card shadow-card flex flex-col gap-[18px] rounded-[26px] px-5 py-[22px]">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftWindow(-1)}
            className="bg-chip text-muted flex h-9 w-9 items-center justify-center rounded-full"
            aria-label="前の7日間"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="flex flex-col items-center">
            <div className="text-muted text-[13px] font-bold">
              {formatMonthDay(windowStart)} – {formatMonthDay(windowEnd)}（kcal）
            </div>
            <div className="text-faint font-mono text-xs">
              平均 {recorded.length ? nf(avg) : "—"} kcal
            </div>
          </div>
          <button
            type="button"
            onClick={() => shiftWindow(1)}
            disabled={!canGoForward}
            className="bg-chip text-muted flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"
            aria-label="次の7日間"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="flex h-[150px] items-end gap-2">
          {(history?.days ?? []).map((d) => {
            const over = target > 0 && d.kcal > target;
            const isSelected = d.date === selected;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelected(d.date)}
                aria-pressed={isSelected}
                aria-label={`${formatDateJP(d.date)} ${d.meals > 0 ? `${nf(d.kcal)} kcal` : "記録なし"}`}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div className={`font-mono text-[10px] ${isSelected ? "text-ink" : "text-faint"}`}>
                  {d.meals > 0 ? nf(d.kcal) : "—"}
                </div>
                <div
                  className={`w-full rounded-lg ${over ? "bg-amber" : "bg-green"} ${
                    isSelected ? "shadow-[0_0_0_1px_#fff,0_0_0_3px_rgba(23,21,15,0.7)]" : ""
                  }`}
                  style={{
                    height: `${Math.max(4, (d.kcal / maxKcal) * 100)}%`,
                    opacity: d.meals === 0 ? 0.2 : isSelected ? 1 : 0.6,
                  }}
                />
                <div className={`text-[11px] ${isSelected ? "text-ink font-bold" : "text-faint"}`}>
                  {d.date === today ? "今日" : weekdayJP(d.date)}
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-faint flex gap-3.5 text-[11px]">
          <div className="flex items-center gap-[5px]">
            <span className="bg-green inline-block h-[9px] w-[9px] rounded-[3px]" />
            目標内
          </div>
          <div className="flex items-center gap-[5px]">
            <span className="bg-amber inline-block h-[9px] w-[9px] rounded-[3px]" />
            超過
          </div>
          <div className="ml-auto">棒をタップで日を選択</div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between pl-1">
          <div className="text-muted text-[13px] font-bold">
            {selected === today ? "今日" : formatDateJP(selected)}の内訳
          </div>
          {day && day.meals.length > 0 && (
            <div className="text-faint font-mono text-xs">
              {nf(day.totals.kcal)}
              {day.target_kcal > 0 ? ` / ${nf(day.target_kcal)}` : ""} kcal
            </div>
          )}
        </div>
        {day === null && <p className="text-faint pl-1 text-sm">読み込み中...</p>}
        {day && day.meals.length === 0 && (
          <p className="text-faint pl-1 text-sm">この日の記録はありません。</p>
        )}
        {day &&
          SLOTS.map((slot) => {
            const m = day.meals.find((x) => x.slot === slot);
            if (!m) return null;
            return (
              <Link
                key={slot}
                href={`/meals/edit/?slot=${slot}&date=${selected}`}
                className="bg-card text-ink shadow-card flex flex-col gap-2.5 rounded-[20px] px-[18px] py-4"
              >
                <div className="flex items-center gap-3">
                  <SlotIcon slot={slot} size={32} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="text-sm font-bold">{SLOT_LABEL[slot]}</div>
                    <div className="text-faint text-[11px]">
                      {SOURCE_LABEL[m.source] ?? m.source} · {formatTime(m.recorded_at)}
                    </div>
                  </div>
                  {m.photo && (
                    <div
                      className="h-10 w-10 flex-none rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${m.photo})` }}
                    />
                  )}
                  <div className="font-mono text-[15px]">
                    {nf(mealKcal(m))}
                    <span className="text-faint text-[11px]"> kcal</span>
                  </div>
                </div>
                {m.items.map((it, i) => (
                  <div key={i} className="text-muted flex justify-between gap-2.5 text-xs">
                    <span>{it.name}</span>
                    <span className="text-faint font-mono">{nf(it.kcal)} kcal</span>
                  </div>
                ))}
              </Link>
            );
          })}
      </section>

      <QuestCard stats={stats} />

      {stats && (
        <section className="bg-card shadow-card flex flex-col gap-3.5 rounded-3xl p-5">
          <div className="text-muted text-[13px] font-bold">実績バッジ</div>
          <div className="grid grid-cols-3 gap-2.5">
            {stats.badges.map((b) => (
              <div
                key={b.key}
                className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-3.5 ${
                  b.earned ? "bg-green-soft text-green-deep" : "bg-chip text-dim"
                }`}
              >
                <div
                  className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-white ${
                    b.earned ? "bg-green" : "bg-track"
                  }`}
                >
                  <Award size={14} aria-hidden />
                </div>
                <div className="text-center text-[11px] leading-[1.4] font-medium">{b.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AccountSection />
    </main>
  );
}

function HistoryPageInner() {
  const params = useSearchParams();
  const dateParam = params.get("date");
  return <HistoryScreen initialDate={isISODate(dateParam) ? dateParam : todayISO()} />;
}

export default function HistoryPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <HistoryPageInner />
      </Suspense>
    </AppShell>
  );
}
