"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

// Bottom sheet over a dimmed backdrop; closes on backdrop tap or Escape.
export default function DetailSheet({ title, subtitle, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the sheet is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(23,21,15,0.45)]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-sheet bg-paper flex max-h-[92dvh] w-full max-w-[440px] flex-col gap-[18px] overflow-auto rounded-t-[28px] px-5 pt-3.5 pb-10"
      >
        <div className="h-1 w-10 flex-none self-center rounded-full bg-[#ded8cc]" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[22px] font-black">{title}</h2>
            {subtitle && <div className="text-faint text-xs">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-surface shadow-card flex h-10 w-10 flex-none items-center justify-center rounded-full"
            aria-label="閉じる"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
