"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Wordmark from "@/components/Wordmark";
import { nf, previewTarget, putProfile } from "@/lib/nutrition";

const ACTIVITY = ["ふつう", "活動的", "よく動く"];

export default function OnboardingPage() {
  const router = useRouter();
  const [wNow, setWNow] = useState(68);
  const [wGoal, setWGoal] = useState(62);
  const [act, setAct] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = previewTarget(wNow, wGoal, act);
  const valid = wNow > 0 && wGoal > 0;

  async function start() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await putProfile({ weight_now: wNow, weight_goal: wGoal, activity_level: act });
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setSaving(false);
    }
  }

  const field =
    "h-12 w-full rounded-[14px] border border-line bg-field px-3.5 font-mono text-[17px] text-ink outline-none focus:border-green";

  return (
    <div className="flex flex-1 flex-col gap-[22px] px-6 pt-11 pb-9">
      <div className="flex flex-col gap-2">
        <Wordmark eyebrow="LV.1 スタート" />
        <p className="text-muted text-sm leading-[1.8]">
          音声かチャットで伝えるだけ。AIが食材ごとに分解して、カロリー・PFC・塩分まで自動計算します。
        </p>
      </div>

      <div className="bg-card flex flex-col gap-[18px] rounded-3xl p-5 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
        <label className="flex flex-col gap-2">
          <span className="text-muted text-[13px] font-medium">現在の体重 (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            value={wNow}
            onChange={(e) => setWNow(Number(e.target.value) || 0)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-muted text-[13px] font-medium">目標体重 (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            value={wGoal}
            onChange={(e) => setWGoal(Number(e.target.value) || 0)}
            className={field}
          />
        </label>
        <div className="flex flex-col gap-2.5">
          <span className="text-muted text-[13px] font-medium">活動量</span>
          <div className="flex gap-2">
            {ACTIVITY.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setAct(i)}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-[14px] text-[13px] font-medium ${
                  act === i ? "bg-green text-white" : "bg-chip text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="border-line-soft flex items-center justify-between border-t pt-1">
          <span className="text-muted text-[13px]">1日の目標カロリー</span>
          <span className="font-mono text-2xl font-medium">
            {nf(target)}
            <span className="text-faint text-[13px]"> kcal</span>
          </span>
        </div>
      </div>

      {error && <p className="text-rose-text text-sm">保存に失敗しました（{error}）</p>}

      <button
        type="button"
        onClick={start}
        disabled={!valid || saving}
        className="bg-green mt-auto flex min-h-[54px] items-center justify-center rounded-full text-[17px] font-bold text-white shadow-[0_8px_22px_oklch(0.62_0.15_152/0.3)] disabled:opacity-40"
      >
        {saving ? "保存中..." : "はじめる"}
      </button>
    </div>
  );
}
