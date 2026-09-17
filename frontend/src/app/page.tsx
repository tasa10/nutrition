"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ApiError } from "@/lib/api";
import {
  type Day,
  type Slot,
  SLOTS,
  SLOT_HUE,
  SLOT_LABEL,
  SLOT_SHORT,
  SOURCE_LABEL,
  formatTime,
  getDay,
  getProfile,
  mealKcal,
  nf,
  todayISO,
} from "@/lib/nutrition";

type State =
  { phase: "loading" } | { phase: "ready"; day: Day } | { phase: "error"; message: string };

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getProfile();
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          router.replace("/onboarding/");
          return;
        }
        if (!cancelled)
          setState({ phase: "error", message: e instanceof Error ? e.message : "unknown error" });
        return;
      }
      try {
        const day = await getDay(todayISO());
        if (!cancelled) setState({ phase: "ready", day });
      } catch (e) {
        if (!cancelled)
          setState({ phase: "error", message: e instanceof Error ? e.message : "unknown error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.phase === "loading") {
    return (
      <AppShell mealsRecorded={0}>
        <p className="text-faint p-6">読み込み中...</p>
      </AppShell>
    );
  }
  if (state.phase === "error") {
    return (
      <AppShell mealsRecorded={0}>
        <p className="text-rose-text p-6">
          データを取得できませんでした（{state.message}
          ）。バックエンドが起動しているか確認してください。
        </p>
      </AppShell>
    );
  }

  const { day } = state;
  const target = day.target_kcal;
  const tot = day.totals;
  const remaining = Math.max(0, target - tot.kcal);
  const pct = target > 0 ? Math.min(100, Math.round((tot.kcal / target) * 100)) : 0;
  const mealOf = (slot: Slot) => day.meals.find((m) => m.slot === slot);

  const macros = [
    { label: "たんぱく質", val: tot.protein, goal: (target * 0.25) / 4, hue: 152 },
    { label: "脂質", val: tot.fat, goal: (target * 0.25) / 9, hue: 65 },
    { label: "炭水化物", val: tot.carbs, goal: (target * 0.5) / 4, hue: 240 },
  ];

  return (
    <AppShell mealsRecorded={day.meals.length}>
      <main className="flex flex-1 flex-col gap-4 px-[18px] pt-[18px] pb-[120px]">
        <section className="bg-card flex items-center gap-5 rounded-[28px] p-6 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
          <div
            className="flex h-[130px] w-[130px] flex-none items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-green) 0 ${pct}%, var(--color-track) 0)`,
            }}
          >
            <div className="bg-card flex h-[102px] w-[102px] flex-col items-center justify-center rounded-full">
              <div className="font-mono text-[27px] leading-[1.1] font-medium">{nf(remaining)}</div>
              <div className="text-faint text-[10px] tracking-[0.04em]">残りkcal</div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <div className="text-faint text-[11px]">摂取</div>
              <div className="font-mono text-[21px]">{nf(tot.kcal)}</div>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-faint text-[11px]">目標</div>
              <div className="font-mono text-[21px]">{nf(target)}</div>
            </div>
          </div>
        </section>

        <section className="bg-card flex flex-col gap-3.5 rounded-3xl p-5 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
          <div className="text-muted text-[13px] font-bold">PFCバランス</div>
          {macros.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="text-muted w-[66px] text-xs">{m.label}</div>
              <div className="bg-track h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${m.goal > 0 ? Math.min(100, (m.val / m.goal) * 100) : 0}%`,
                    background: `oklch(0.64 0.13 ${m.hue})`,
                  }}
                />
              </div>
              <div className="text-muted w-[62px] text-right font-mono text-xs">
                {Math.round(m.val)}g
              </div>
            </div>
          ))}
          <div className="border-line-soft flex gap-2 border-t pt-1.5">
            <div className="bg-chip flex flex-1 items-baseline justify-between rounded-xl px-3 py-2.5">
              <span className="text-faint text-[11px]">塩分</span>
              <span className="font-mono text-[13px]">{tot.salt.toFixed(1)} / 7.5g</span>
            </div>
            <div className="bg-chip flex flex-1 items-baseline justify-between rounded-xl px-3 py-2.5">
              <span className="text-faint text-[11px]">糖質</span>
              <span className="font-mono text-[13px]">{Math.round(tot.sugar)}g</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="text-muted pl-1 text-[13px] font-bold">今日の食事</div>
          {SLOTS.map((slot) => {
            const m = mealOf(slot);
            const href = m ? `/meals/edit/?slot=${slot}` : `/record/input/?slot=${slot}`;
            return (
              <Link
                key={slot}
                href={href}
                className={`flex items-center gap-[13px] rounded-[22px] px-4 py-[15px] ${
                  m
                    ? "bg-card shadow-[0_2px_12px_rgba(23,21,15,0.05)]"
                    : "border-[1.5px] border-dashed border-[#dcd5c9] bg-transparent"
                }`}
              >
                <div
                  className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl text-xs"
                  style={
                    m
                      ? {
                          background: `oklch(0.94 0.04 ${SLOT_HUE[slot]})`,
                          color: `oklch(0.44 0.1 ${SLOT_HUE[slot]})`,
                        }
                      : { background: "var(--color-track)", color: "var(--color-faint)" }
                  }
                >
                  {SLOT_SHORT[slot]}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="text-sm font-medium">
                    {m ? m.items.map((i) => i.name).join("、") : `${SLOT_LABEL[slot]}を記録する`}
                  </div>
                  <div className="text-faint text-[11px]">
                    {m
                      ? `${SOURCE_LABEL[m.source] ?? m.source} · ${formatTime(m.recorded_at)}`
                      : "タップして音声入力"}
                  </div>
                </div>
                {m ? (
                  <div className="font-mono text-[15px]">{nf(mealKcal(m))}</div>
                ) : (
                  <div className="bg-green flex h-7 w-7 items-center justify-center rounded-full text-base leading-none text-white">
                    +
                  </div>
                )}
              </Link>
            );
          })}
        </section>

        <div className="flex gap-2.5 pt-1">
          <Link
            href="/record/"
            className="bg-green flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white shadow-[0_8px_20px_oklch(0.62_0.15_152/0.28)]"
          >
            <span className="inline-block h-[13px] w-[9px] rounded-full bg-white" />
            音声で記録
          </Link>
          <div
            className="border-line bg-card flex min-h-[52px] flex-1 cursor-not-allowed items-center justify-center rounded-full border text-[15px] font-bold opacity-50"
            title="準備中"
          >
            AIに相談
          </div>
        </div>
      </main>
    </AppShell>
  );
}
