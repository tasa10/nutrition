"use client";

import {
  ChartColumn,
  Flame,
  House,
  type LucideIcon,
  MessageCircle,
  NotebookPen,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { type Stats, getStats, todayISO } from "@/lib/nutrition";

type Props = {
  children: ReactNode;
  // Bump to re-fetch XP / streak after the page records something.
  refreshKey?: number;
};

const TABS: { label: string; href: string; match: string[]; icon: LucideIcon }[] = [
  { label: "今日", href: "/", match: ["/"], icon: House },
  { label: "記録", href: "/record/", match: ["/record", "/record/search"], icon: NotebookPen },
  { label: "相談", href: "/chat/", match: ["/chat"], icon: MessageCircle },
  { label: "記録簿", href: "/history/", match: ["/history"], icon: ChartColumn },
];

export default function AppShell({ children, refreshKey = 0 }: Props) {
  const pathname = usePathname();
  const current = pathname.replace(/\/+$/, "") || "/";
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStats(todayISO())
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const level = stats?.level ?? 1;
  const xpInLevel = stats?.xp_in_level ?? 0;
  const todayMeals = stats?.today_meals ?? 0;
  const streak = stats?.streak ?? 0;

  return (
    <>
      <header className="border-track bg-paper/90 sticky top-0 z-20 flex items-center gap-3 border-b px-[18px] py-3.5 backdrop-blur-lg">
        <div className="bg-green flex h-10 w-10 flex-col items-center justify-center rounded-[13px] leading-none text-white">
          <div className="font-mono text-sm font-medium">{level}</div>
          <div className="text-[7px] tracking-[0.1em]">LV</div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] font-bold">
              {todayMeals >= 3 ? "デイリークエスト達成！" : `デイリークエスト ${todayMeals}/3食`}
            </div>
            <div className="text-faint font-mono text-[11px]">{xpInLevel} / 100 XP</div>
          </div>
          <div className="bg-track h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-green h-full rounded-full transition-[width] duration-300"
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
        </div>
        <div className="bg-amber-soft text-amber-text flex items-center gap-1 rounded-full px-[11px] py-1.5">
          <Flame size={13} className="text-amber" aria-hidden />
          <div className="font-mono text-xs">{streak}日</div>
        </div>
      </header>

      {children}

      <nav className="pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex justify-center">
        <div className="border-track bg-paper/95 pointer-events-auto flex w-full max-w-[440px] border-t px-2 pt-2 pb-[22px] backdrop-blur-xl">
          {TABS.map((t) => {
            const on = t.match.includes(current);
            return (
              <Link
                key={t.label}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 ${
                  on ? "text-ink" : "text-faint"
                }`}
              >
                <t.icon
                  size={22}
                  strokeWidth={on ? 2.4 : 1.8}
                  className={on ? "text-green" : "text-[#b8afa0]"}
                  aria-hidden
                />
                <div className={`text-[10px] ${on ? "font-bold" : ""}`}>{t.label}</div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
