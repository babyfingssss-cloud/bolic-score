"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/client";
import { deleteMatch, listMatches } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Match } from "@/lib/types";

export default function MatchesPage() {
  const router = useRouter();
  const { admin, hydrated } = useAdmin();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!admin) {
      router.replace("/");
      return;
    }
    let mounted = true;
    listMatches()
      .then((m) => mounted && setMatches(m))
      .catch((e) => mounted && setError(String((e as Error).message ?? e)))
      .finally(() => mounted && setLoading(false));

    const ch = supabase
      .channel("matches-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => {
          listMatches().then((m) => mounted && setMatches(m)).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [admin, hydrated, router]);

  if (!hydrated) return <div className="text-zinc-500">불러오는 중…</div>;
  if (!admin)
    return (
      <div className="space-y-4">
        <div className="text-zinc-500">관리자 전용 페이지입니다.</div>
        <Link href="/" className="text-blue-600 hover:underline">
          ← 홈으로
        </Link>
      </div>
    );

  async function handleDelete(m: Match) {
    if (!confirm(`경기 "${m.name}"을(를) 영구 삭제할까요?`)) return;
    try {
      await deleteMatch(m.id);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    }
  }

  const finished = matches.filter((m) => m.status === "finished");
  const active = matches.find((m) => m.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 홈
        </Link>
        <h1 className="text-2xl font-bold mt-1">경기 기록</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {active && (
        <section className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            진행 중
          </div>
          <Link href="/" className="block mt-1">
            <div className="font-bold">{active.name}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {new Date(active.started_at).toLocaleString()} 시작
            </div>
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">종료된 경기</h2>
          <span className="text-xs text-zinc-500">{finished.length}건</span>
        </div>

        {loading ? (
          <div className="text-zinc-500 text-sm">불러오는 중…</div>
        ) : finished.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-zinc-500 text-sm">
            아직 종료된 경기가 없어요.
          </div>
        ) : (
          <ul className="space-y-2">
            {finished.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <Link href={`/matches/${m.id}`} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {new Date(m.started_at).toLocaleString()}
                    {m.finished_at && (
                      <> · 종료 {new Date(m.finished_at).toLocaleString()}</>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(m)}
                  className="text-sm text-red-600 ml-2"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
