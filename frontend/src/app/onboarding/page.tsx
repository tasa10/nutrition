"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Wordmark from "@/components/Wordmark";
import { authEnabled, signOut } from "@/lib/firebase";
import { nf, previewTarget, putProfile } from "@/lib/nutrition";

const ACTIVITY = ["ふつう", "活動的", "よく動く"];

export default function OnboardingPage() {
  const router = useRouter();
  const [wNow, setWNow] = useState(68);
  const [wGoal, setWGoal] = useState(62);
  const [act, setAct] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

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

  async function backToLogin() {
    if (leaving) return;
    setLeaving(true);
    try {
      await signOut();
      router.replace("/login/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setLeaving(false);
    }
  }

  const field =
    "h-12 w-full rounded-[14px] border border-line bg-field px-3.5 font-mono text-[17px] text-ink outline-none focus:border-green";

  return (
    <div className="flex flex-1 flex-col gap-[22px] px-6 pt-[22px] pb-9">
      {/* Reached right after signing in, so going back means signing out. Dev mode has no login. */}
      {authEnabled && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={backToLogin}
            disabled={saving || leaving}
            className="bg-surface text-ink shadow-card flex h-11 w-11 flex-none items-center justify-center rounded-full disabled:opacity-40"
            aria-label="ログアウトしてログイン画面に戻る"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
        </div>
      )}
      <div className="flex flex-col items-center gap-2.5 pt-1.5 text-center">
        <Wordmark />
        <p className="text-muted mt-1.5 max-w-[320px] text-sm leading-[1.8] text-pretty">
          音声かチャットで伝えるだけ。AIが食材ごとに分解して、カロリー・PFC・塩分まで自動計算します。
        </p>
      </div>

      <div className="bg-card shadow-card flex flex-col gap-[18px] rounded-3xl p-5">
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
        className="bg-green shadow-cta mt-auto flex min-h-[54px] items-center justify-center rounded-full text-[17px] font-bold text-white disabled:opacity-40"
      >
        {saving ? "保存中..." : "はじめる"}
      </button>
    </div>
  );
}
