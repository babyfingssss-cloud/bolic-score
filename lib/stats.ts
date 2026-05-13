import type { Bowler, Game, GameBowler, Team } from "./types";

export type BowlerStat = {
  bowler_id: string;
  bowler_name: string;
  team_id: string | null;
  team_name: string;
  game_count: number;
  avg_score: number; // 실점 평균
  avg_final: number; // 핸디 포함 평균
  high_score: number; // 실점 최고
  total_final: number; // 핸디 포함 누적 총점
};

export type TeamGameTotal = {
  game_id: string;
  game_name: string | null;
  played_at: string;
  bowler_count: number;
  total_score: number; // 실점 합
  total_final: number; // 핸디 포함 합
};

export type TeamStat = {
  team_id: string;
  team_name: string;
  bowler_count: number;
  game_count: number;
  avg_team_score: number; // 게임별 팀 합계 평균 (실점)
  avg_team_final: number; // 게임별 팀 합계 평균 (핸디 포함)
  avg_per_bowler_score: number; // 게임별 1인당 평균 (실점)
  avg_per_bowler_final: number; // 게임별 1인당 평균 (핸디 포함)
  total_team_final: number; // 모든 게임 누적 총점 (핸디 포함)
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum / nums.length;
}

/** 점수가 0이거나 미입력이면 핸디도 적용하지 않는다 */
function finalOf(gb: GameBowler): number {
  const s = gb.score ?? 0;
  return s > 0 ? s + gb.handicap_snapshot : 0;
}

// 게임에 참여(등록)한 모든 row를 카운트. 점수가 null이면 0으로 취급.

export function computeBowlerStats(
  bowlers: Bowler[],
  gameBowlers: GameBowler[],
  teams: Team[],
): BowlerStat[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const byBowler = new Map<string, GameBowler[]>();
  for (const gb of gameBowlers) {
    const arr = byBowler.get(gb.bowler_id) ?? [];
    arr.push(gb);
    byBowler.set(gb.bowler_id, arr);
  }
  return bowlers.map((b) => {
    const items = byBowler.get(b.id) ?? [];
    const scores = items.map((gb) => gb.score ?? 0);
    const finals = items.map((gb) => finalOf(gb));
    return {
      bowler_id: b.id,
      bowler_name: b.name,
      team_id: b.team_id,
      team_name: b.team_id ? (teamById.get(b.team_id)?.name ?? "") : "미배정",
      game_count: items.length,
      avg_score: avg(scores),
      avg_final: avg(finals),
      high_score: scores.length > 0 ? Math.max(...scores) : 0,
      total_final: finals.reduce((a, b) => a + b, 0),
    };
  });
}

export function computeTeamGameTotals(
  games: Game[],
  gameBowlers: GameBowler[],
): TeamGameTotal[] {
  const byGame = new Map<string, GameBowler[]>();
  for (const gb of gameBowlers) {
    const arr = byGame.get(gb.game_id) ?? [];
    arr.push(gb);
    byGame.set(gb.game_id, arr);
  }
  return games
    .filter((g) => byGame.has(g.id))
    .map((g) => {
      const items = byGame.get(g.id) ?? [];
      const total = items.reduce((s, gb) => s + (gb.score ?? 0), 0);
      const final = items.reduce((s, gb) => s + finalOf(gb), 0);
      return {
        game_id: g.id,
        game_name: g.name,
        played_at: g.played_at,
        bowler_count: items.length,
        total_score: total,
        total_final: final,
      };
    });
}

export function computeTeamStats(
  teams: Team[],
  bowlers: Bowler[],
  games: Game[],
  gameBowlers: GameBowler[],
): TeamStat[] {
  const bowlerTeam = new Map(bowlers.map((b) => [b.id, b.team_id]));

  // (game_id, team_id) 그룹별 합계 — 한 게임에 여러 팀이 함께 참여 가능
  // 점수 미입력 row도 0점으로 포함
  type Group = { game_id: string; team_id: string; score: number; final: number; bowlers: number };
  const groups = new Map<string, Group>();
  for (const gb of gameBowlers) {
    const tid = bowlerTeam.get(gb.bowler_id);
    if (!tid) continue;
    const key = `${gb.game_id}:${tid}`;
    const cur = groups.get(key) ?? {
      game_id: gb.game_id,
      team_id: tid,
      score: 0,
      final: 0,
      bowlers: 0,
    };
    cur.score += gb.score ?? 0;
    cur.final += finalOf(gb);
    cur.bowlers += 1;
    groups.set(key, cur);
  }

  // 팀별 누적
  type Acc = {
    scores: number[];
    finals: number[];
    perScores: number[];
    perFinals: number[];
    games: Set<string>;
  };
  const byTeam = new Map<string, Acc>();
  for (const v of groups.values()) {
    const cur = byTeam.get(v.team_id) ?? {
      scores: [],
      finals: [],
      perScores: [],
      perFinals: [],
      games: new Set(),
    };
    cur.scores.push(v.score);
    cur.finals.push(v.final);
    cur.perScores.push(v.bowlers > 0 ? v.score / v.bowlers : 0);
    cur.perFinals.push(v.bowlers > 0 ? v.final / v.bowlers : 0);
    cur.games.add(v.game_id);
    byTeam.set(v.team_id, cur);
  }

  void games; // 매개변수는 시그니처 호환을 위해 유지

  return teams.map((t) => {
    const acc = byTeam.get(t.id);
    return {
      team_id: t.id,
      team_name: t.name,
      bowler_count: bowlers.filter((b) => b.team_id === t.id).length,
      game_count: acc?.games.size ?? 0,
      avg_team_score: avg(acc?.scores ?? []),
      avg_team_final: avg(acc?.finals ?? []),
      avg_per_bowler_score: avg(acc?.perScores ?? []),
      avg_per_bowler_final: avg(acc?.perFinals ?? []),
      total_team_final: (acc?.finals ?? []).reduce((a, b) => a + b, 0),
    };
  });
}

export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}
