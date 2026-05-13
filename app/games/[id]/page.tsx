"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin, useCurrentBowler } from "@/lib/client";
import {
  getActiveMatch,
  getGame,
  listGameBowlers,
  listMatchBowlers,
  updateGameBowlerScore,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Bowler, Game, GameBowler } from "@/lib/types";

type Row = {
  gb: GameBowler;
  bowler: Bowler | undefined;
};

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;
  const { admin } = useAdmin();
  const { bowlerId: currentBowlerId } = useCurrentBowler();

  const [game, setGame] = useState<Game | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const g = await getGame(gameId);
    setGame(g);
    if (!g) return;
    const [gbs, bs, activeMatch] = await Promise.all([
      listGameBowlers(gameId),
      listMatchBowlers(g.match_id),
      getActiveMatch(),
    ]);
    const byId = new Map(bs.map((b) => [b.id, b]));
    setRows(gbs.map((gb) => ({ gb, bowler: byId.get(gb.bowler_id) })));
    setActiveMatchId(activeMatch?.id ?? null);
  }, [gameId]);

  useEffect(() => {
    let mounted = true;
    refresh()
      .catch((e) => mounted && setError(String(e.message ?? e)))
      .finally(() => mounted && setLoading(false));

    const ch = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_bowlers",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          refresh().catch(() => {});
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [gameId, refresh]);

  const ranking = useMemo(() => {
    const scored = rows.map((r) => ({
      id: r.gb.id,
      final: (r.gb.score ?? 0) + r.gb.handicap_snapshot,
      hasScore: r.gb.score !== null,
    }));
    const valid = scored.filter((s) => s.hasScore).sort((a, b) => b.final - a.final);
    const rankById = new Map<string, number>();
    valid.forEach((s, i) => rankById.set(s.id, i + 1));
    return rankById;
  }, [rows]);

  function handleLocalScoreChange(id: string, score: number | null) {
    setRows((prev) =>
      prev.map((r) => (r.gb.id === id ? { ...r, gb: { ...r.gb, score } } : r)),
    );
  }

  if (loading) return <div className="text-zinc-500">불러오는 중…</div>;
  if (!game)
    return (
      <div className="space-y-4">
        <div className="text-zinc-500">게임을 찾을 수 없습니다.</div>
        <Link href="/" className="text-blue-600 hover:underline">
          ← 홈으로
        </Link>
      </div>
    );

  const allEntered = rows.length > 0 && rows.every((r) => r.gb.score !== null);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={
            activeMatchId === game.match_id
              ? "/"
              : admin
                ? `/matches/${game.match_id}`
                : "/"
          }
          className="text-sm text-blue-600 hover:underline"
        >
          ← 경기로
        </Link>
        <h1 className="text-xl font-bold mt-1">
          {game.name || new Date(game.played_at).toLocaleString()}
        </h1>
        {allEntered && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-medium">
            🏁 모든 점수 입력 완료
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-500">
          이 게임에 등록된 볼러가 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <BowlerScoreRow
              key={r.gb.id}
              row={r}
              rank={ranking.get(r.gb.id)}
              editable={admin || r.gb.bowler_id === currentBowlerId}
              isMe={r.gb.bowler_id === currentBowlerId}
              onLocalChange={(score) => handleLocalScoreChange(r.gb.id, score)}
              onError={(msg) => setError(msg)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BowlerScoreRow({
  row,
  rank,
  editable,
  isMe,
  onLocalChange,
  onError,
}: {
  row: Row;
  rank: number | undefined;
  editable: boolean;
  isMe: boolean;
  onLocalChange: (score: number | null) => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState<string>(
    row.gb.score === null ? "" : String(row.gb.score),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(text);

  // 외부 (realtime) 업데이트와 동기화 — 단, 현재 타이핑 중이 아닐 때
  useEffect(() => {
    const incoming = row.gb.score === null ? "" : String(row.gb.score);
    if (incoming !== text && lastSavedRef.current !== text) {
      // 사용자가 편집 중이면 덮어쓰지 않음
      return;
    }
    if (incoming !== text) {
      setText(incoming);
      lastSavedRef.current = incoming;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.gb.score]);

  function commit(newText: string) {
    const trimmed = newText.trim();
    let score: number | null = null;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0 || n > 300) {
        onError("점수는 0~300 사이여야 합니다.");
        return;
      }
      score = Math.round(n);
    }
    lastSavedRef.current = score === null ? "" : String(score);
    onLocalChange(score);
    updateGameBowlerScore(row.gb.id, score).catch((e) =>
      onError(String((e as Error).message ?? e)),
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setText(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(v), 500);
  }

  function handleBlur() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    commit(text);
  }

  const score = row.gb.score;
  const handi = row.gb.handicap_snapshot;
  const final = score === null ? null : score + handi;

  return (
    <li
      className={`rounded-xl border bg-white dark:bg-zinc-900 p-3 ${
        isMe
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  rank === 1
                    ? "bg-amber-500 text-white"
                    : rank === 2
                      ? "bg-zinc-400 text-white"
                      : rank === 3
                        ? "bg-amber-700 text-white"
                        : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {rank}
              </span>
            )}
            <span className="font-semibold truncate">
              {row.bowler?.name ?? "(삭제된 볼러)"}
            </span>
            {isMe && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                나
              </span>
            )}
          </div>
          {handi !== 0 && (
            <div className="text-xs text-zinc-500 mt-0.5">핸디 +{handi}</div>
          )}
        </div>

        {editable ? (
          <input
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            inputMode="numeric"
            enterKeyHint="done"
            placeholder="점수"
            aria-label={`${row.bowler?.name ?? "볼러"} 점수`}
            className="w-24 h-12 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="w-24 h-12 rounded-lg flex items-center justify-center text-xl font-bold tabular-nums bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {score ?? "–"}
          </div>
        )}

        {final !== null && (
          <div className="text-right shrink-0 min-w-[60px]">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              합계
            </div>
            <div className="text-xl font-bold tabular-nums text-blue-600">{final}</div>
          </div>
        )}
      </div>
    </li>
  );
}
