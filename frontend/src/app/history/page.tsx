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
  addMonths,
  daysInMonth,
  formatDateJP,
  formatMonthDay,
  formatMonthJP,
  formatTime,
  getBudget,
  getDay,
  getHistory,
  getStats,
  isISODate,
  mealKcal,
  monthEnd,
  monthOf,
  nf,
  todayISO,
  weekdayJP,
  yen,
} from "@/lib/nutrition";

const WEEK_DAYS = 7;

type Metric = "kcal" | "cost";
type Range = "week" | "month";

const segment = (on: boolean, small = false) =>
  `flex flex-1 items-center justify-center rounded-[11px] text-[13px] font-medium ${small ? "min-h-8" : "min-h-9"} ${
    on ? "bg-surface text-ink shadow-[0_1px_4px_rgba(23,21,15,0.08)]" : "text-muted"
  }`;

function HistoryScreen({ initialDate }: { initialDate: string }) {
  const today = todayISO();
  const start = initialDate > today ? today : initialDate;
  const [metric, setMetric] = useState<Metric>("kcal");
  const [range, setRange] = useState<Range>("week");
  const [selected, setSelected] = useState(start);
  // Week view: last day of the 7-day window; moves in whole weeks, never past today.
  const [windowEnd, setWindowEnd] = useState(start);
  // Month view: the calendar month shown, never past the current month.
  const [month, setMonth] = useState(monthOf(start));
  const [history, setHistory] = useState<History | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStats(today)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    getBudget(monthOf(today))
      .then((b) => {
        if (!cancelled) setMonthlyBudget(b.monthly_budget);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [today]);

  const chartTo = range === "week" ? windowEnd : monthEnd(month);
  const chartDays = range === "week" ? WEEK_DAYS : daysInMonth(month);

  useEffect(() => {
    let cancelled = false;
    getHistory(chartTo, chartDays)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [chartTo, chartDays]);

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

  function shift(step: number) {
    if (range === "week") {
      const next = addDays(windowEnd, step * WEEK_DAYS);
      const end = next > today ? today : next;
      setWindowEnd(end);
      setSelected(end);
      return;
    }
    const next = addMonths(month, step);
    if (next > monthOf(today)) return;
    setMonth(next);
    setSelected(next === monthOf(today) ? today : monthEnd(next));
  }

  // Keeps the selected day in view when switching between the week and the month chart.
  function changeRange(next: Range) {
    if (next === range) return;
    if (next === "month") setMonth(monthOf(selected));
    else setWindowEnd(selected);
    setRange(next);
  }

  function jumpToToday() {
    setWindowEnd(today);
    setMonth(monthOf(today));
    setSelected(today);
  }

  const canGoForward = range === "week" ? windowEnd < today : month < monthOf(today);
  const rangeLabel =
    range === "week"
      ? `${formatMonthDay(addDays(windowEnd, -(WEEK_DAYS - 1)))} – ${formatMonthDay(windowEnd)}`
      : formatMonthJP(month);

  const days = history?.days ?? [];
  const isCost = metric === "cost";
  const valueOf = (d: { kcal: number; cost: number }) => (isCost ? d.cost : d.kcal);
  // Calories compare against the daily target; spending against an even daily share of the budget.
  const dailyLimit = isCost
    ? monthlyBudget > 0
      ? monthlyBudget / daysInMonth(range === "month" ? month : monthOf(selected))
      : 0
    : (history?.target_kcal ?? 0);
  const maxValue = Math.max(dailyLimit * 1.2, ...days.map(valueOf), 1);

  const recorded = days.filter((d) => d.meals > 0);
  const avgKcal = recorded.length ? recorded.reduce((a, d) => a + d.kcal, 0) / recorded.length : 0;
  const totalCost = days.reduce((a, d) => a + d.cost, 0);
  const elapsedDays = days.filter((d) => d.date <= today).length;
  const summary = isCost
    ? `合計 ${yen(totalCost)} · 1日平均 ${yen(totalCost / Math.max(1, elapsedDays))}`
    : `平均 ${recorded.length ? nf(avgKcal) : "—"} kcal`;
  const budgetNote =
    isCost && range === "month" && monthlyBudget > 0
      ? `予算 ${yen(monthlyBudget)} の ${Math.round((totalCost / monthlyBudget) * 100)}%`
      : null;

  const compact = range === "month";
  const dayCost = day ? day.meals.reduce((a, m) => a + m.cost, 0) : 0;

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

      <section className="bg-card shadow-card flex flex-col gap-4 rounded-[26px] px-5 py-5">
        <div className="bg-chip flex rounded-[14px] p-1" role="tablist" aria-label="グラフの内容">
          {(
            [
              ["kcal", "カロリー"],
              ["cost", "食費"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={metric === key}
              onClick={() => setMetric(key)}
              className={segment(metric === key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="bg-chip text-muted flex h-9 w-9 flex-none items-center justify-center rounded-full"
            aria-label={range === "week" ? "前の7日間" : "前の月"}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="text-muted text-[13px] font-bold">
              {rangeLabel}（{isCost ? "円" : "kcal"}）
            </div>
            <div className="text-faint font-mono text-xs">{summary}</div>
            {budgetNote && <div className="text-amber-text font-mono text-xs">{budgetNote}</div>}
          </div>
          <button
            type="button"
            onClick={() => shift(1)}
            disabled={!canGoForward}
            className="bg-chip text-muted flex h-9 w-9 flex-none items-center justify-center rounded-full disabled:opacity-30"
            aria-label={range === "week" ? "次の7日間" : "次の月"}
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className={`flex h-[150px] items-end ${compact ? "gap-[3px]" : "gap-2"}`}>
          {days.map((d) => {
            const value = valueOf(d);
            const has = isCost ? d.cost > 0 : d.meals > 0;
            const over = dailyLimit > 0 && value > dailyLimit;
            const isSelected = d.date === selected;
            const future = d.date > today;
            const dom = Number(d.date.slice(8, 10));
            const shown = has ? (isCost ? yen(value) : `${nf(value)} kcal`) : "記録なし";
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelected(d.date)}
                disabled={future}
                aria-pressed={isSelected}
                aria-label={`${formatDateJP(d.date)} ${shown}`}
                className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end ${
                  compact ? "gap-1.5" : "gap-2"
                }`}
              >
                {!compact && (
                  <div
                    className={`font-mono text-[10px] ${isSelected ? "text-ink" : "text-faint"}`}
                  >
                    {has ? nf(value) : "—"}
                  </div>
                )}
                <div
                  className={`w-full ${compact ? "rounded-[3px]" : "rounded-lg"} ${
                    over ? (isCost ? "bg-rose-text" : "bg-amber") : isCost ? "bg-amber" : "bg-green"
                  } ${
                    isSelected
                      ? compact
                        ? "shadow-[0_0_0_1px_#fff,0_0_0_2px_rgba(23,21,15,0.7)]"
                        : "shadow-[0_0_0_1px_#fff,0_0_0_3px_rgba(23,21,15,0.7)]"
                      : ""
                  }`}
                  style={{
                    height: `${Math.max(compact ? 2 : 4, (value / maxValue) * 100)}%`,
                    opacity: !has ? 0.2 : isSelected ? 1 : 0.6,
                  }}
                />
                {compact ? (
                  // Thirty labels do not fit; mark the 1st and every 5th day.
                  <div
                    className={`h-3 text-[9px] ${isSelected ? "text-ink font-bold" : "text-faint"}`}
                  >
                    {dom === 1 || dom % 5 === 0 || isSelected ? dom : ""}
                  </div>
                ) : (
                  <div
                    className={`text-[11px] ${isSelected ? "text-ink font-bold" : "text-faint"}`}
                  >
                    {d.date === today ? "今日" : weekdayJP(d.date)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-faint flex flex-1 flex-wrap gap-x-3.5 gap-y-1 text-[11px]">
            {isCost ? (
              <>
                <div className="flex items-center gap-[5px]">
                  <span className="bg-amber inline-block h-[9px] w-[9px] rounded-[3px]" />
                  食費
                </div>
                {monthlyBudget > 0 && (
                  <div className="flex items-center gap-[5px]">
                    <span className="bg-rose-text inline-block h-[9px] w-[9px] rounded-[3px]" />
                    1日の目安（{yen(dailyLimit)}）超え
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-[5px]">
                  <span className="bg-green inline-block h-[9px] w-[9px] rounded-[3px]" />
                  目標内
                </div>
                <div className="flex items-center gap-[5px]">
                  <span className="bg-amber inline-block h-[9px] w-[9px] rounded-[3px]" />
                  超過
                </div>
              </>
            )}
          </div>
          <div className="bg-chip flex w-[92px] flex-none rounded-[14px] p-1" aria-label="期間">
            {(
              [
                ["week", "週"],
                ["month", "月"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={range === key}
                onClick={() => changeRange(key)}
                className={segment(range === key, true)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between pl-1">
          <div className="text-muted text-[13px] font-bold">
            {selected === today ? "今日" : formatDateJP(selected)}の内訳
          </div>
          {day && day.meals.length > 0 && (
            <div className="text-faint font-mono text-xs">
              {isCost
                ? yen(dayCost)
                : `${nf(day.totals.kcal)}${day.target_kcal > 0 ? ` / ${nf(day.target_kcal)}` : ""} kcal`}
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
                  <div className="flex flex-col items-end">
                    <div className="font-mono text-[15px]">
                      {nf(mealKcal(m))}
                      <span className="text-faint text-[11px]"> kcal</span>
                    </div>
                    <div className="text-amber-text font-mono text-xs">
                      {m.cost > 0 ? yen(m.cost) : "¥ —"}
                    </div>
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
