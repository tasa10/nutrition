"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearDraft, useDraft } from "@/lib/draft";
import { toThumbnailDataURL } from "@/lib/image";
import {
  type Confidence,
  type MealItem,
  SLOT_LABEL,
  nf,
  todayISO,
  upsertMeal,
} from "@/lib/nutrition";

const CONF: Record<Confidence, { t: string; bg: string; fg: string }> = {
  high: { t: "確度 高", bg: "oklch(0.95 0.04 152)", fg: "oklch(0.44 0.11 152)" },
  mid: { t: "確度 中", bg: "oklch(0.95 0.05 80)", fg: "oklch(0.48 0.1 65)" },
  low: { t: "確度 低", bg: "oklch(0.95 0.04 30)", fg: "oklch(0.48 0.12 30)" },
};

export default function ReviewPage() {
  const router = useRouter();
  const draft = useDraft();
  const [edited, setEdited] = useState<MealItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

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
      await upsertMeal(todayISO(), draft.slot, draft.source, items, photo ?? undefined);
      clearDraft();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setSaving(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(false);
    try {
      setPhoto(await toThumbnailDataURL(file));
    } catch {
      setPhotoError(true);
    }
  }

  const chip = "rounded-[9px] bg-chip px-[11px] py-[7px] font-mono text-[11px] text-muted";

  return (
    <div className="flex flex-1 flex-col gap-4 px-[18px] pt-[22px] pb-10">
      <div className="flex flex-col gap-1.5">
        <div className="text-green-text font-mono text-[11px] tracking-[0.14em]">AI ANALYSIS</div>
        <h1 className="text-2xl font-black">こう記録します</h1>
        <p className="text-faint text-xs">ちがうものは削除、写真も足せます</p>
      </div>

      <section className="anim-pop bg-card flex flex-col gap-4 rounded-[26px] p-[22px] shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
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
              <div className="w-[42px] text-right font-mono text-sm">{nf(it.kcal)}</div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="bg-chip text-faint flex h-[30px] w-[30px] items-center justify-center rounded-full text-[15px] leading-none"
                aria-label="削除"
              >
                ×
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

      <section className="bg-card flex items-center gap-3.5 rounded-[22px] p-4 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
        {photo ? (
          <div
            className="h-16 w-16 flex-none rounded-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${photo})` }}
          />
        ) : (
          <div className="h-16 w-16 flex-none rounded-2xl bg-[repeating-linear-gradient(45deg,#f2ede4,#f2ede4_6px,#eae3d7_6px,#eae3d7_12px)]" />
        )}
        <div className="flex flex-1 flex-col gap-[3px]">
          <div className="text-[13px] font-medium">写真をつける</div>
          <div className={`text-[11px] ${photoError ? "text-rose-text" : "text-faint"}`}>
            {photoError ? "画像を読み込めませんでした" : "見た目も残すと記録簿が楽しい"}
          </div>
        </div>
        <label className="border-line flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-[13px]">
          {photo ? "変える" : "選ぶ"}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
            className="hidden"
          />
        </label>
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
          className="bg-green flex min-h-[54px] items-center justify-center rounded-full text-base font-bold text-white shadow-[0_8px_22px_oklch(0.62_0.15_152/0.3)] disabled:opacity-40"
        >
          {saving ? "保存中..." : "この内容で記録 +20XP"}
        </button>
        <Link
          href={`/record/input/?slot=${draft.slot}`}
          onClick={clearDraft}
          className="border-line bg-card flex min-h-[46px] items-center justify-center rounded-full border text-sm"
        >
          言い直す
        </Link>
      </div>
    </div>
  );
}
