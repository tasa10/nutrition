"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { ApiError } from "@/lib/api";
import { appendChat, setChat, useChat } from "@/lib/chatStore";
import {
  type Day,
  type RecordProposal,
  type Stats,
  SLOT_LABEL,
  appendToMeal,
  blankItem,
  getDay,
  getStats,
  nf,
  sendChat,
  todayISO,
} from "@/lib/nutrition";

const CHIPS = [
  "今夜ラーメン食べても平気？",
  "あと何食べたらPFC整う？",
  "コンビニで買える高たんぱくおやつ",
];

// The API accepts up to 40; older turns add little and cost tokens.
const HISTORY_LIMIT = 30;

export default function ChatPage() {
  const messages = useChat();
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
  }, [messages.length, busy, card]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const history = [...messages, { role: "user" as const, text: t }];
    setChat(history);
    setInput("");
    setBusy(true);
    setCard(null);
    try {
      const reply = await sendChat(todayISO(), history.slice(-HISTORY_LIMIT));
      appendChat({ role: "assistant", text: reply.reply });
      setCard(reply.record);
    } catch (e) {
      appendChat({
        role: "assistant",
        // ApiError carries the server's explanation (rate limit, busy, ...); anything else is a network failure.
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
      appendChat({ role: "assistant", text: `${SLOT_LABEL[card.slot]}に記録したぞ。+20XP！` });
      setCard(null);
      setRefreshKey((n) => n + 1);
    } catch {
      appendChat({ role: "assistant", text: "記録に失敗しました。もう一度お試しください。" });
    } finally {
      setSaving(false);
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

  return (
    <AppShell refreshKey={refreshKey}>
      <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-[120px]">
        <div className="border-track flex items-center gap-2.5 border-b pb-3">
          <div className="bg-green h-[34px] w-[34px] rounded-full" />
          <div className="flex flex-col">
            <div className="text-sm font-bold">AIコーチ</div>
            <div className="text-green-text text-[11px]">{status}</div>
          </div>
        </div>

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="bg-green max-w-[80%] self-end rounded-[20px_20px_6px_20px] px-4 py-[13px] text-sm leading-[1.7] whitespace-pre-wrap text-white"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={i}
              className="bg-card max-w-[86%] self-start rounded-[20px_20px_20px_6px] px-4 py-[13px] text-sm leading-[1.75] whitespace-pre-wrap shadow-[0_2px_12px_rgba(23,21,15,0.05)]"
            >
              {m.text}
            </div>
          ),
        )}

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
                disabled={busy}
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
              disabled={busy || !input.trim()}
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
