"use client";

import { Award } from "lucide-react";
import { useEffect, useState } from "react";
import AccountSection from "@/components/AccountSection";
import AppShell from "@/components/AppShell";
import {
  type Day,
  type History,
  type Stats,
  SLOTS,
  SLOT_LABEL,
  getDay,
  getHistory,
  getStats,
  mealKcal,
  nf,
  todayISO,
} from "@/lib/nutrition";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

type State =
  | { phase: "loading" }
  | { phase: "ready"; history: History; stats: Stats; day: Day }
  | { phase: "error"; message: string };

export default function HistoryPage() {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    const date = todayISO();
    Promise.all([getHistory(date, 7), getStats(date), getDay(date)])
      .then(([history, stats, day]) => {
        if (!cancelled) setState({ phase: "ready", history, stats, day });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ phase: "error", message: e instanceof Error ? e.message : "unknown error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <main className="flex flex-1 flex-col gap-[18px] px-[18px] pt-[22px] pb-[120px]">
        <h1 className="text-[25px] font-black">記録簿</h1>
        {state.phase === "loading" && <p className="text-faint">読み込み中...</p>}
        {state.phase === "error" && (
          <p className="text-rose-text">データを取得できませんでした（{state.message}）</p>
        )}
        {state.phase === "ready" && <HistoryBody {...state} />}
        <AccountSection />
      </main>
    </AppShell>
  );
}

function HistoryBody({ history, stats, day }: { history: History; stats: Stats; day: Day }) {
  const target = history.target_kcal;
  const recorded = history.days.filter((d) => d.meals > 0);
  const avg = recorded.length ? recorded.reduce((a, d) => a + d.kcal, 0) / recorded.length : 0;
  const maxKcal = Math.max(target * 1.2, ...history.days.map((d) => d.kcal), 1);
  const last = history.days.length - 1;

  return (
    <>
      <section className="bg-card flex flex-col gap-[18px] rounded-[26px] px-5 py-[22px] shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
        <div className="flex items-baseline justify-between">
          <div className="text-muted text-[13px] font-bold">この7日間（kcal）</div>
          <div className="text-faint font-mono text-xs">
            平均 {recorded.length ? nf(avg) : "—"} kcal
          </div>
        </div>
        <div className="flex h-[140px] items-end gap-2">
          {history.days.map((d, i) => {
            const over = target > 0 && d.kcal > target;
            return (
              <div
                key={d.date}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="text-faint font-mono text-[10px]">
                  {d.meals > 0 ? nf(d.kcal) : "—"}
                </div>
                <div
                  className={`w-full rounded-lg ${over ? "bg-amber" : "bg-green"}`}
                  style={{
                    height: `${Math.max(4, (d.kcal / maxKcal) * 100)}%`,
                    opacity: d.meals === 0 ? 0.2 : i === last ? 1 : 0.75,
                  }}
                />
                <div className="text-faint text-[11px]">
                  {i === last ? "今日" : WEEKDAY[new Date(`${d.date}T00:00:00`).getDay()]}
                </div>
              </div>
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
        </div>
      </section>

      <section className="bg-card flex flex-col gap-3.5 rounded-3xl p-5 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
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
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-white ${b.earned ? "bg-green" : "bg-[#e1dace]"}`}
              >
                <Award size={14} aria-hidden />
              </div>
              <div className="text-center text-[11px] leading-[1.4] font-medium">{b.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="text-muted pl-1 text-[13px] font-bold">今日の内訳</div>
        {day.meals.length === 0 && (
          <p className="text-faint pl-1 text-sm">まだ記録がありません。</p>
        )}
        {SLOTS.map((slot) => {
          const m = day.meals.find((x) => x.slot === slot);
          if (!m) return null;
          return (
            <div
              key={slot}
              className="bg-card flex flex-col gap-2.5 rounded-[20px] px-[18px] py-4 shadow-[0_2px_12px_rgba(23,21,15,0.05)]"
            >
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-bold">{SLOT_LABEL[slot]}</div>
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
            </div>
          );
        })}
      </section>
    </>
  );
}
