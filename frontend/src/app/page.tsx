"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Mic, Plus, Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import DetailSheet from "@/components/DetailSheet";
import SlotIcon, { SLOT_FG } from "@/components/SlotIcon";
import Wordmark from "@/components/Wordmark";
import { ApiError } from "@/lib/api";
import {
  type Day,
  type Slot,
  SLOTS,
  SLOT_LABEL,
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

const SALT_LIMIT_G = 7.5;

const pctOf = (val: number, goal: number) => (goal > 0 ? Math.round((val / goal) * 100) : 0);

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [detail, setDetail] = useState<"kcal" | "pfc" | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

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
      <AppShell>
        <p className="text-faint p-6">読み込み中...</p>
      </AppShell>
    );
  }
  if (state.phase === "error") {
    return (
      <AppShell>
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
  const pct = Math.min(100, pctOf(tot.kcal, target));
  const mealOf = (slot: Slot) => day.meals.find((m) => m.slot === slot);

  const macros = [
    { label: "たんぱく質", val: tot.protein, share: 0.25, kcalPerG: 4, hue: 152 },
    { label: "脂質", val: tot.fat, share: 0.25, kcalPerG: 9, hue: 65 },
    { label: "炭水化物", val: tot.carbs, share: 0.5, kcalPerG: 4, hue: 240 },
  ].map((m) => {
    const goal = (target * m.share) / m.kcalPerG;
    return {
      ...m,
      goal,
      width: `${Math.min(100, pctOf(m.val, goal))}%`,
      color: `oklch(0.64 0.13 ${m.hue})`,
    };
  });

  const sheetCard = "bg-card shadow-card flex flex-col";

  return (
    <AppShell>
      <main className="flex flex-1 flex-col gap-4 px-[18px] pt-[18px] pb-[120px]">
        <div className="flex justify-center pt-1.5 pb-0.5">
          <Wordmark size="sm" />
        </div>

        <button
          type="button"
          onClick={() => setDetail("kcal")}
          aria-label="カロリーの内訳を見る"
          className="bg-card shadow-card flex items-center gap-5 rounded-[28px] p-6 text-left"
        >
          <div
            className="flex h-[130px] w-[130px] flex-none items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-green) 0 ${pct}%, var(--color-track) 0)`,
            }}
          >
            <div className="bg-surface flex h-[102px] w-[102px] flex-col items-center justify-center rounded-full">
              <div className="font-mono text-[27px] leading-[1.1] font-medium">{nf(remaining)}</div>
              <div className="text-faint text-[10px] tracking-[0.04em]">残りkcal</div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <div className="text-faint text-[11px]">摂取</div>
              <div className="font-mono text-[21px]">
                {nf(tot.kcal)}
                <span className="text-faint text-xs"> kcal</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-faint text-[11px]">目標</div>
              <div className="font-mono text-[21px]">
                {nf(target)}
                <span className="text-faint text-xs"> kcal</span>
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDetail("pfc")}
          aria-label="PFCバランスの内訳を見る"
          className="bg-card shadow-card flex flex-col gap-3.5 rounded-3xl p-5 text-left"
        >
          <div className="text-muted text-[13px] font-bold">PFCバランス</div>
          {macros.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="text-muted w-[66px] text-xs">{m.label}</div>
              <div className="bg-line h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{ width: m.width, background: m.color }}
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
              <span className="font-mono text-[13px]">
                {tot.salt.toFixed(1)} / {SALT_LIMIT_G}g
              </span>
            </div>
            <div className="bg-chip flex flex-1 items-baseline justify-between rounded-xl px-3 py-2.5">
              <span className="text-faint text-[11px]">糖質</span>
              <span className="font-mono text-[13px]">{Math.round(tot.sugar)}g</span>
            </div>
          </div>
        </button>

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
                    ? "bg-card shadow-card"
                    : "border-track border-[1.5px] border-dashed bg-transparent"
                }`}
              >
                <SlotIcon slot={slot} active={!!m} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="text-sm font-medium text-pretty">
                    {m ? m.items.map((i) => i.name).join("、") : `${SLOT_LABEL[slot]}を記録する`}
                  </div>
                  {m && (
                    <div className="text-faint text-[11px]">
                      {SOURCE_LABEL[m.source] ?? m.source} · {formatTime(m.recorded_at)}
                    </div>
                  )}
                </div>
                {m?.photo && (
                  <div
                    className="h-11 w-11 flex-none rounded-xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${m.photo})` }}
                  />
                )}
                {m ? (
                  <div className="font-mono text-[15px]">
                    {nf(mealKcal(m))}
                    <span className="text-faint text-[11px]"> kcal</span>
                  </div>
                ) : (
                  <div className="bg-green flex h-7 w-7 items-center justify-center rounded-full text-white">
                    <Plus size={16} aria-hidden />
                  </div>
                )}
              </Link>
            );
          })}
        </section>

        <div className="flex gap-2.5 pt-1">
          <Link
            href="/record/"
            className="bg-green shadow-cta flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white"
          >
            <Mic size={18} aria-hidden />
            音声で記録
          </Link>
          <Link
            href="/chat/"
            className="bg-surface shadow-card flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-bold"
          >
            <Sparkles size={18} className="text-green" aria-hidden />
            AIに相談
          </Link>
        </div>
      </main>

      {detail === "kcal" && (
        <DetailSheet title="カロリー" subtitle="今日の内訳" onClose={closeDetail}>
          <section className={`${sheetCard} gap-3.5 rounded-[26px] p-[22px]`}>
            <div className="flex items-baseline justify-between">
              <div className="text-muted text-[13px]">摂取 / 目標</div>
              <div className="font-mono text-[26px] font-medium">
                {nf(tot.kcal)}
                <span className="text-faint text-[13px]"> / {nf(target)} kcal</span>
              </div>
            </div>
            <div className="bg-track h-3 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${tot.kcal > target ? "bg-amber" : "bg-green"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-muted flex justify-between text-xs">
              <span>残り {nf(remaining)} kcal</span>
              <span>目標の {pctOf(tot.kcal, target)}%</span>
            </div>
          </section>
          <section className="flex flex-col gap-2.5">
            <div className="text-muted pl-1 text-[13px] font-bold">食事ごとの内訳</div>
            {day.meals.length === 0 && (
              <p className="text-faint pl-1 text-sm">まだ記録がありません。</p>
            )}
            {SLOTS.map((slot) => {
              const m = mealOf(slot);
              if (!m) return null;
              return (
                <div key={slot} className={`${sheetCard} gap-2.5 rounded-[20px] px-4 py-3.5`}>
                  <div className="flex items-center gap-3">
                    <SlotIcon slot={slot} size={32} />
                    <div className="flex-1 text-sm font-bold">{SLOT_LABEL[slot]}</div>
                    <div className="font-mono text-[15px]">
                      {nf(mealKcal(m))}
                      <span className="text-faint text-[11px]"> kcal</span>
                    </div>
                  </div>
                  <div className="bg-track h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, pctOf(mealKcal(m), target))}%`,
                        background: SLOT_FG[slot],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        </DetailSheet>
      )}

      {detail === "pfc" && (
        <DetailSheet title="PFCバランス" subtitle="今日の内訳" onClose={closeDetail}>
          <section className="flex flex-col gap-2.5">
            {macros.map((m) => (
              <div key={m.label} className={`${sheetCard} gap-3 rounded-[22px] px-5 py-[18px]`}>
                <div className="flex items-baseline justify-between">
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-bold">{m.label}</div>
                    <div className="text-faint text-[11px]">
                      目標の{Math.round(m.share * 100)}%を{m.label}から
                    </div>
                  </div>
                  <div className="font-mono text-[22px] font-medium">
                    {Math.round(m.val)}g
                    <span className="text-faint text-xs"> / {Math.round(m.goal)}g</span>
                  </div>
                </div>
                <div className="bg-track h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{ width: m.width, background: m.color }}
                  />
                </div>
                <div className="text-muted flex justify-between text-xs">
                  <span>目標の {pctOf(m.val, m.goal)}%</span>
                  <span>{nf(m.val * m.kcalPerG)} kcal分</span>
                </div>
              </div>
            ))}
          </section>
          <section className={`${sheetCard} gap-3 rounded-[22px] px-5 py-[18px]`}>
            <div className="text-muted text-[13px] font-bold">そのほか</div>
            <div className="flex justify-between text-sm">
              <span>塩分</span>
              <span className="font-mono">
                {tot.salt.toFixed(1)} / {SALT_LIMIT_G}g
              </span>
            </div>
            <div className="bg-track h-1.5 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${tot.salt > SALT_LIMIT_G ? "bg-amber" : "bg-green"}`}
                style={{ width: `${Math.min(100, pctOf(tot.salt, SALT_LIMIT_G))}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>糖質</span>
              <span className="font-mono">{Math.round(tot.sugar)}g</span>
            </div>
          </section>
        </DetailSheet>
      )}
    </AppShell>
  );
}
