"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import {
  type Day,
  SLOTS,
  SLOT_HUE,
  SLOT_LABEL,
  getDay,
  mealKcal,
  nf,
  todayISO,
} from "@/lib/nutrition";

export default function RecordPage() {
  const [day, setDay] = useState<Day | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDay(todayISO())
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch(() => {
        if (!cancelled)
          setDay({
            date: todayISO(),
            target_kcal: 0,
            totals: { kcal: 0, protein: 0, fat: 0, carbs: 0, salt: 0, sugar: 0 },
            meals: [],
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell mealsRecorded={day?.meals.length ?? 0}>
      <main className="flex flex-1 flex-col gap-5 px-[18px] pt-[22px] pb-[120px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[25px] font-black">なに食べた？</h1>
          <p className="text-faint text-[13px]">区分をえらぶと音声入力がはじまります</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SLOTS.map((slot) => {
            const m = day?.meals.find((x) => x.slot === slot);
            return (
              <Link
                key={slot}
                href={`/record/input/?slot=${slot}`}
                className="bg-card text-ink flex flex-col gap-2.5 rounded-3xl px-[18px] py-[22px] shadow-[0_2px_12px_rgba(23,21,15,0.05)]"
              >
                <div
                  className="h-[34px] w-[34px] rounded-[10px]"
                  style={{ background: `oklch(0.93 0.05 ${SLOT_HUE[slot]})` }}
                />
                <div className="text-lg font-bold">{SLOT_LABEL[slot]}</div>
                <div className={`font-mono text-xs ${m ? "text-green-deep" : "text-faint"}`}>
                  {m ? `記録済 ${nf(mealKcal(m))}kcal` : "未記録 · タップ"}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="bg-card flex flex-col gap-2.5 rounded-[22px] p-[18px] shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
          <div className="text-sm font-bold">手で探して追加</div>
          <p className="text-muted text-xs leading-[1.7]">
            よく食べるものはお気に入りからワンタップ。
          </p>
          <div
            className="border-line flex min-h-11 cursor-not-allowed items-center self-start rounded-full border px-5 text-[13px] font-medium opacity-50"
            title="準備中"
          >
            食品を検索
          </div>
        </div>
      </main>
    </AppShell>
  );
}
