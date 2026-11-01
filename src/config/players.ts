// Live mode only. Add 3–4 friends after obtaining the provider's required authorization.
// Resolve once by Riot ID; the resulting PUUID is persisted in SQLite.
export const trackedAccounts: {
  name: string;
  tag: string;
  puuid?: string;
  consent: boolean;
  color: string;
  agent: string;
}[] = [
  // { name: "PLAYER_1", tag: "TAG", consent: true, color: "#c75b35", agent: "Jett" },
];
export const fixtureFriends = [
  {
    id: "friend-1",
    name: "witness",
    tag: "DIFF",
    color: "#c75b35",
    agent: "Jett",
    rank: "Diamond 2",
  },
  {
    id: "friend-2",
    name: "alibi",
    tag: "404",
    color: "#637b91",
    agent: "Omen",
    rank: "Platinum 3",
  },
  {
    id: "friend-3",
    name: "noContest",
    tag: "GG",
    color: "#8b795b",
    agent: "Killjoy",
    rank: "Diamond 1",
  },
  {
    id: "friend-4",
    name: "pleadTheFifth",
    tag: "WHY",
    color: "#81874a",
    agent: "Sage",
    rank: "Platinum 2",
  },
];
