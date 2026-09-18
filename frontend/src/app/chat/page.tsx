"use client";

import { ArrowUp, Bot, RotateCcw } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import YenField from "@/components/YenField";
import { ApiError } from "@/lib/api";
import {
  type ChatMessage,
  type Day,
  type RecordProposal,
  type Stats,
  SLOTS,
  SLOT_LABEL,
  appendToMeal,
  blankItem,
  clearChat,
  getChat,
  getDay,
  getStats,
  nf,
  parseYen,
  postChatNote,
  sendChat,
  todayISO,
} from "@/lib/nutrition";

const GREETING = "よっ、今日もいこう！食べたものを言うか、迷ってるなら相談してくれ。";

const CHIPS = [
  "今夜ラーメン食べても平気？",
  "あと何食べたらPFC整う？",
  "コンビニで買える高たんぱくおやつ",
];

// Bubbles shown in the list: stored turns, the message being sent, and transient errors.
type Bubble =
  | { kind: "stored"; message: ChatMessage }
  | { kind: "pending"; text: string }
  | { kind: "error"; text: string };

let nextKey = 0;

export default function ChatPage() {
  const [bubbles, setBubbles] = useState<(Bubble & { key: number })[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<RecordProposal | null>(null);
  const [cardCost, setCardCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState<Day | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getChat()
      .then((messages) => {
        if (!cancelled)
          setBubbles(messages.map((message) => ({ kind: "stored", message, key: nextKey++ })));
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const date = todayISO();
    getDay(date)
      .then((d) => {
        if (!cancelled) setDay(d);
      })
      .catch(() => {});
    getStats(date)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles?.length, busy, card]);

  function push(...items: Bubble[]) {
    setBubbles((xs) => [...(xs ?? []), ...items.map((b) => ({ ...b, key: nextKey++ }))]);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || bubbles === null) return;
    setInput("");
    setBusy(true);
    setCard(null);
    push({ kind: "pending", text: t });
    try {
      const reply = await sendChat(todayISO(), t);
      setBubbles((xs) => [
        ...(xs ?? []).filter((b) => b.kind !== "pending"),
        ...reply.messages.map((message) => ({ kind: "stored" as const, message, key: nextKey++ })),
      ]);
      setCard(reply.record);
      setCardCost("");
    } catch (e) {
      // Nothing was stored server-side, so drop the pending bubble and let the user resend.
      setBubbles((xs) => (xs ?? []).filter((b) => b.kind !== "pending"));
      setInput(t);
      push({
        kind: "error",
        text:
          e instanceof ApiError ? e.message : "通信に失敗しました。もう一度送ってみてください。",
      });
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!card || saving) return;
    setSaving(true);
    try {
      const items =
        card.items.length > 0
          ? card.items
          : [{ ...blankItem(), name: card.name, detail: "1人前", kcal: card.kcal }];
      await appendToMeal(todayISO(), card.slot, "chat", items, parseYen(cardCost));
      setCard(null);
      setRefreshKey((n) => n + 1);
      const note = await postChatNote(`${SLOT_LABEL[card.slot]}に記録したぞ。+20XP！`);
      push({ kind: "stored", message: note });
    } catch {
      push({ kind: "error", text: "記録に失敗しました。もう一度お試しください。" });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (busy || !window.confirm("会話をすべて消しますか？")) return;
    try {
      await clearChat();
      setBubbles([]);
      setCard(null);
    } catch {
      push({ kind: "error", text: "リセットに失敗しました。" });
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: Enter that confirms a Japanese IME conversion must not send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  const remaining = day ? Math.max(0, day.target_kcal - day.totals.kcal) : null;
  const status =
    remaining === null ? "読み込み中…" : `残り ${nf(remaining)} kcal · Lv.${stats?.level ?? 1}`;

  const userBubble =
    "bg-green max-w-[80%] self-end rounded-[20px_20px_6px_20px] px-4 py-[13px] text-sm leading-[1.7] whitespace-pre-wrap text-white";
  const coachBubble =
    "bg-card max-w-[86%] self-start rounded-[20px_20px_20px_6px] px-4 py-[13px] text-sm leading-[1.75] whitespace-pre-wrap shadow-card";

  return (
    <AppShell>
      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-[120px]">
        <div className="border-line relative flex items-center justify-center gap-2.5 border-b pb-3">
          <div className="bg-green flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-white">
            <Bot size={18} aria-hidden />
          </div>
          <div className="flex flex-col">
            <div className="text-sm font-bold">AIコーチ</div>
            <div className="text-green-text text-[11px]">{status}</div>
          </div>
          {bubbles !== null && bubbles.length > 0 && (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-faint hover:text-muted absolute top-0 right-0 flex min-h-9 items-center gap-1 px-2 text-xs disabled:opacity-40"
            >
              <RotateCcw size={13} aria-hidden />
              リセット
            </button>
          )}
        </div>

        {bubbles === null && !loadError && <p className="text-faint text-sm">読み込み中...</p>}
        {loadError && (
          <p className="text-rose-text text-sm">会話を読み込めませんでした（{loadError}）</p>
        )}

        {bubbles !== null && bubbles.length === 0 && <div className={coachBubble}>{GREETING}</div>}

        {bubbles?.map((b) => {
          switch (b.kind) {
            case "stored":
              return (
                <div key={b.key} className={b.message.role === "user" ? userBubble : coachBubble}>
                  {b.message.text}
                </div>
              );
            case "pending":
              return (
                <div key={b.key} className={`${userBubble} opacity-70`}>
                  {b.text}
                </div>
              );
            case "error":
              return (
                <div key={b.key} className={`${coachBubble} text-rose-text`}>
                  {b.text}
                </div>
              );
          }
        })}

        {busy && (
          <div
            className="bg-card shadow-card flex gap-[5px] self-start rounded-[20px_20px_20px_6px] px-[18px] py-3.5"
            aria-label="返信を作成中"
          >
            {[0, 0.2, 0.4].map((delay) => (
              <div
                key={delay}
                className="anim-dots bg-dim h-[7px] w-[7px] rounded-full"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        )}

        {card && (
          <div className="anim-pop bg-card shadow-card flex w-[88%] flex-col gap-3 self-start rounded-[20px] p-4">
            <div className="text-faint text-xs">この内容で記録しますか？</div>
            <div className="flex items-baseline justify-between gap-2.5">
              <div className="text-sm font-bold">{card.name}</div>
              <div className="font-mono text-xl">
                {nf(card.kcal)}
                <span className="text-faint text-xs"> kcal</span>
              </div>
            </div>
            {card.items.length > 1 && (
              <div className="flex flex-col gap-1">
                {card.items.map((it, i) => (
                  <div key={i} className="text-muted flex justify-between gap-2.5 text-xs">
                    <span>{it.name}</span>
                    <span className="text-faint font-mono">{nf(it.kcal)} kcal</span>
                  </div>
                ))}
              </div>
            )}
            {/* The coach's guess is preselected; the user can move the record to another slot. */}
            <div className="flex gap-1.5" role="radiogroup" aria-label="食事の区分">
              {SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={card.slot === slot}
                  onClick={() => setCard({ ...card, slot })}
                  disabled={saving}
                  className={`flex min-h-9 flex-1 items-center justify-center rounded-full text-xs font-medium ${
                    card.slot === slot ? "bg-green text-white" : "bg-chip text-muted"
                  }`}
                >
                  {SLOT_LABEL[slot]}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-muted text-xs">かかった金額（任意）</div>
              <YenField
                value={cardCost}
                onChange={setCardCost}
                ariaLabel="この食事にかかった金額（円）"
                disabled={saving}
                className="w-[130px] flex-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={accept}
                disabled={saving}
                className="bg-green flex min-h-[42px] items-center rounded-full px-5 text-[13px] font-bold text-white disabled:opacity-40"
              >
                {saving ? "記録中…" : `${SLOT_LABEL[card.slot]}に記録`}
              </button>
              <button
                type="button"
                onClick={() => setCard(null)}
                className="border-line bg-surface flex min-h-[42px] items-center rounded-full border px-5 text-[13px]"
              >
                あとで
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-3.5">
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => send(label)}
                disabled={busy || bubbles === null}
                className="border-line bg-surface flex min-h-[38px] items-center rounded-full border px-3.5 text-xs disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="食べたものや相談を入力"
              rows={1}
              maxLength={1000}
              className="border-line bg-surface text-ink focus:border-green max-h-[120px] min-h-12 flex-1 resize-none rounded-[22px] border px-4 py-[13px] text-[15px] leading-normal outline-none"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={busy || bubbles === null || !input.trim()}
              className="bg-green flex h-12 w-12 flex-none items-center justify-center rounded-full text-lg text-white disabled:opacity-40"
              aria-label="送信"
            >
              <ArrowUp size={20} aria-hidden />
            </button>
          </div>
        </div>
        <div ref={endRef} />
      </main>
    </AppShell>
  );
}
