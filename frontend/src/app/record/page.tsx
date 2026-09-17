"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import SlotIcon from "@/components/SlotIcon";
import { type Day, SLOTS, SLOT_LABEL, getDay, mealKcal, nf, todayISO } from "@/lib/nutrition";

export default function RecordPage() {
  const [day, setDay] = useState<Day | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDay(todayISO())
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
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
                <SlotIcon slot={slot} size={34} />
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
          <Link
            href="/record/search/"
            className="border-line flex min-h-11 items-center gap-1.5 self-start rounded-full border px-5 text-[13px] font-medium"
          >
            <Search size={15} aria-hidden />
            食品を検索
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
