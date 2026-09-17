"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { ApiError } from "@/lib/api";
import {
  type ChatMessage,
  type Day,
  type RecordProposal,
  type Stats,
  SLOT_LABEL,
  appendToMeal,
  blankItem,
  clearChat,
  getChat,
  getDay,
  getStats,
  nf,
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
      await appendToMeal(todayISO(), card.slot, "chat", items);
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
    "bg-card max-w-[86%] self-start rounded-[20px_20px_20px_6px] px-4 py-[13px] text-sm leading-[1.75] whitespace-pre-wrap shadow-[0_2px_12px_rgba(23,21,15,0.05)]";

  return (
    <AppShell refreshKey={refreshKey}>
      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-[120px]">
        <div className="border-track flex items-center gap-2.5 border-b pb-3">
          <div className="bg-green h-[34px] w-[34px] rounded-full" />
          <div className="flex flex-1 flex-col">
            <div className="text-sm font-bold">AIコーチ</div>
            <div className="text-green-text text-[11px]">{status}</div>
          </div>
          {bubbles !== null && bubbles.length > 0 && (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-faint hover:text-muted min-h-9 px-2 text-xs underline disabled:opacity-40"
            >
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
            className="bg-card flex gap-[5px] self-start rounded-[20px_20px_20px_6px] px-[18px] py-3.5 shadow-[0_2px_12px_rgba(23,21,15,0.05)]"
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
          <div className="anim-pop bg-card flex w-[88%] flex-col gap-3 self-start rounded-[20px] p-4 shadow-[0_2px_12px_rgba(23,21,15,0.05)]">
            <div className="text-faint text-xs">この内容で記録しますか？</div>
            <div className="flex items-baseline justify-between gap-2.5">
              <div className="text-sm font-bold">{card.name}</div>
              <div className="font-mono text-xl">{nf(card.kcal)}</div>
            </div>
            {card.items.length > 1 && (
              <div className="flex flex-col gap-1">
                {card.items.map((it, i) => (
                  <div key={i} className="text-muted flex justify-between gap-2.5 text-xs">
                    <span>{it.name}</span>
                    <span className="text-faint font-mono">{nf(it.kcal)}</span>
                  </div>
                ))}
              </div>
            )}
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
                className="border-line flex min-h-[42px] items-center rounded-full border px-5 text-[13px]"
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
                className="border-line bg-card flex min-h-[38px] items-center rounded-full border px-3.5 text-xs disabled:opacity-40"
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
              className="border-line bg-card text-ink focus:border-green max-h-[120px] min-h-12 flex-1 resize-none rounded-[22px] border px-4 py-[13px] text-[15px] leading-normal outline-none"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={busy || bubbles === null || !input.trim()}
              className="bg-green flex h-12 w-12 flex-none items-center justify-center rounded-full text-lg text-white disabled:opacity-40"
              aria-label="送信"
            >
              ↑
            </button>
          </div>
        </div>
        <div ref={endRef} />
      </main>
    </AppShell>
  );
}
