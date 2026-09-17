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
export const SLOT_HUE: Record<Slot, number> = {
  breakfast: 90,
  lunch: 152,
  dinner: 265,
  snack: 30,
};

export function isSlot(v: string | null | undefined): v is Slot {
  return !!v && (SLOTS as string[]).includes(v);
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

export type Meal = {
  id: number;
  date: string;
  slot: Slot;
  source: string;
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
  target_kcal: number;
};

export type Analysis = {
  items: MealItem[];
  advice: string;
};

export const SOURCE_LABEL: Record<string, string> = {
  voice: "音声入力",
  text: "テキスト入力",
  edited: "編集済み",
  manual: "手動追加",
};

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const nf = (n: number) => Math.round(n).toLocaleString("en-US");

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
}) => putJson<Profile>("/api/profile", body);

export const getDay = (date: string) => fetchJson<Day>(`/api/days/${date}`);
export const analyzeMeal = (text: string) => postJson<Analysis>("/api/meals/analyze", { text });
export const upsertMeal = (date: string, slot: Slot, source: string, items: MealItem[]) =>
  putJson<Meal>(`/api/meals/${date}/${slot}`, { source, items });
export const deleteMeal = (date: string, slot: Slot) => deleteJson(`/api/meals/${date}/${slot}`);
