"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authEnabled, getFirebaseAuth, signOut } from "@/lib/firebase";

// Shown at the bottom of the history screen; hidden entirely in dev mode.
export default function AccountSection() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const user = getFirebaseAuth()?.currentUser ?? null;
  if (!authEnabled || !user) return null;

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
      router.replace("/login/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card shadow-card flex items-center gap-3 rounded-3xl p-5">
      <div className="bg-chip text-muted flex h-10 w-10 flex-none items-center justify-center rounded-full">
        <UserRound size={20} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-muted text-[13px] font-bold">アカウント</div>
        <div className="truncate text-sm">{user.displayName || user.email || "ログイン中"}</div>
        {user.displayName && user.email && (
          <div className="text-faint truncate text-[11px]">{user.email}</div>
        )}
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="border-line flex min-h-10 flex-none items-center gap-1.5 rounded-full border px-4 text-[13px] disabled:opacity-40"
      >
        <LogOut size={15} aria-hidden />
        ログアウト
      </button>
    </section>
  );
}
