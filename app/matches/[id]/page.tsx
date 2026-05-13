"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatsTables } from "@/app/page";
import { useAdmin } from "@/lib/client";
import {
  listMatchBowlers,
  listMatchGameBowlers,
  listMatchGames,
  listMatchTeams,
  listMatches,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Bowler, Game, GameBowler, Match, Team } from "@/lib/types";

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params.id;
  const { admin, hydrated } = useAdmin();

  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [gameBowlers, setGameBowlers] = useState<GameBowler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!admin) {
      router.replace("/");
      return;
    }
    let mounted = true;
    (async () => {
      const all = await listMatches();
      const m = all.find((x) => x.id === matchId) ?? null;
      setMatch(m);
      if (!m) return;
      const [t, b, g, gb] = await Promise.all([
        listMatchTeams(matchId),
        listMatchBowlers(matchId),
        listMatchGames(matchId),
        listMatchGameBowlers(matchId),
      ]);
      if (!mounted) return;
      setTeams(t);
      setBowlers(b);
      setGames(g);
      setGameBowlers(gb);
    })()
      .catch((e) => mounted && setError(String((e as Error).message ?? e)))
      .finally(() => mounted && setLoading(false));

    const ch = supabase
      .channel(`match-detail:${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_bowlers" },
        () => {
          listMatchGameBowlers(matchId)
            .then(setGameBowlers)
            .catch(() => {});
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [admin, hydrated, matchId, router]);

  if (!hydrated || loading) {
    return <div className="text-zinc-500">불러오는 중…</div>;
  }
  if (!admin)
    return (
      <div className="space-y-4">
        <div className="text-zinc-500">관리자 전용 페이지입니다.</div>
        <Link href="/" className="text-blue-600 hover:underline">
          ← 홈으로
        </Link>
      </div>
    );
  if (!match)
    return (
      <div className="space-y-4">
        <div className="text-zinc-500">경기를 찾을 수 없습니다.</div>
        <Link href="/matches" className="text-blue-600 hover:underline">
          ← 경기 기록으로
        </Link>
      </div>
    );

  return (
    <div className="space-y-7">
      <div>
        <Link href="/matches" className="text-sm text-blue-600 hover:underline">
          ← 경기 기록
        </Link>
        <h1 className="text-2xl font-bold mt-1 truncate">{match.name}</h1>
        <div className="text-xs text-zinc-500 mt-0.5">
          {new Date(match.started_at).toLocaleString()} 시작
          {match.finished_at && (
            <> · {new Date(match.finished_at).toLocaleString()} 종료</>
          )}
        </div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          {match.status === "active" ? "진행 중" : "종료"}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* 팀 / 볼러 요약 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">팀과 볼러</h2>
        {teams.length === 0 && bowlers.filter((b) => !b.team_id).length === 0 ? (
          <div className="text-zinc-500 text-sm">기록된 팀/볼러가 없어요.</div>
        ) : (
          <ul className="space-y-2">
            {teams.map((t) => {
              const members = bowlers.filter((b) => b.team_id === t.id);
              return (
                <li
                  key={t.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {members.length === 0
                      ? "멤버 없음"
                      : members
                          .map((b) =>
                            b.handicap !== 0 ? `${b.name}(+${b.handicap})` : b.name,
                          )
                          .join(", ")}
                  </div>
                </li>
              );
            })}
            {bowlers.filter((b) => !b.team_id).length > 0 && (
              <li className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-3">
                <div className="text-xs text-zinc-500">미배정</div>
                <div className="text-sm mt-0.5">
                  {bowlers
                    .filter((b) => !b.team_id)
                    .map((b) =>
                      b.handicap !== 0 ? `${b.name}(+${b.handicap})` : b.name,
                    )
                    .join(", ")}
                </div>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* 게임 목록 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">게임</h2>
        {games.length === 0 ? (
          <div className="text-zinc-500 text-sm">기록된 게임이 없어요.</div>
        ) : (
          <ul className="space-y-2">
            {games.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <Link
                  href={`/games/${g.id}`}
                  className="flex items-center justify-between p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {new Date(g.played_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="text-xs text-blue-600">상세 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 통계 */}
      <StatsTables
        match={match}
        teams={teams}
        bowlers={bowlers}
        games={games}
        gameBowlers={gameBowlers}
      />
    </div>
  );
}
