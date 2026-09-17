"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { postJson } from "@/lib/api";

const BASE_UNITS = [
  { value: "per_100g", label: "100gあたり" },
  { value: "per_serving", label: "1食あたり" },
] as const;

export default function NewFoodPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [baseUnit, setBaseUnit] = useState<string>(BASE_UNITS[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await postJson("/api/foods", { name: name.trim(), base_unit: baseUnit });
      router.push("/foods/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-12 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">食品を追加</h1>
          <Link
            href="/foods/"
            className="text-sm text-zinc-500 underline hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            一覧へ戻る
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">食品名</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              placeholder="例: 納豆"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">基準量</span>
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {BASE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            出典は「ユーザー登録」として保存されます。
          </p>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">登録に失敗しました（{error}）</p>
          )}

          <button
            type="submit"
            disabled={submitting || name.trim() === ""}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            {submitting ? "登録中..." : "登録する"}
          </button>
        </form>
      </main>
    </div>
  );
}
