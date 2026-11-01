// Live roster. The operator confirmed all four owners' consent on 2026-10-31.
// Provider access/authorization is configured separately on the server.
// Resolve once by Riot ID; the resulting PUUID is persisted in SQLite.
export type TrackedAccount = {
  name: string;
  tag: string;
  puuid?: string;
  consent: boolean;
  color: string;
  agent: string;
};
export const trackedAccounts: TrackedAccount[] = [
  {
    name: "Mini Wo0t",
    tag: "ESP1",
    consent: true,
    color: "#c75b35",
    agent: "Unknown",
  },
  {
    name: "HomelessSlayer94",
    tag: "142",
    consent: true,
    color: "#637b91",
    agent: "Unknown",
  },
  {
    name: "kotoris kitten",
    tag: "6874",
    consent: true,
    color: "#8b795b",
    agent: "Unknown",
  },
  {
    name: "kotooriiii",
    tag: "4236",
    consent: true,
    color: "#81874a",
    agent: "Unknown",
  },
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
