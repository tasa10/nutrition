import { useSyncExternalStore } from "react";
import type { Analysis, Slot } from "./nutrition";

export type ReviewDraft = {
  slot: Slot;
  text: string;
  source: "voice" | "text";
  analysis: Analysis;
};

const KEY = "nutrition.reviewDraft";

export function saveDraft(d: ReviewDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // sessionStorage unavailable (private mode etc.) — review page will show an empty state
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Parsed value is cached per raw string so useSyncExternalStore sees a stable snapshot.
let cachedRaw: string | null | undefined;
let cachedDraft: ReviewDraft | null = null;

function readDraft(): ReviewDraft | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedDraft = raw ? (JSON.parse(raw) as ReviewDraft) : null;
    } catch {
      cachedDraft = null;
    }
  }
  return cachedDraft;
}

const subscribe = () => () => {};
const serverSnapshot = () => undefined;

// undefined while prerendering / before hydration, then the draft (or null if none).
export function useDraft(): ReviewDraft | null | undefined {
  return useSyncExternalStore(subscribe, readDraft, serverSnapshot);
}
