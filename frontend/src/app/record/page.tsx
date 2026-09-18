"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import QuestCard from "@/components/QuestCard";
import SlotIcon from "@/components/SlotIcon";
import Wordmark from "@/components/Wordmark";
import {
  type Day,
  type Stats,
  SLOTS,
  SLOT_LABEL,
  getDay,
  getStats,
  mealKcal,
  nf,
  todayISO,
} from "@/lib/nutrition";

export default function RecordPage() {
  const [day, setDay] = useState<Day | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const date = todayISO();
    getDay(date)
      .then((d) => {
        if (!cancelled) setDay(d);
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

        <QuestCard stats={stats} />

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
      </main>
    </AppShell>
  );
}
