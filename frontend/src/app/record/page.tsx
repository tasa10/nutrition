"use client";

import { ChevronRight, CreditCard, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import BudgetSheet from "@/components/BudgetSheet";
import QuestCard from "@/components/QuestCard";
import SlotIcon from "@/components/SlotIcon";
import Wordmark from "@/components/Wordmark";
import {
  type Budget,
  type Day,
  type Stats,
  SLOTS,
  SLOT_LABEL,
  getBudget,
  getDay,
  getStats,
  mealKcal,
  monthOf,
  nf,
  todayISO,
  yen,
} from "@/lib/nutrition";

export default function RecordPage() {
  const [day, setDay] = useState<Day | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const closeBudget = useCallback(() => setBudgetOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    const date = todayISO();
    getDay(date)
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch(() => {});
    getBudget(monthOf(date))
      .then((b) => {
        if (!cancelled) setBudget(b);
      })
      .catch(() => {});
    getStats(date)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const limit = budget?.monthly_budget ?? 0;
  const spentPct = budget && limit > 0 ? Math.round((budget.spent / limit) * 100) : 0;

  return (
    <AppShell>
      <main className="flex flex-1 flex-col gap-5 px-[18px] pt-[22px] pb-[120px]">
        <div className="flex flex-col items-center gap-2 text-center">
          <Wordmark size="sm" />
          <p className="text-faint text-[13px]">区分をえらぶと音声入力がはじまります</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SLOTS.map((slot) => {
            const m = day?.meals.find((x) => x.slot === slot);
            return (
              <Link
                key={slot}
                href={`/record/input/?slot=${slot}`}
                className="bg-card text-ink shadow-card flex flex-col items-center gap-2.5 rounded-3xl px-[18px] py-[22px] text-center"
              >
                <SlotIcon slot={slot} size={44} />
                <div className="text-lg font-bold">{SLOT_LABEL[slot]}</div>
                {/* Keeps the four cards the same height whether or not the slot is recorded. */}
                <div className="text-green-deep min-h-4 font-mono text-xs">
                  {m ? `記録済 ${nf(mealKcal(m))}kcal` : ""}
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          href="/record/search/"
          className="bg-card text-ink shadow-card flex items-center gap-3.5 rounded-[22px] px-[18px] py-4"
        >
          <div className="bg-green-soft text-green-deep flex h-11 w-11 flex-none items-center justify-center rounded-xl">
            <Search size={22} aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="text-sm font-bold">手動で追加</div>
            <div className="text-muted text-xs leading-[1.6]">
              食品を検索、またはよく食べるものからワンタップ
            </div>
          </div>
          <ChevronRight size={18} className="text-faint flex-none" aria-hidden />
        </Link>

        {budget && (
          <button
            type="button"
            onClick={() => setBudgetOpen(true)}
            aria-label="食費管理の内訳を見る"
            className="bg-card shadow-card flex flex-col gap-3 rounded-[22px] px-[18px] py-4 text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-amber-soft text-amber-text flex h-11 w-11 flex-none items-center justify-center rounded-xl">
                <CreditCard size={22} aria-hidden />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="text-sm font-bold">食費管理</div>
                <div className="text-muted text-xs">今月の食費</div>
              </div>
              <div className="font-mono text-lg font-medium">
                {yen(budget.spent)}
                {limit > 0 && <span className="text-faint text-[11px]"> / {yen(limit)}</span>}
              </div>
            </div>
            {limit > 0 ? (
              <>
                <div className="bg-track h-2 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${budget.spent > limit ? "bg-rose-text" : "bg-amber"}`}
                    style={{ width: `${Math.min(100, spentPct)}%` }}
                  />
                </div>
                <div className="text-muted flex justify-between text-xs">
                  <span>
                    {budget.spent <= limit
                      ? `残り ${yen(limit - budget.spent)}`
                      : `${yen(budget.spent - limit)} オーバー`}
                  </span>
                  <span>予算の {spentPct}%</span>
                </div>
              </>
            ) : (
              <div className="text-green-text text-xs underline">月の予算を設定する</div>
            )}
          </button>
        )}

        <QuestCard stats={stats} />
      </main>

      {budget && budgetOpen && (
        <BudgetSheet
          budget={budget}
          onClose={closeBudget}
          onBudgetSaved={(monthly_budget) => setBudget({ ...budget, monthly_budget })}
        />
      )}
    </AppShell>
  );
}
