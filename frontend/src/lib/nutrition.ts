import { deleteJson, fetchJson, postJson, putJson } from "./api";

export type Slot = "breakfast" | "lunch" | "dinner" | "snack";
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};
export const SLOT_SHORT: Record<Slot, string> = {
  breakfast: "朝",
  lunch: "昼",
  dinner: "夕",
  snack: "間",
};

export function isSlot(v: string | null | undefined): v is Slot {
  return !!v && (SLOTS as string[]).includes(v);
}

export function slotForNow(): Slot {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

export type Confidence = "high" | "mid" | "low";

export type MealItem = {
  name: string;
  detail: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  salt: number;
  sugar: number;
  confidence: Confidence;
};

export function blankItem(): MealItem {
  return {
    name: "",
    detail: "",
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    salt: 0,
    sugar: 0,
    confidence: "mid",
  };
}

export type Meal = {
  id: number;
  date: string;
  slot: Slot;
  source: string;
  photo?: string;
  // Yen for the whole meal; 0 means not entered.
  cost: number;
  recorded_at: string;
  items: MealItem[];
};

export type Totals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  salt: number;
  sugar: number;
};

export type Day = {
  date: string;
  target_kcal: number;
  totals: Totals;
  meals: Meal[];
};

export type Profile = {
  weight_now: number;
  weight_goal: number;
  activity_level: number;
  monthly_budget: number;
  target_kcal: number;
};

export type Analysis = {
  items: MealItem[];
  advice: string;
};

export type Badge = { key: string; label: string; earned: boolean };

export type Stats = {
  xp: number;
  level: number;
  xp_in_level: number;
  streak: number;
  today_meals: number;
  badges: Badge[];
};

export type HistoryDay = { date: string; kcal: number; cost: number; meals: number };

export type Budget = {
  month: string;
  // 0 means no budget set.
  monthly_budget: number;
  spent: number;
  by_slot: { slot: Slot; cost: number }[];
};
export type History = { target_kcal: number; days: HistoryDay[] };

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: number; role: ChatRole; text: string; created_at: string };
export type RecordProposal = { name: string; kcal: number; slot: Slot; items: MealItem[] };
export type ChatReply = { reply: string; record: RecordProposal | null; messages: ChatMessage[] };

export const SOURCE_LABEL: Record<string, string> = {
  voice: "音声入力",
  text: "テキスト入力",
  chat: "チャット相談",
  edited: "編集済み",
  manual: "手動追加",
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Dates are handled as local calendar days; the T00:00:00 suffix keeps Date from treating them as UTC.
function parseISODate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function isISODate(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parseISODate(v).getTime());
}

export function addDays(date: string, n: number): string {
  const d = parseISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayJP(date: string): string {
  return WEEKDAY_JP[parseISODate(date).getDay()];
}

// "9月15日（月）"
export function formatDateJP(date: string): string {
  const d = parseISODate(date);
  return `${d.getMonth() + 1}月${d.getDate()}日（${weekdayJP(date)}）`;
}

// "9/15"
export function formatMonthDay(date: string): string {
  const d = parseISODate(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "2026-09"
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "2026年9月"
export function formatMonthJP(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export const nf = (n: number) => Math.round(n).toLocaleString("en-US");
export const yen = (n: number) => `¥${nf(n)}`;

export const MAX_YEN = 10_000_000;

// Parses a yen input field: digits only, clamped to what the API accepts. "" is 0.
export function parseYen(v: string): number {
  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? Math.min(MAX_YEN, n) : 0;
}

export function mealKcal(m: Meal | undefined): number {
  return m ? m.items.reduce((a, i) => a + (i.kcal || 0), 0) : 0;
}

// Mirrors backend model.Profile.TargetKcal so onboarding can preview the number.
export function previewTarget(weightNow: number, weightGoal: number, act: number): number {
  const mult = [1.2, 1.45, 1.7][act] ?? 1.2;
  const deficit = weightGoal < weightNow ? 400 : 0;
  return Math.round((weightNow * 22 * mult - deficit) / 10) * 10;
}

export const getProfile = () => fetchJson<Profile>("/api/profile");
export const putProfile = (body: {
  weight_now: number;
  weight_goal: number;
  activity_level: number;
  // Left out: the stored budget is kept.
  monthly_budget?: number;
}) => putJson<Profile>("/api/profile", body);

export const getDay = (date: string) => fetchJson<Day>(`/api/days/${date}`);
export const analyzeMeal = (text: string) => postJson<Analysis>("/api/meals/analyze", { text });

type MealExtras = {
  // undefined keeps the stored photo, "" removes it, a data URL replaces it.
  photo?: string;
  // Yen for the whole meal. undefined keeps the stored amount.
  cost?: number;
};

// Replaces the slot's items. Keys left out of `extras` are not sent, so the server keeps them.
export const upsertMeal = (
  date: string,
  slot: Slot,
  source: string,
  items: MealItem[],
  extras: MealExtras = {},
) => putJson<Meal>(`/api/meals/${date}/${slot}`, { source, items, ...extras });

export const deleteMeal = (date: string, slot: Slot) => deleteJson(`/api/meals/${date}/${slot}`);

// Adds items to whatever is already recorded for the slot instead of replacing it.
// addCost (yen) is added on top of what the slot already cost.
export async function appendToMeal(
  date: string,
  slot: Slot,
  source: string,
  items: MealItem[],
  addCost = 0,
) {
  const day = await getDay(date);
  const current = day.meals.find((m) => m.slot === slot);
  return upsertMeal(
    date,
    slot,
    source,
    [...(current?.items ?? []), ...items],
    addCost > 0 ? { cost: (current?.cost ?? 0) + addCost } : {},
  );
}

export const getBudget = (month: string) => fetchJson<Budget>(`/api/budget?month=${month}`);
export const putBudget = (monthlyBudget: number) =>
  putJson<{ monthly_budget: number }>("/api/budget", { monthly_budget: monthlyBudget });

export const getStats = (date: string) => fetchJson<Stats>(`/api/stats?date=${date}`);
export const getHistory = (to: string, days: number) =>
  fetchJson<History>(`/api/history?to=${to}&days=${days}`);

export const getChat = () =>
  fetchJson<{ messages: ChatMessage[] }>("/api/chat").then((r) => r.messages);
export const sendChat = (date: string, text: string) =>
  postJson<ChatReply>("/api/chat", { date, text });
export const postChatNote = (text: string) => postJson<ChatMessage>("/api/chat/notes", { text });
export const clearChat = () => deleteJson("/api/chat");

export const searchFoods = (query: string) =>
  postJson<{ items: MealItem[] }>("/api/foods/search", { query }).then((r) => r.items);
export const getFrequentFoods = () =>
  fetchJson<{ items: MealItem[] }>("/api/foods/frequent").then((r) => r.items);
