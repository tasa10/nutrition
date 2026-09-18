"use client";

import { ArrowLeft, Camera, Mic, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toThumbnailDataURL } from "@/lib/image";
import {
  type Meal,
  type MealItem,
  type Slot,
  SLOT_LABEL,
  deleteMeal,
  formatDateJP,
  getDay,
  isISODate,
  isSlot,
  nf,
  todayISO,
  upsertMeal,
} from "@/lib/nutrition";

function EditScreen({ slot, date }: { slot: Slot; date: string }) {
  const router = useRouter();
  const isToday = date === todayISO();
  // Past days are reached from the history screen, so return there with the same day selected.
  const backHref = isToday ? "/" : `/history/?date=${date}`;
  const [meal, setMeal] = useState<Meal | null | undefined>(undefined);
  const [items, setItems] = useState<MealItem[]>([]);
  // undefined: untouched, "": removed, data URL: replaced. Sent as-is so the API keeps / clears / swaps it.
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [photoError, setPhotoError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDay(date)
      .then((d) => {
        if (cancelled) return;
        const m = d.meals.find((x) => x.slot === slot) ?? null;
        setMeal(m);
        setItems(m ? m.items.map((i) => ({ ...i })) : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMeal(null);
          setError(e instanceof Error ? e.message : "unknown error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slot, date]);

  function patch(idx: number, key: keyof MealItem, val: string | number) {
    setItems((xs) => xs.map((it, n) => (n === idx ? { ...it, [key]: val } : it)));
  }

  async function save() {
    if (busy) return;
    const kept = items.filter((i) => i.name.trim());
    setBusy(true);
    setError(null);
    try {
      if (kept.length === 0) {
        await deleteMeal(date, slot);
      } else {
        await upsertMeal(date, slot, "edited", kept, photo);
      }
      router.push(backHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setBusy(false);
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

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMeal(date, slot);
      router.push(backHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setBusy(false);
    }
  }

  if (meal === undefined) return <p className="text-faint p-6">読み込み中...</p>;
  if (meal === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted text-sm">
          {isToday ? "" : `${formatDateJP(date)}の`}
          {SLOT_LABEL[slot]}の記録はありません。
        </p>
        <Link
          href={isToday ? `/record/input/?slot=${slot}` : backHref}
          className="text-green-text text-sm underline"
        >
          {isToday ? "記録する" : "記録簿へ戻る"}
        </Link>
      </div>
    );
  }

  const shownPhoto = photo ?? meal.photo ?? "";
  const total = items.reduce((a, i) => a + (Number(i.kcal) || 0), 0);
  const field =
    "min-w-0 rounded-[13px] border border-line bg-field px-3 outline-none focus:border-green";

  return (
    <div className="flex flex-1 flex-col gap-4 px-[18px] pt-[22px] pb-10">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="border-line bg-card text-ink flex h-11 w-11 flex-none items-center justify-center rounded-full border shadow-[0_2px_8px_rgba(23,21,15,0.06)]"
          aria-label="戻る"
        >
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[22px] font-black">{SLOT_LABEL[slot]}を編集</h1>
          <p className="text-faint text-[11px]">
            {isToday ? "名前とカロリーを直せます" : `${formatDateJP(date)}の記録`}
          </p>
        </div>
      </div>

      <section className="bg-card flex flex-col gap-4 rounded-[26px] p-5 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
        <div className="flex items-baseline justify-between">
          <div className="text-muted text-[13px] font-bold">合計</div>
          <div className="font-mono text-[28px] font-medium">
            {nf(total)}
            <span className="text-faint text-[13px]"> kcal</span>
          </div>
        </div>
        {items.map((it, idx) => (
          <div key={idx} className="border-line-soft flex flex-col gap-2 border-b pb-3.5">
            <div className="flex items-center gap-2">
              <input
                value={it.name}
                onChange={(e) => patch(idx, "name", e.target.value)}
                className={`${field} text-ink min-h-11 flex-1 text-sm`}
              />
              <button
                type="button"
                onClick={() => setItems((xs) => xs.filter((_, n) => n !== idx))}
                className="bg-chip text-faint flex h-11 w-11 flex-none items-center justify-center rounded-full"
                aria-label="削除"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={it.detail}
                onChange={(e) => patch(idx, "detail", e.target.value)}
                placeholder="分量の目安"
                className={`${field} text-muted min-h-10 flex-1 text-xs`}
              />
              <input
                type="number"
                inputMode="numeric"
                value={it.kcal}
                onChange={(e) => patch(idx, "kcal", Number(e.target.value) || 0)}
                className={`${field} text-ink min-h-10 w-[88px] flex-none text-right font-mono text-sm`}
              />
              <div className="text-faint w-[26px] text-[11px]">kcal</div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setItems((xs) => [
              ...xs,
              {
                name: "",
                detail: "",
                kcal: 0,
                protein: 0,
                fat: 0,
                carbs: 0,
                salt: 0,
                sugar: 0,
                confidence: "mid",
              },
            ])
          }
          className="text-muted flex min-h-11 items-center gap-1.5 self-start rounded-full border-[1.5px] border-dashed border-[#dcd5c9] px-5 text-[13px] font-medium"
        >
          <Plus size={15} aria-hidden />
          品目を追加
        </button>
      </section>

      <section className="bg-card flex items-center gap-3.5 rounded-[22px] p-4 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
        {shownPhoto ? (
          <div
            className="h-16 w-16 flex-none rounded-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${shownPhoto})` }}
          />
        ) : (
          <div className="bg-chip text-faint flex h-16 w-16 flex-none items-center justify-center rounded-2xl">
            <Camera size={24} aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="text-[13px] font-medium">写真</div>
          <div className={`text-[11px] ${photoError ? "text-rose-text" : "text-faint"}`}>
            {photoError
              ? "画像を読み込めませんでした"
              : photo !== undefined
                ? "保存すると反映されます"
                : shownPhoto
                  ? "変更・削除できます"
                  : "見た目も残すと記録簿が楽しい"}
          </div>
        </div>
        {shownPhoto && (
          <button
            type="button"
            onClick={() => {
              setPhoto("");
              setPhotoError(false);
            }}
            className="bg-chip text-faint flex h-10 w-10 flex-none items-center justify-center rounded-full"
            aria-label="写真を削除"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        )}
        <label className="border-line flex min-h-10 flex-none cursor-pointer items-center rounded-full border px-4 text-[13px]">
          {shownPhoto ? "変える" : "選ぶ"}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              // Lets the same file be picked again after removing it.
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
      </section>

      {error && <p className="text-rose-text text-sm">失敗しました（{error}）</p>}

      <div className="mt-auto flex flex-col gap-2.5 pt-2.5">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="bg-green flex min-h-[54px] items-center justify-center rounded-full text-base font-bold text-white shadow-[0_8px_22px_oklch(0.62_0.15_152/0.3)] disabled:opacity-40"
        >
          {busy ? "保存中..." : "保存する"}
        </button>
        <div className="flex gap-2.5">
          {isToday && (
            <Link
              href={`/record/input/?slot=${slot}`}
              className="border-line bg-card flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full border text-sm"
            >
              <Mic size={15} aria-hidden />
              音声で追加する
            </Link>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="border-rose-line bg-card text-rose-text flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-full border text-sm disabled:opacity-40"
          >
            <Trash2 size={15} aria-hidden />
            この記録を削除
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPageInner() {
  const params = useSearchParams();
  const slotParam = params.get("slot");
  const dateParam = params.get("date");
  const slot: Slot = isSlot(slotParam) ? slotParam : "dinner";
  const date = isISODate(dateParam) ? dateParam : todayISO();
  return <EditScreen slot={slot} date={date} />;
}

export default function EditPage() {
  return (
    <Suspense fallback={null}>
      <EditPageInner />
    </Suspense>
  );
}
