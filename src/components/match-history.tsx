"use client";
import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";
import type { Friend, Match } from "@/lib/model";
import { aggregate, placement, scoreboard, won } from "@/lib/stats";
import {
  AgentImage,
  fmt,
  MetricLabel,
  PlayerDot,
  SectionHeading,
  TextLink,
} from "./primitives";
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function Scoreboard({
  match,
  friends,
}: {
  match: Match;
  friends: Friend[];
}) {
  const sorted = scoreboard(match);
  return (
    <div className="scoreboard">
      <div className="scoreboard-intro">
        <span>FULL LOBBY / COMBAT SCORE ORDER</span>
        <span>Equal ACS = shared placement</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player / Agent</th>
              <th>Team</th>
              <th>K</th>
              <th>D</th>
              <th>A</th>
              <th>
                <MetricLabel metric="acs" />
              </th>
              <th>
                <MetricLabel metric="adr" />
              </th>
              <th>
                <MetricLabel metric="delta" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const f = friends.find((f) => f.id === p.id),
                a = aggregate([match], p.id);
              return (
                <tr
                  key={p.id}
                  className={f ? "tracked-row" : ""}
                  style={f ? { borderLeftColor: f.color } : undefined}
                >
                  <td>{placement(p, match)}</td>
                  <td>
                    <div className="scoreboard-player">
                      <AgentImage agent={p.agent} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          {p.agent}
                          {f ? " · TRACKED FRIEND" : " · ANONYMOUS"}
                        </small>
                      </div>
                      {f && <PlayerDot friend={f} />}
                    </div>
                  </td>
                  <td>
                    {p.team === "Red" ? "A" : "B"}
                    {won(p, match)
                      ? " · W"
                      : match.red === match.blue
                        ? " · D"
                        : " · L"}
                  </td>
                  <td>{p.kills}</td>
                  <td>{p.deaths}</td>
                  <td>{p.assists}</td>
                  <td>{fmt(a.acs)}</td>
                  <td>{fmt(a.adr)}</td>
                  <td>
                    {a.delta !== null && a.delta > 0 ? "+" : ""}
                    {fmt(a.delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        Untracked identities are anonymized before storage. Team A {match.red} :{" "}
        {match.blue} Team B · {match.id}
      </p>
    </div>
  );
}
export function MatchRow({
  match,
  friends,
  playerId,
}: {
  match: Match;
  friends: Friend[];
  playerId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const p =
    match.players.find((p) => p.id === playerId) ??
    match.players.find((p) => friends.some((f) => f.id === p.id))!;
  if (!p) return null;
  const stats = aggregate([match], p.id),
    victory = won(p, match),
    draw = match.red === match.blue;
  const count = match.players.filter((p) =>
    friends.some((f) => f.id === p.id),
  ).length;
  const supportedMap = [
    "Ascent",
    "Haven",
    "Bind",
    "Lotus",
    "Sunset",
    "Split",
    "Pearl",
  ].includes(match.map);
  return (
    <article className={`match-item ${expanded ? "is-expanded" : ""}`}>
      <button
        className="match-summary"
        aria-expanded={expanded}
        aria-controls={`score-${match.id}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className={`match-result ${draw ? "draw" : victory ? "win" : "loss"}`}
        >
          <strong>{draw ? "D" : victory ? "W" : "L"}</strong>
          <small>{date(match.startedAt)}</small>
        </div>
        <div
          className="match-map"
          style={
            supportedMap
              ? {
                  backgroundImage: `linear-gradient(90deg,rgba(24,28,26,.6),rgba(24,28,26,.05)),url(/maps/${match.map.toLowerCase()}.jpg)`,
                }
              : undefined
          }
        >
          <strong>{match.map}</strong>
          <span>COMPETITIVE</span>
        </div>
        <div className="match-agent">
          <AgentImage agent={p.agent} />
          <div>
            <strong>{p.name.split("#")[0]}</strong>
            <small>
              {p.agent} · {victory ? "Victory" : draw ? "Draw" : "Defeat"}
            </small>
          </div>
        </div>
        <div className="match-score">
          <strong>
            {p.team === "Red" ? match.red : match.blue}
            <span> : </span>
            {p.team === "Red" ? match.blue : match.red}
          </strong>
          <small>FINAL SCORE</small>
        </div>
        <div className="match-kda">
          <strong>
            {p.kills}
            <span> / {p.deaths} / </span>
            {p.assists}
          </strong>
          <small>K / D / A</small>
        </div>
        <div className="match-acs">
          <strong>{fmt(stats.acs)}</strong>
          <small>ACS</small>
        </div>
        <div className="match-place">
          <strong>
            {placement(p, match)}
            <span> / 10</span>
          </strong>
          <small>PLACEMENT</small>
        </div>
        <div className="match-friends">
          <Users size={14} />
          <span>{count}</span>
        </div>
        <ChevronDown className="expand-icon" size={18} />
      </button>
      <div id={`score-${match.id}`} hidden={!expanded}>
        {expanded && (
          <>
            <div className="expanded-metrics">
              <span>
                ADR <b>{fmt(stats.adr)}</b>
              </span>
              <span>
                HS% <b>{fmt(stats.hs, 1)}%</b>
              </span>
              <span>
                DDΔ{" "}
                <b>
                  {stats.delta !== null && stats.delta > 0 ? "+" : ""}
                  {fmt(stats.delta)}
                </b>
              </span>
              <span>
                {new Date(match.startedAt).toLocaleString("en-US", {
                  timeZone: "UTC",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                UTC
              </span>
            </div>
            <Scoreboard match={match} friends={friends} />
          </>
        )}
      </div>
    </article>
  );
}
export function MatchHistory({
  matches,
  friends,
  compact = false,
  onViewAll,
}: {
  matches: Match[];
  friends: Friend[];
  compact?: boolean;
  onViewAll?: () => void;
}) {
  const [player, setPlayer] = useState("all"),
    [map, setMap] = useState("all"),
    [result, setResult] = useState("all"),
    [page, setPage] = useState(0);
  const filtered = matches.filter(
    (m) =>
      (player === "all" || m.players.some((p) => p.id === player)) &&
      (map === "all" || m.map === map) &&
      (result === "all" ||
        m.players.some(
          (p) =>
            friends.some((f) => f.id === p.id) &&
            (player === "all" || p.id === player) &&
            (result === "win"
              ? won(p, m)
              : result === "draw"
                ? m.red === m.blue
                : m.red !== m.blue && !won(p, m)),
        )),
  );
  const size = compact ? 4 : 10,
    pages = Math.ceil(filtered.length / size);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  return (
    <section>
      <SectionHeading
        number="04"
        title={compact ? "The latest evidence." : "Every round. On record."}
        subtitle={
          compact
            ? "Recent matches from the squad."
            : "Expand a match to inspect the full lobby. Shared matches appear once."
        }
        action={
          compact && onViewAll ? (
            <TextLink onClick={onViewAll}>All matches</TextLink>
          ) : (
            <span className="tag">{matches.length} UNIQUE MATCHES</span>
          )
        }
      />
      {!compact && (
        <div className="filters">
          <Search size={16} />
          <label>
            Player
            <select
              value={player}
              onChange={(e) => {
                setPlayer(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All friends</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Map
            <select
              value={map}
              onChange={(e) => {
                setMap(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All maps</option>
              {[...new Set(matches.map((m) => m.map))].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Result
            <select
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All results</option>
              <option value="win">Victory</option>
              <option value="loss">Defeat</option>
              <option value="draw">Draw</option>
            </select>
          </label>
          <span className="filter-count">
            {filtered.length} matches ·{" "}
            {player === "all" ? "any tracked friend" : "selected friend"}
          </span>
        </div>
      )}
      <div className="match-list">
        {filtered
          .slice(
            compact ? 0 : currentPage * size,
            compact ? size : (currentPage + 1) * size,
          )
          .map((m) => (
            <MatchRow
              key={`${m.id}-${player}`}
              match={m}
              friends={friends}
              playerId={player === "all" ? undefined : player}
            />
          ))}
        {!filtered.length && (
          <div className="empty-state">
            No matches fit these filters. Try another player or map.
          </div>
        )}
      </div>
      {!compact && pages > 1 && (
        <div className="pagination">
          <span>
            Page {currentPage + 1} of {pages}
          </span>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={currentPage >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
