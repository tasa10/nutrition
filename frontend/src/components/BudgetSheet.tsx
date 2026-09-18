"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import DetailSheet from "@/components/DetailSheet";
import SlotIcon, { SLOT_FG } from "@/components/SlotIcon";
import YenField from "@/components/YenField";
import {
  type Budget,
  SLOT_LABEL,
  daysInMonth,
  formatMonthJP,
  monthOf,
  nf,
  parseYen,
  putBudget,
  todayISO,
  yen,
} from "@/lib/nutrition";

type Props = {
  budget: Budget;
  onClose: () => void;
  // Called with the new monthly budget after it has been saved.
  onBudgetSaved: (monthlyBudget: number) => void;
};

const pctOf = (val: number, total: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

// Monthly food spending: total vs budget, per-day pace, per-slot breakdown, and the budget editor.
export default function BudgetSheet({ budget, onClose, onBudgetSaved }: Props) {
  const limit = budget.monthly_budget;
  const [editing, setEditing] = useState(limit === 0);
  const [draft, setDraft] = useState(limit > 0 ? String(limit) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const total = daysInMonth(budget.month);
  // Past months count as fully elapsed.
  const elapsed = monthOf(today) === budget.month ? Number(today.slice(8, 10)) : total;
  const remainingDays = total - elapsed;
  const left = limit - budget.spent;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const value = parseYen(draft);
      await putBudget(value);
      onBudgetSaved(value);
      setEditing(value === 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSaving(false);
    }
  }

  const card = "bg-card shadow-card flex flex-col";
  const stat = "bg-chip flex flex-1 flex-col gap-0.5 rounded-xl px-3 py-2.5";

  return (
    <DetailSheet
      title="食費管理"
      subtitle={`${formatMonthJP(budget.month)}の内訳`}
      onClose={onClose}
    >
      <section className={`${card} gap-3.5 rounded-[26px] p-[22px]`}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-muted text-[13px]">今月の食費{limit > 0 ? " / 予算" : ""}</div>
          <div className="font-mono text-[26px] font-medium">
            {yen(budget.spent)}
            {limit > 0 && <span className="text-faint text-[13px]"> / {yen(limit)}</span>}
          </div>
        </div>
        {limit > 0 && (
          <>
            <div className="bg-track h-3 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${left < 0 ? "bg-rose-text" : "bg-amber"}`}
                style={{ width: `${Math.min(100, pctOf(budget.spent, limit))}%` }}
              />
            </div>
            <div className="text-muted flex justify-between text-xs">
              <span>{left >= 0 ? `残り ${yen(left)}` : `${yen(-left)} オーバー`}</span>
              <span>予算の {pctOf(budget.spent, limit)}%</span>
            </div>
          </>
        )}
        <div className="border-line-soft flex gap-2 border-t pt-1.5">
          <div className={stat}>
            <span className="text-faint text-[11px]">1日平均</span>
            <span className="font-mono text-sm">{yen(budget.spent / Math.max(1, elapsed))}</span>
          </div>
          <div className={stat}>
            <span className="text-faint text-[11px]">残り日数の目安</span>
            <span className="font-mono text-sm">
              {limit > 0 && remainingDays > 0
                ? `${yen(Math.max(0, left) / remainingDays)} / 日`
                : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className={`${card} gap-3 rounded-[22px] px-5 py-[18px]`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="text-muted text-[13px] font-bold">月の予算</div>
            {!editing && (
              <div className="font-mono text-lg">{limit > 0 ? yen(limit) : "未設定"}</div>
            )}
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="border-line bg-surface flex min-h-10 flex-none items-center gap-1.5 rounded-full border px-4 text-[13px]"
            >
              <Pencil size={14} aria-hidden />
              変更
            </button>
          )}
        </div>
        {editing && (
          <>
            <div className="flex gap-2">
              <YenField
                value={draft}
                onChange={setDraft}
                ariaLabel="月の食費予算（円）"
                placeholder="45000"
                disabled={saving}
                className="flex-1"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="bg-green flex min-h-11 flex-none items-center rounded-[13px] px-5 text-sm font-bold text-white disabled:opacity-40"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
            <p className="text-faint text-[11px]">空欄か 0 で保存すると、予算なしになります。</p>
          </>
        )}
        {error && <p className="text-rose-text text-sm">保存に失敗しました（{error}）</p>}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="text-muted pl-1 text-[13px] font-bold">区分ごとの内訳</div>
        {budget.by_slot.map((b) => (
          <div key={b.slot} className={`${card} gap-2.5 rounded-[20px] px-4 py-3.5`}>
            <div className="flex items-center gap-3">
              <SlotIcon slot={b.slot} size={32} />
              <div className="flex-1 text-sm font-bold">{SLOT_LABEL[b.slot]}</div>
              <div className="font-mono text-[15px]">{yen(b.cost)}</div>
            </div>
            <div className="bg-track h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${pctOf(b.cost, budget.spent)}%`, background: SLOT_FG[b.slot] }}
              />
            </div>
          </div>
        ))}
      </section>
      <p className="text-faint pl-1 text-[11px]">
        ※ 金額は各食事に入力した値の合計です（{nf(elapsed)}日目 / {total}日）
      </p>
    </DetailSheet>
  );
}
