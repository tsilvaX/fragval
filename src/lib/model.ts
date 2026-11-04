export type Mode = "fixture" | "henrik" | "riot";
export type SetupStatus = {
  provider: Mode | null;
  accounts: {
    riotId: string;
    aliases?: string[];
    consent: boolean;
    color: string;
  }[];
  hasKey: boolean;
  authorized: boolean;
  rosterReady: boolean;
  ready: boolean;
  region: string;
};
export type Act = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  source: string;
};
export type Friend = {
  id: string;
  accounts?: { id: string; name: string; tag: string }[];
  name: string;
  tag: string;
  color: string;
  agent: string;
  rank: string | null;
};
export type Participant = {
  id: string;
  name: string;
  team: "Red" | "Blue";
  agent: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  performanceScore?: number | null;
  rounds: number;
  damage: number | null;
  received: number | null;
  head: number | null;
  body: number | null;
  leg: number | null;
};
export type Match = {
  id: string;
  // Undefined means this cached match predates MVP metadata support.
  // An empty list means the provider could not verify its MVP.
  mvpIds?: string[];
  // Identifies the account mapping used to normalize this cached scoreboard.
  rosterKey?: string;
  actId: string;
  startedAt: string;
  map: string;
  queue: string;
  completed: boolean;
  red: number;
  blue: number;
  players: Participant[];
};
export type Aggregate = {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  kd: number | null;
  acs: number | null;
  adr: number | null;
  hs: number | null;
  delta: number | null;
};
export type AwardKey =
  "bottom" | "mvp" | "fragger" | "carry" | "liability" | "best-kd" | "worst-kd";
export type Award = {
  key: AwardKey;
  title: string;
  description: string;
  eligible: number;
  entries: { playerId: string; matchIds: string[] }[];
};
export type DashboardData = {
  mode: Mode;
  act: Act;
  friends: Friend[];
  matches: Match[];
  lastSync: string | null;
  coverage: string;
  warnings: string[];
};
