import { useSyncExternalStore } from "react";
import type { ChatMessage } from "./nutrition";

const KEY = "nutrition.chat";

export const CHAT_GREETING: ChatMessage[] = [
  { role: "assistant", text: "よっ、今日もいこう！食べたものを言うか、迷ってるなら相談してくれ。" },
];

let cache: ChatMessage[] | null = null;
const listeners = new Set<() => void>();

function read(): ChatMessage[] {
  if (cache) return cache;
  try {
    const raw = sessionStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ChatMessage[]) : CHAT_GREETING;
  } catch {
    cache = CHAT_GREETING;
  }
  return cache;
}

export function setChat(next: ChatMessage[]) {
  cache = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sessionStorage unavailable — the conversation just won't survive navigation
  }
  listeners.forEach((l) => l());
}

export function appendChat(...messages: ChatMessage[]) {
  setChat([...read(), ...messages]);
}

export function resetChat() {
  setChat(CHAT_GREETING);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Conversation is kept per browser tab (sessionStorage), so it survives moving between tabs of the app.
export function useChat(): ChatMessage[] {
  return useSyncExternalStore(subscribe, read, () => CHAT_GREETING);
}
