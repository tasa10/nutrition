"use client";

import { ChartColumn, House, type LucideIcon, MessageCircle, NotebookPen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

const TABS: { label: string; href: string; match: string[]; icon: LucideIcon }[] = [
  { label: "今日", href: "/", match: ["/"], icon: House },
  { label: "記録", href: "/record/", match: ["/record", "/record/search"], icon: NotebookPen },
  { label: "相談", href: "/chat/", match: ["/chat"], icon: MessageCircle },
  { label: "記録簿", href: "/history/", match: ["/history"], icon: ChartColumn },
];

// Wraps the tab screens with the bottom tab bar.
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname.replace(/\/+$/, "") || "/";

  return (
    <>
      {children}

      <nav className="pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex justify-center">
        <div className="border-line bg-paper/95 pointer-events-auto flex w-full max-w-[440px] border-t px-2 pt-2 pb-[22px] shadow-[0_-1px_3px_rgba(23,21,15,0.06),0_-4px_12px_rgba(23,21,15,0.05)] backdrop-blur-xl">
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
                  className={on ? "text-green" : "text-dim"}
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
