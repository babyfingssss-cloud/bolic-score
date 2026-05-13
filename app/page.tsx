"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BowlerPickerModal } from "@/components/BowlerPickerModal";
import { useAdmin, useCurrentBowler } from "@/lib/client";
import {
  createBowler,
  createGame,
  createMatch,
  createTeam,
  deleteBowler,
  deleteGame,
  deleteTeam,
  finishMatch,
  getActiveMatch,
  listMatchBowlers,
  listMatchGameBowlers,
  listMatchGames,
  listMatchTeams,
  updateBowler,
  updateGameBowlerScore,
} from "@/lib/db";
import { computeBowlerStats, computeTeamStats, fmt } from "@/lib/stats";
import { supabase } from "@/lib/supabase";
import type { Bowler, Game, GameBowler, Match, Team } from "@/lib/types";

export default function HomePage() {
  const { admin, hydrated } = useAdmin();
  const { bowlerId, setBowlerId } = useCurrentBowler();

  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [gameBowlers, setGameBowlers] = useState<GameBowler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    const m = await getActiveMatch();
    setMatch(m);
    if (!m) {
      setTeams([]);
      setBowlers([]);
      setGames([]);
      setGameBowlers([]);
      return;
    }
    const [t, b, g, gb] = await Promise.all([
      listMatchTeams(m.id),
      listMatchBowlers(m.id),
      listMatchGames(m.id),
      listMatchGameBowlers(m.id),
    ]);
    setTeams(t);
    setBowlers(b);
    setGames(g);
    setGameBowlers(gb);
  }

  useEffect(() => {
    let mounted = true;
    loadAll()
      .catch((e) => mounted && setError(String(e.message ?? e)))
      .finally(() => mounted && setLoading(false));

    const ch = supabase
      .channel("home")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadAll().catch(() => {}),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => loadAll().catch(() => {}),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bowlers" },
        () => loadAll().catch(() => {}),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        () => loadAll().catch(() => {}),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_bowlers" },
        () => loadAll().catch(() => {}),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (!hydrated || loading) {
    return <div className="text-zinc-500">불러오는 중…</div>;
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {admin ? (
        <AdminHome
          match={match}
          teams={teams}
          bowlers={bowlers}
          games={games}
          gameBowlers={gameBowlers}
          onError={setError}
        />
      ) : (
        <UserHome
          match={match}
          teams={teams}
          bowlers={bowlers}
          games={games}
          gameBowlers={gameBowlers}
          bowlerId={bowlerId}
          setBowlerId={setBowlerId}
          onError={setError}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// 관리자 홈
// ─────────────────────────────────────────────────────────
function AdminHome({
  match,
  teams,
  bowlers,
  games,
  gameBowlers,
  onError,
}: {
  match: Match | null;
  teams: Team[];
  bowlers: Bowler[];
  games: Game[];
  gameBowlers: GameBowler[];
  onError: (msg: string) => void;
}) {
  if (!match) {
    return <StartMatch onError={onError} />;
  }
  return (
    <ActiveMatchAdmin
      match={match}
      teams={teams}
      bowlers={bowlers}
      games={games}
      gameBowlers={gameBowlers}
      onError={onError}
    />
  );
}

function StartMatch({ onError }: { onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createMatch(name.trim());
    } catch (err) {
      onError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold mb-1">새 경기 시작</h1>
        <p className="text-sm text-zinc-500">
          관리자 모드입니다. 새 경기를 시작하면 팀, 볼러, 게임을 등록할 수 있어요.
        </p>
      </section>
      <form onSubmit={handleStart} className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`경기 이름 (예: ${today} 모임)`}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="w-full rounded-lg bg-emerald-600 text-white py-3 font-medium active:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "생성 중…" : "🏁 경기 시작"}
        </button>
      </form>

      <div className="pt-2 text-center">
        <Link
          href="/matches"
          className="text-sm text-blue-600 hover:underline"
        >
          📋 이전 경기 기록 보기
        </Link>
      </div>
    </div>
  );
}

function ActiveMatchAdmin({
  match,
  teams,
  bowlers,
  games,
  gameBowlers,
  onError,
}: {
  match: Match;
  teams: Team[];
  bowlers: Bowler[];
  games: Game[];
  gameBowlers: GameBowler[];
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creatingGame, setCreatingGame] = useState(false);

  async function handleFinish() {
    if (!confirm("이 경기를 종료할까요? 종료 후엔 점수를 더 입력할 수 없어요.")) return;
    try {
      await finishMatch(match.id);
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  async function handleNewGame() {
    if (bowlers.length === 0) return;
    setSelectedIds(bowlers.map((b) => b.id));
    setPickerOpen(true);
  }

  async function startGame() {
    if (selectedIds.length === 0) return;
    setCreatingGame(true);
    try {
      const orderedIds = bowlers
        .filter((b) => selectedIds.includes(b.id))
        .map((b) => b.id);
      const g = await createGame(match.id, orderedIds);
      setPickerOpen(false);
      router.push(`/games/${g.id}`);
    } catch (err) {
      onError(String((err as Error).message ?? err));
      setCreatingGame(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* 경기 헤더 */}
      <section className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              진행 중인 경기
            </div>
            <h1 className="text-xl font-bold truncate">{match.name}</h1>
            <div className="text-xs text-zinc-500 mt-0.5">
              {new Date(match.started_at).toLocaleString()} 시작
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <button
              onClick={handleFinish}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm px-3 py-2 font-medium active:opacity-80"
            >
              🏁 경기 종료
            </button>
            <Link
              href="/matches"
              className="text-[11px] text-zinc-500 hover:underline"
            >
              📋 이전 기록
            </Link>
          </div>
        </div>
      </section>

      {/* 볼러 섹션 — 먼저 등록 */}
      <BowlerSection
        match={match}
        teams={teams}
        bowlers={bowlers}
        onError={onError}
      />

      {/* 팀 섹션 — 만든 뒤 위에서 배정 */}
      <TeamSection
        match={match}
        teams={teams}
        bowlers={bowlers}
        onError={onError}
      />

      {/* 게임 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">게임</h2>
          <button
            onClick={handleNewGame}
            disabled={bowlers.length === 0}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 font-medium active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + 새 게임
          </button>
        </div>

        {games.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-zinc-500 text-sm">
            아직 게임이 없어요. 팀과 볼러를 등록한 뒤 "+ 새 게임"으로 시작하세요.
          </div>
        ) : (
          <ul className="space-y-2">
            {games.map((g) => (
              <GameRow key={g.id} game={g} onError={onError} />
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

      {/* 볼러 선택 모달 (새 게임용, 매치 안에서 직접 가져옴) */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[90dvh] flex flex-col pb-safe">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-lg">참가 볼러 선택</h3>
              <p className="text-xs text-zinc-500 mt-1">선택한 순서대로 표시됩니다.</p>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {bowlers.map((b) => {
                const team = teams.find((t) => t.id === b.team_id);
                const checked = selectedIds.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg active:bg-zinc-100 dark:active:bg-zinc-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          checked ? prev.filter((x) => x !== b.id) : [...prev, b.id],
                        )
                      }
                      className="w-5 h-5 accent-blue-600"
                    />
                    <span className="flex-1">{b.name}</span>
                    <span className="text-sm text-zinc-500">
                      {team?.name ?? "미배정"}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
              <button
                onClick={() => setPickerOpen(false)}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 py-2 font-medium"
              >
                취소
              </button>
              <button
                onClick={startGame}
                disabled={selectedIds.length === 0 || creatingGame}
                className="flex-1 rounded-lg bg-emerald-600 text-white py-2 font-medium disabled:opacity-50"
              >
                {creatingGame ? "생성 중…" : `시작 (${selectedIds.length}명)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BowlerSection({
  match,
  teams,
  bowlers,
  onError,
}: {
  match: Match;
  teams: Team[];
  bowlers: Bowler[];
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [handi, setHandi] = useState("0");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createBowler(match.id, name.trim(), Number(handi) || 0, null);
      setName("");
      setHandi("0");
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">볼러</h2>
        <span className="text-xs text-zinc-500">{bowlers.length}명</span>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="볼러 이름"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={handi}
            onChange={(e) => setHandi(e.target.value.replace(/[^0-9-]/g, ""))}
            inputMode="numeric"
            placeholder="핸디"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-lg bg-blue-600 text-white py-2 font-medium active:bg-blue-700 disabled:opacity-50"
        >
          + 볼러 추가
        </button>
      </form>

      {bowlers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-zinc-500 text-sm">
          아직 볼러가 없어요. 위에서 추가하세요.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {bowlers.map((b) => (
            <BowlerRow key={b.id} bowler={b} teams={teams} onError={onError} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BowlerRow({
  bowler,
  teams,
  onError,
}: {
  bowler: Bowler;
  teams: Team[];
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bowler.name);
  const [handi, setHandi] = useState(String(bowler.handicap));

  useEffect(() => {
    setName(bowler.name);
    setHandi(String(bowler.handicap));
  }, [bowler.name, bowler.handicap]);

  async function save() {
    try {
      await updateBowler(bowler.id, {
        name: name.trim() || bowler.name,
        handicap: Number(handi) || 0,
      });
      setEditing(false);
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  async function remove() {
    if (!confirm(`${bowler.name}을(를) 삭제할까요?`)) return;
    try {
      await deleteBowler(bowler.id);
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  async function assignTeam(teamId: string | null) {
    try {
      await updateBowler(bowler.id, { team_id: teamId });
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm"
        />
        <input
          value={handi}
          onChange={(e) => setHandi(e.target.value.replace(/[^0-9-]/g, ""))}
          inputMode="numeric"
          className="w-14 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-center text-sm"
        />
        <button onClick={save} className="text-blue-600 text-sm font-medium">
          저장
        </button>
        <button onClick={() => setEditing(false)} className="text-zinc-500 text-sm">
          취소
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{bowler.name}</div>
        <div className="text-[11px] text-zinc-500">핸디 +{bowler.handicap}</div>
      </div>
      <select
        value={bowler.team_id ?? ""}
        onChange={(e) => assignTeam(e.target.value || null)}
        className="text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-1.5 py-1 max-w-[110px]"
      >
        <option value="">미배정</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button onClick={() => setEditing(true)} className="text-blue-600 text-xs">
        편집
      </button>
      <button onClick={remove} className="text-red-600 text-xs">
        삭제
      </button>
    </li>
  );
}

function TeamSection({
  match,
  teams,
  bowlers,
  onError,
}: {
  match: Match;
  teams: Team[];
  bowlers: Bowler[];
  onError: (msg: string) => void;
}) {
  const [teamName, setTeamName] = useState("");

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) return;
    try {
      await createTeam(match.id, teamName.trim());
      setTeamName("");
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  async function handleDeleteTeam(team: Team) {
    if (
      !confirm(
        `팀 "${team.name}"을 삭제할까요? 소속 볼러는 미배정으로 돌아갑니다.`,
      )
    )
      return;
    try {
      await deleteTeam(team.id);
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">팀</h2>
        <span className="text-xs text-zinc-500">{teams.length}개</span>
      </div>

      <form onSubmit={handleAddTeam} className="flex gap-2">
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="새 팀 이름"
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!teamName.trim()}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 font-medium active:bg-blue-700 disabled:opacity-50"
        >
          + 팀 추가
        </button>
      </form>

      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-zinc-500 text-sm">
          아직 팀이 없어요. 팀을 만들면 위에서 볼러를 배정할 수 있어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {teams.map((t) => {
            const members = bowlers.filter((b) => b.team_id === t.id);
            return (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {members.length === 0
                      ? "멤버 없음"
                      : members.map((b) => b.name).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTeam(t)}
                  className="text-sm text-red-600 ml-2"
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function GameRow({
  game,
  onError,
}: {
  game: Game;
  onError: (msg: string) => void;
}) {
  async function remove() {
    if (!confirm(`${game.name || "이 게임"}을 삭제할까요?`)) return;
    try {
      await deleteGame(game.id);
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }
  return (
    <li className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <Link href={`/games/${game.id}`} className="flex-1">
        <div className="font-medium">{game.name}</div>
        <div className="text-xs text-zinc-500">
          {new Date(game.played_at).toLocaleString()}
        </div>
      </Link>
      <button onClick={remove} className="text-sm text-red-600">
        삭제
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────
// 일반 사용자 홈
// ─────────────────────────────────────────────────────────
function UserHome({
  match,
  teams,
  bowlers,
  games,
  gameBowlers,
  bowlerId,
  setBowlerId,
  onError,
}: {
  match: Match | null;
  teams: Team[];
  bowlers: Bowler[];
  games: Game[];
  gameBowlers: GameBowler[];
  bowlerId: string | null;
  setBowlerId: (id: string | null) => void;
  onError: (msg: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!match) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
        <h1 className="text-lg font-semibold mb-2">진행 중인 경기가 없어요</h1>
        <p className="text-sm text-zinc-500">관리자가 경기를 시작하면 표시됩니다.</p>
      </div>
    );
  }

  // 활성 매치가 바뀌면 현재 볼러 ID가 더 이상 유효하지 않을 수 있음
  const me = bowlers.find((b) => b.id === bowlerId);
  const myTeam = me ? teams.find((t) => t.id === me.team_id) : undefined;
  // 선택 볼러가 현재 매치에 없으면 자동 해제
  useEffect(() => {
    if (bowlerId && bowlers.length > 0 && !bowlers.find((b) => b.id === bowlerId)) {
      setBowlerId(null);
    }
  }, [bowlerId, bowlers, setBowlerId]);

  const myGames = useMemo(() => {
    if (!bowlerId) return [];
    const myGbs = gameBowlers.filter((gb) => gb.bowler_id === bowlerId);
    const gbByGameId = new Map(myGbs.map((gb) => [gb.game_id, gb]));
    return games
      .filter((g) => gbByGameId.has(g.id))
      .map((g) => ({ game: g, gb: gbByGameId.get(g.id)! }));
  }, [bowlerId, games, gameBowlers]);

  return (
    <div className="space-y-7">
      <section className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4">
        <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          진행 중인 경기
        </div>
        <h1 className="text-xl font-bold">{match.name}</h1>
      </section>

      {me ? (
        <section className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-zinc-500">{myTeam?.name}</div>
            <h2 className="text-xl font-bold mt-0.5 truncate">
              {me.name}님 환영합니다 👋
            </h2>
            {me.handicap !== 0 && (
              <div className="text-xs text-zinc-500 mt-1">핸디 +{me.handicap}</div>
            )}
          </div>
          <button
            onClick={() => {
              if (confirm("볼러 선택을 해제할까요?")) setBowlerId(null);
            }}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 active:bg-zinc-100 dark:active:bg-zinc-800"
          >
            볼러 변경
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 p-6 text-center">
          <h2 className="text-lg font-bold mb-2">먼저 본인을 선택해주세요</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            선택한 볼러로 점수를 입력할 수 있어요.
          </p>
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-full bg-blue-600 text-white px-5 py-2.5 font-medium active:bg-blue-700"
          >
            볼러 선택하기
          </button>
        </section>
      )}

      {me && (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">내 게임</h2>
              <span className="text-xs text-zinc-500">{myGames.length}회</span>
            </div>
            {myGames.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-zinc-500 text-sm">
                아직 참여한 게임이 없어요.
              </div>
            ) : (
              <ul className="space-y-2">
                {myGames.map(({ game, gb }) => (
                  <MyScoreRow
                    key={gb.id}
                    game={game}
                    gb={gb}
                    onError={onError}
                  />
                ))}
              </ul>
            )}
          </section>

          <StatsTables
            match={match}
            teams={teams}
            bowlers={bowlers}
            games={games}
            gameBowlers={gameBowlers}
            highlightBowlerId={bowlerId ?? undefined}
            highlightTeamId={me.team_id ?? undefined}
          />
        </>
      )}

      <BowlerPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => setBowlerId(id)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 일반 사용자: 내 점수 입력 row
// ─────────────────────────────────────────────────────────
function MyScoreRow({
  game,
  gb,
  onError,
}: {
  game: Game;
  gb: GameBowler;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState(gb.score === null ? "" : String(gb.score));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(text);

  useEffect(() => {
    const incoming = gb.score === null ? "" : String(gb.score);
    if (incoming !== text && lastSavedRef.current !== text) return;
    if (incoming !== text) {
      setText(incoming);
      lastSavedRef.current = incoming;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gb.score]);

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
    updateGameBowlerScore(gb.id, score).catch((e) =>
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

  const handi = gb.handicap_snapshot;
  const final = gb.score === null ? null : gb.score + handi;

  return (
    <li className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{game.name}</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {new Date(game.played_at).toLocaleString()}
          </div>
          {handi !== 0 && (
            <div className="text-[11px] text-zinc-500 mt-0.5">핸디 +{handi}</div>
          )}
        </div>
        <input
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          inputMode="numeric"
          enterKeyHint="done"
          placeholder="점수"
          aria-label={`${game.name} 점수`}
          className="w-20 h-12 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="w-14 text-right shrink-0">
          {final !== null ? (
            <>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                합계
              </div>
              <div className="text-xl font-bold tabular-nums text-blue-600">
                {final}
              </div>
            </>
          ) : (
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              미입력
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────
// 공통: 통계 표
// ─────────────────────────────────────────────────────────
export function StatsTables({
  match,
  teams,
  bowlers,
  games,
  gameBowlers,
  highlightBowlerId,
  highlightTeamId,
}: {
  match: Match;
  teams: Team[];
  bowlers: Bowler[];
  games: Game[];
  gameBowlers: GameBowler[];
  highlightBowlerId?: string;
  highlightTeamId?: string;
}) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const isPerGame = selectedGameId !== null;

  // 탭 필터: 전체이면 그대로, 특정 게임이면 그 게임의 game_bowlers만
  const scopedGameBowlers = useMemo(
    () =>
      selectedGameId
        ? gameBowlers.filter((gb) => gb.game_id === selectedGameId)
        : gameBowlers,
    [gameBowlers, selectedGameId],
  );

  const teamStats = useMemo(
    () => computeTeamStats(teams, bowlers, games, scopedGameBowlers),
    [teams, bowlers, games, scopedGameBowlers],
  );
  const teamRanking = useMemo(
    () =>
      teamStats
        .filter((s) => s.game_count > 0)
        .sort((a, b) => b.avg_per_bowler_final - a.avg_per_bowler_final),
    [teamStats],
  );
  const bowlerStats = useMemo(
    () => computeBowlerStats(bowlers, scopedGameBowlers, teams),
    [bowlers, scopedGameBowlers, teams],
  );
  const bowlerRanking = useMemo(
    () =>
      bowlerStats
        .filter((s) => s.game_count > 0)
        .sort((a, b) => b.avg_final - a.avg_final),
    [bowlerStats],
  );
  void match;

  // 게임 자체가 없으면 통계 영역 통째로 숨김
  if (games.length === 0) return null;

  // 탭은 게임이 1개 이상 있을 때만
  const tabs =
    games.length > 0
      ? [{ id: null as string | null, label: "전체" }, ...games.map((g) => ({ id: g.id, label: g.name ?? `${g.position}게임` }))]
      : [];


  return (
    <>
      {tabs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
          {tabs.map((t) => {
            const active = (t.id ?? null) === selectedGameId;
            return (
              <button
                key={t.id ?? "all"}
                onClick={() => setSelectedGameId(t.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition active:scale-95 ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">팀별 랭킹</h2>
          <span className="text-xs text-zinc-500">핸디 포함</span>
        </div>
        <Table>
          <thead>
            <tr className="text-[11px] text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-2 pl-2 pr-1.5">순위</th>
              <th className="text-left py-2 pr-1.5">팀</th>
              <th className="text-right py-2 pr-1.5 w-9">게임</th>
              <th className="text-right py-2 pr-1.5">평균</th>
              <th className="text-right py-2 pr-2">총합</th>
            </tr>
          </thead>
          <tbody>
            {teamRanking.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-zinc-400 text-[12px]"
                >
                  점수 데이터가 없어요
                </td>
              </tr>
            ) : (
              teamRanking.map((s, i) => (
                <tr
                  key={s.team_id}
                  className={`border-b border-zinc-100 dark:border-zinc-800/60 ${
                    highlightTeamId === s.team_id
                      ? "bg-blue-50/60 dark:bg-blue-950/30"
                      : ""
                  }`}
                >
                  <td className="py-2 pl-2 pr-1.5 tabular-nums">
                    <RankBadge n={i + 1} />
                  </td>
                  <td className="py-2 pr-1.5 font-medium truncate max-w-[100px]">
                    {s.team_name}
                  </td>
                  <td className="py-2 pr-1.5 text-right tabular-nums">
                    {s.game_count}
                  </td>
                  <td className="py-2 pr-1.5 text-right tabular-nums">
                    {fmt(s.avg_per_bowler_final)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums font-semibold text-blue-600">
                    {s.total_team_final}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">개인 랭킹</h2>
          <span className="text-xs text-zinc-500">
            {isPerGame ? "실점 / 핸디 포함" : "평균 (핸디 포함)"}
          </span>
        </div>
        <Table>
          <thead>
            <tr className="text-[11px] text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-2 pl-2 pr-1.5">순위</th>
              <th className="text-left py-2 pr-1.5">볼러</th>
                {isPerGame ? (
                  <th className="text-right py-2 pr-2">점수</th>
                ) : (
                  <>
                    <th className="text-right py-2 pr-1.5 w-9">게임</th>
                    <th className="text-right py-2 pr-1.5">평균</th>
                    <th className="text-right py-2 pr-2">총점</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {bowlerRanking.length === 0 ? (
                <tr>
                  <td
                    colSpan={isPerGame ? 3 : 5}
                    className="py-4 text-center text-zinc-400 text-[12px]"
                  >
                    점수 데이터가 없어요
                  </td>
                </tr>
              ) : (
                bowlerRanking.map((s, i) => (
                  <tr
                    key={s.bowler_id}
                    className={`border-b border-zinc-100 dark:border-zinc-800/60 ${
                      highlightBowlerId === s.bowler_id
                        ? "bg-blue-50/60 dark:bg-blue-950/30"
                        : ""
                    }`}
                  >
                    <td className="py-2 pl-2 pr-1.5 tabular-nums">
                      <RankBadge n={i + 1} />
                    </td>
                    <td className="py-2 pr-1.5">
                      <div className="font-medium truncate max-w-[120px]">
                        {s.bowler_name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                        {s.team_name}
                      </div>
                    </td>
                    {isPerGame ? (
                      <td className="py-2 pr-2 text-right tabular-nums">
                        <span className="text-zinc-500">
                          {Math.round(s.avg_score)}
                        </span>
                        <span className="text-zinc-400 mx-1">/</span>
                        <span className="font-semibold text-blue-600">
                          {Math.round(s.avg_final)}
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="py-2 pr-1.5 text-right tabular-nums">
                          {s.game_count}
                        </td>
                        <td className="py-2 pr-1.5 text-right tabular-nums">
                          {fmt(s.avg_final)}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums font-semibold text-blue-600">
                          {s.total_final}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </section>
    </>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}

function RankBadge({ n }: { n: number }) {
  const cls =
    n === 1
      ? "bg-amber-500 text-white"
      : n === 2
        ? "bg-zinc-400 text-white"
        : n === 3
          ? "bg-amber-700 text-white"
          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200";
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cls}`}
    >
      {n}
    </span>
  );
}
