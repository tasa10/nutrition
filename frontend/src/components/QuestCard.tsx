import { Flame } from "lucide-react";
import { type Stats } from "@/lib/nutrition";

// Level, daily quest progress and streak. Shown on the record and history screens.
export default function QuestCard({ stats }: { stats: Stats | null }) {
  const level = stats?.level ?? 1;
  const xpInLevel = stats?.xp_in_level ?? 0;
  const todayMeals = stats?.today_meals ?? 0;
  const streak = stats?.streak ?? 0;

  return (
    <section className="bg-card shadow-card flex items-center gap-3 rounded-[22px] px-[18px] py-4">
      <div className="bg-green flex h-10 w-10 flex-none flex-col items-center justify-center rounded-[13px] leading-none text-white">
        <div className="font-mono text-sm font-medium">{level}</div>
        <div className="text-[7px] tracking-[0.1em]">LV</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-bold">
            {todayMeals >= 3 ? "デイリークエスト達成！" : `デイリークエスト ${todayMeals}/3食`}
          </div>
          <div className="text-faint font-mono text-[11px]">{xpInLevel} / 100 XP</div>
        </div>
        <div className="bg-line h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-green h-full rounded-full transition-[width] duration-300"
            style={{ width: `${xpInLevel}%` }}
          />
        </div>
      </div>
      <div className="bg-amber-soft text-amber-text flex flex-none items-center gap-1 rounded-full px-[11px] py-1.5">
        <Flame size={13} className="text-amber" aria-hidden />
        <div className="font-mono text-xs">{streak}日</div>
      </div>
    </section>
  );
}
