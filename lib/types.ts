export type MatchStatus = "active" | "finished";

export type Match = {
  id: string;
  name: string;
  status: MatchStatus;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  match_id: string;
  name: string;
  created_at: string;
};

export type Bowler = {
  id: string;
  match_id: string;
  team_id: string | null;
  name: string;
  handicap: number;
  created_at: string;
};

export type Game = {
  id: string;
  match_id: string;
  name: string | null;
  position: number;
  played_at: string;
  created_at: string;
};

export type GameBowler = {
  id: string;
  game_id: string;
  bowler_id: string;
  score: number | null;
  handicap_snapshot: number;
  position: number;
  created_at: string;
};
