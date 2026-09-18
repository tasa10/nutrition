"use client";

import { RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearDraft, useDraft } from "@/lib/draft";
import {
  type Confidence,
  type MealItem,
  SLOT_LABEL,
  appendToMeal,
  nf,
  todayISO,
} from "@/lib/nutrition";

const CONF: Record<Confidence, { t: string; bg: string; fg: string }> = {
  high: { t: "確度 高", bg: "var(--color-green-soft)", fg: "var(--color-green-deep)" },
  mid: { t: "確度 中", bg: "var(--color-amber-soft)", fg: "var(--color-amber-text)" },
  low: { t: "確度 低", bg: "var(--color-red-soft)", fg: "var(--color-red-deep)" },
};

export default function ReviewPage() {
  const router = useRouter();
  const draft = useDraft();
  const [edited, setEdited] = useState<MealItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (draft === undefined) return null;
  if (!draft) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted text-sm">解析結果がありません。</p>
        <Link href="/record/" className="text-green-text text-sm underline">
          記録に戻る
        </Link>
      </div>
    );
  }

  const items = edited ?? draft.analysis.items;
  const removeItem = (idx: number) => setEdited(items.filter((_, n) => n !== idx));
  const sum = (k: keyof MealItem) => items.reduce((a, i) => a + (Number(i[k]) || 0), 0);

  async function commit() {
    if (!draft || items.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await appendToMeal(todayISO(), draft.slot, draft.source, items);
      clearDraft();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setSaving(false);
    }
  }

  const chip = "rounded-[9px] bg-chip px-[11px] py-[7px] font-mono text-[11px] text-muted";

  return (
    <div className="flex flex-1 flex-col gap-4 px-[18px] pt-[22px] pb-10">
      <div className="flex flex-col gap-1.5">
        <div className="text-green-text font-mono text-[11px] tracking-[0.14em]">AI ANALYSIS</div>
        <h1 className="text-2xl font-black">こう記録します</h1>
        <p className="text-faint text-xs">ちがうものは削除できます。写真は今日の食事から足せます</p>
      </div>

      <section className="anim-pop bg-card shadow-card flex flex-col gap-4 rounded-[26px] p-[22px]">
        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-bold">{SLOT_LABEL[draft.slot]}</div>
          <div className="font-mono text-[30px] font-medium">
            {nf(sum("kcal"))}
            <span className="text-faint text-[13px]"> kcal</span>
          </div>
        </div>
        {items.map((it, idx) => {
          const c = CONF[it.confidence] ?? CONF.mid;
          return (
            <div key={idx} className="border-line-soft flex items-center gap-2.5 border-b pb-3">
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="text-sm font-medium">{it.name}</div>
                <div className="text-faint text-[11px]">{it.detail}</div>
              </div>
              <div
                className="rounded-full px-2 py-[3px] text-[10px] whitespace-nowrap"
                style={{ background: c.bg, color: c.fg }}
              >
                {c.t}
              </div>
              <div className="w-[64px] text-right font-mono text-sm whitespace-nowrap">
                {nf(it.kcal)}
                <span className="text-faint text-[10px]"> kcal</span>
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="bg-chip text-faint flex h-[30px] w-[30px] items-center justify-center rounded-full"
                aria-label="削除"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-faint text-sm">品目がありません。言い直してください。</p>
        )}
        <div className="flex flex-wrap gap-2">
          <div className={chip}>P {Math.round(sum("protein"))}g</div>
          <div className={chip}>F {Math.round(sum("fat"))}g</div>
          <div className={chip}>C {Math.round(sum("carbs"))}g</div>
          <div className={chip}>塩分 {sum("salt").toFixed(1)}g</div>
          <div className={chip}>糖質 {Math.round(sum("sugar"))}g</div>
        </div>
      </section>

      {draft.analysis.advice && (
        <section className="bg-green-soft flex flex-col gap-1.5 rounded-[22px] p-[18px]">
          <div className="text-green-deep text-xs font-bold">コーチのひとこと</div>
          <p className="text-[13px] leading-[1.8] text-[#3a3630]">{draft.analysis.advice}</p>
        </section>
      )}

      {error && <p className="text-rose-text text-sm">保存に失敗しました（{error}）</p>}

      <div className="mt-auto flex flex-col gap-2.5 pt-2.5">
        <button
          type="button"
          onClick={commit}
          disabled={items.length === 0 || saving}
          className="bg-green shadow-cta flex min-h-[54px] items-center justify-center rounded-full text-base font-bold text-white disabled:opacity-40"
        >
          {saving ? "保存中..." : "この内容で記録 +20XP"}
        </button>
        <Link
          href={`/record/input/?slot=${draft.slot}`}
          onClick={clearDraft}
          className="border-line bg-surface flex min-h-[46px] items-center justify-center gap-1.5 rounded-full border text-sm"
        >
          <RotateCcw size={15} aria-hidden />
          言い直す
        </Link>
      </div>
    </div>
  );
}
