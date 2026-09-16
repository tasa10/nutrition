"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type HealthResponse = {
  status: string;
  db: string;
};

type FetchState =
  | { phase: "loading" }
  | { phase: "success"; data: HealthResponse }
  | { phase: "error"; message: string };

export default function Home() {
  const [state, setState] = useState<FetchState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      setState({ phase: "loading" });
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: HealthResponse = await res.json();
        if (!cancelled) setState({ phase: "success", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : "unknown error",
          });
        }
      }
    }

    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl bg-white p-10 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          栄養管理アプリ
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          フロントエンド（Next.js）↔ バックエンド（Go）疎通確認
        </p>

        {state.phase === "loading" && (
          <p className="text-zinc-500 dark:text-zinc-400">確認中...</p>
        )}

        {state.phase === "success" && (
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-lg font-medium text-green-600 dark:text-green-400">
              API: {state.data.status}
            </p>
            <p className="text-lg font-medium text-green-600 dark:text-green-400">
              DB: {state.data.db}
            </p>
          </div>
        )}

        {state.phase === "error" && (
          <p className="text-center text-red-600 dark:text-red-400">
            接続に失敗しました（{state.message}）
            <br />
            バックエンドが起動しているか確認してください。
          </p>
        )}
      </main>
    </div>
  );
}
