"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import Wordmark from "@/components/Wordmark";
import {
  authEnabled,
  describeAuthError,
  resetPassword,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/firebase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!authEnabled) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted text-sm">
          ログインは無効です（開発モード）。Firebase の設定を入れるとこの画面が使えます。
        </p>
        <Link href="/" className="text-green-text text-sm underline">
          ホームへ
        </Link>
      </div>
    );
  }

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      // AuthGate notices the signed-in user and moves to the home screen.
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const em = email.trim();
    if (!em || !password) return;
    void run(() =>
      mode === "signin" ? signInWithEmail(em, password) : signUpWithEmail(em, password),
    );
  }

  function forgot() {
    const em = email.trim();
    if (!em) {
      setError("パスワード再設定にはメールアドレスを入力してください。");
      return;
    }
    void run(async () => {
      await resetPassword(em);
      setNotice(`${em} に再設定用のメールを送りました。`);
    });
  }

  const field =
    "h-12 w-full rounded-[14px] border border-line bg-field px-3.5 text-[15px] text-ink outline-none focus:border-green";

  return (
    <div className="flex flex-1 flex-col gap-[22px] px-6 pt-11 pb-9">
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <Wordmark eyebrow="WELCOME" />
        <p className="text-muted text-sm leading-[1.8]">
          ログインすると、記録がアカウントに保存されます。
        </p>
      </div>

      <button
        type="button"
        onClick={() => run(signInWithGoogle)}
        disabled={busy}
        className="border-line bg-surface flex min-h-[52px] items-center justify-center gap-2.5 rounded-full border text-[15px] font-bold disabled:opacity-40"
      >
        <span className="inline-block h-[18px] w-[18px] rounded-full bg-[conic-gradient(#4285f4_0_25%,#34a853_0_50%,#fbbc05_0_75%,#ea4335_0)]" />
        Google でログイン
      </button>

      <button
        type="button"
        onClick={() => run(signInAsGuest)}
        disabled={busy}
        className="bg-green shadow-cta flex min-h-[52px] items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white disabled:opacity-40"
      >
        <UserRound size={18} aria-hidden />
        ゲストとしてログイン
      </button>
      <p className="text-faint -mt-3 text-center text-[11px]">
        お試し用の共有アカウントです。記録は他のゲストにも見えます。
      </p>

      <div className="text-faint flex items-center gap-3 text-xs">
        <span className="bg-line h-px flex-1" />
        または
        <span className="bg-line h-px flex-1" />
      </div>

      <form onSubmit={submit} className="bg-card shadow-card flex flex-col gap-4 rounded-3xl p-5">
        <div className="bg-chip flex rounded-[14px] p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setNotice(null);
              }}
              className={`min-h-10 flex-1 rounded-[11px] text-[13px] font-medium ${
                mode === m
                  ? "bg-surface text-ink shadow-[0_1px_4px_rgba(23,21,15,0.08)]"
                  : "text-muted"
              }`}
            >
              {m === "signin" ? "ログイン" : "新規登録"}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-muted text-[13px] font-medium">メールアドレス</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-muted text-[13px] font-medium">パスワード</span>
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={field}
          />
        </label>

        {error && <p className="text-rose-text text-sm">{error}</p>}
        {notice && <p className="text-green-deep text-sm">{notice}</p>}

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="bg-green shadow-cta flex min-h-[50px] items-center justify-center rounded-full text-[15px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "処理中..." : mode === "signin" ? "ログイン" : "登録する"}
        </button>

        {mode === "signin" && (
          <button
            type="button"
            onClick={forgot}
            disabled={busy}
            className="text-faint hover:text-muted self-center text-xs underline disabled:opacity-40"
          >
            パスワードを忘れた場合
          </button>
        )}
      </form>
    </div>
  );
}
