import { supabase } from "./supabase";
import type { Bowler, Game, GameBowler, Match, Team } from "./types";

// ─────────────────────────────────────────────
// Matches
// ─────────────────────────────────────────────
export async function getActiveMatch(): Promise<Match | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMatch(name: string): Promise<Match> {
  const { data, error } = await supabase
    .from("matches")
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function finishMatch(id: string): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Teams (per-match)
// ─────────────────────────────────────────────
export async function listMatchTeams(matchId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTeam(matchId: string, name: string): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ match_id: matchId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Bowlers (per-match, optional team)
// ─────────────────────────────────────────────
export async function listMatchBowlers(matchId: string): Promise<Bowler[]> {
  const { data, error } = await supabase
    .from("bowlers")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createBowler(
  matchId: string,
  name: string,
  handicap: number,
  teamId: string | null = null,
): Promise<Bowler> {
  const { data, error } = await supabase
    .from("bowlers")
    .insert({ match_id: matchId, team_id: teamId, name, handicap })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBowler(
  id: string,
  patch: Partial<Pick<Bowler, "name" | "handicap" | "team_id">>,
): Promise<void> {
  const { error } = await supabase.from("bowlers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBowler(id: string): Promise<void> {
  const { error } = await supabase.from("bowlers").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Games (per-match)
// ─────────────────────────────────────────────
export async function listMatchGames(matchId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("match_id", matchId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getGame(id: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGame(
  matchId: string,
  bowlerIds: string[],
  name?: string,
): Promise<Game> {
  // 다음 position
  const existing = await listMatchGames(matchId);
  const nextPos = existing.length + 1;
  const defaultName = name ?? `${nextPos}게임`;

  const { data: game, error } = await supabase
    .from("games")
    .insert({ match_id: matchId, name: defaultName, position: nextPos })
    .select()
    .single();
  if (error) throw error;

  if (bowlerIds.length > 0) {
    const { data: bowlers, error: bErr } = await supabase
      .from("bowlers")
      .select("id, handicap")
      .in("id", bowlerIds);
    if (bErr) throw bErr;
    const handicapById = new Map(bowlers?.map((b) => [b.id, b.handicap]) ?? []);
    const rows = bowlerIds.map((bid, idx) => ({
      game_id: game.id,
      bowler_id: bid,
      score: null,
      handicap_snapshot: handicapById.get(bid) ?? 0,
      position: idx,
    }));
    const { error: gbErr } = await supabase.from("game_bowlers").insert(rows);
    if (gbErr) throw gbErr;
  }
  return game;
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Game bowlers
// ─────────────────────────────────────────────
export async function listGameBowlers(gameId: string): Promise<GameBowler[]> {
  const { data, error } = await supabase
    .from("game_bowlers")
    .select("*")
    .eq("game_id", gameId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GameBowler[];
}

export async function listMatchGameBowlers(matchId: string): Promise<GameBowler[]> {
  const games = await listMatchGames(matchId);
  const ids = games.map((g) => g.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("game_bowlers")
    .select("*")
    .in("game_id", ids);
  if (error) throw error;
  return (data ?? []) as GameBowler[];
}

export async function updateGameBowlerScore(
  gameBowlerId: string,
  score: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("game_bowlers")
    .update({ score })
    .eq("id", gameBowlerId);
  if (error) throw error;
}
