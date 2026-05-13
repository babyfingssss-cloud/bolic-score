-- 볼링 점수 앱 스키마 (V2: 경기 단위 컨트롤)
-- 주의: 기존 데이터는 모두 삭제됩니다.

drop table if exists game_bowlers cascade;
drop table if exists games cascade;
drop table if exists bowlers cascade;
drop table if exists teams cascade;
drop table if exists matches cascade;

create extension if not exists "pgcrypto";

-- 경기(세션)
create table matches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- 활성 경기는 동시에 하나만 존재
create unique index matches_one_active
  on matches ((status))
  where status = 'active';

-- 경기 안의 팀
create table teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index teams_match_id_idx on teams(match_id);

-- 경기 안의 볼러 (팀 배정은 선택)
create table bowlers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  handicap integer not null default 0,
  created_at timestamptz not null default now()
);
create index bowlers_match_id_idx on bowlers(match_id);
create index bowlers_team_id_idx on bowlers(team_id);

-- 경기 안의 게임(10프레임 한 판)
create table games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  name text,
  position smallint not null default 0,
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index games_match_id_idx on games(match_id);

-- 게임별 볼러 점수
create table game_bowlers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  bowler_id uuid not null references bowlers(id) on delete cascade,
  score integer,
  handicap_snapshot integer not null default 0,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(game_id, bowler_id)
);
create index game_bowlers_game_id_idx on game_bowlers(game_id);

-- RLS off (지인용 앱)
alter table matches disable row level security;
alter table teams disable row level security;
alter table bowlers disable row level security;
alter table games disable row level security;
alter table game_bowlers disable row level security;

-- Realtime
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table bowlers;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_bowlers;
