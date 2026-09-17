"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api";

type Food = {
  id: number;
  name: string;
  source_type: string;
  base_unit: string;
  created_at: string;
  updated_at: string;
};

type FetchState =
  { phase: "loading" } | { phase: "success"; data: Food[] } | { phase: "error"; message: string };

const SOURCE_TYPE_LABEL: Record<string, string> = {
  official: "公的データ",
  user: "ユーザー登録",
};

const BASE_UNIT_LABEL: Record<string, string> = {
  per_100g: "100gあたり",
  per_serving: "1食あたり",
};

export default function FoodsPage() {
  const [state, setState] = useState<FetchState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchJson<Food[]>("/api/foods")
      .then((data) => {
        if (!cancelled) setState({ phase: "success", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : "unknown error",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-12 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">食品マスタ</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-500 underline hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              トップへ戻る
            </Link>
            <Link
              href="/foods/new/"
              className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
            >
              食品を追加
            </Link>
          </div>
        </div>

        {state.phase === "loading" && (
          <p className="text-zinc-500 dark:text-zinc-400">読み込み中...</p>
        )}

        {state.phase === "error" && (
          <p className="text-red-600 dark:text-red-400">取得に失敗しました（{state.message}）</p>
        )}

        {state.phase === "success" && state.data.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">食品データがありません。</p>
        )}

        {state.phase === "success" && state.data.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">名前</th>
                  <th className="px-4 py-3">出典</th>
                  <th className="px-4 py-3">基準量</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {state.data.map((food) => (
                  <tr key={food.id} className="text-zinc-800 dark:text-zinc-100">
                    <td className="px-4 py-3 text-zinc-500 tabular-nums dark:text-zinc-400">
                      {food.id}
                    </td>
                    <td className="px-4 py-3 font-medium">{food.name}</td>
                    <td className="px-4 py-3">
                      {SOURCE_TYPE_LABEL[food.source_type] ?? food.source_type}
                    </td>
                    <td className="px-4 py-3">
                      {BASE_UNIT_LABEL[food.base_unit] ?? food.base_unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {state.phase === "success" && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{state.data.length} 件</p>
        )}
      </main>
    </div>
  );
}
