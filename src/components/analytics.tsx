"use client";
import { useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Crosshair,
  Shield,
  Swords,
  Users,
} from "lucide-react";
import type { DashboardData, Friend } from "@/lib/model";
import { aggregate, agentStats } from "@/lib/stats";
import {
  AgentImage,
  ComparisonBars,
  fmt,
  metrics,
  metricValue,
  MetricLabel,
  type MetricKey,
  PlayerDot,
  playerStyle,
  SectionHeading,
  TextLink,
  TrendChart,
} from "./primitives";
import { CourtTeaser } from "./court-awards";
import { MatchHistory } from "./match-history";

export function PlayerCards({
  data,
  onPlayer,
}: {
  data: DashboardData;
  onPlayer: () => void;
}) {
  const [sort, setSort] = useState<MetricKey>("acs");
  const stats = data.friends
    .map((f) => ({ friend: f, stats: aggregate(data.matches, f.id) }))
    .sort(
      (a, b) => (b.stats[sort] ?? -Infinity) - (a.stats[sort] ?? -Infinity),
    );
  return (
    <section>
      <SectionHeading
        number="01"
        title="The usual suspects."
        subtitle="Same stack. Very different contributions."
        action={
          <label className="sort-control">
            <ArrowDownUp size={14} />
            <span>Sort by</span>
            <select
              aria-label="Sort players by metric"
              value={sort}
              onChange={(e) => setSort(e.target.value as MetricKey)}
            >
              {Object.entries(metrics).map(([key, m]) => (
                <option key={key} value={key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="player-grid">
        {stats.map(({ friend: f, stats: s }, i) => (
          <article className="player-card" key={f.id} style={playerStyle(f)}>
            <div className="player-art">
              <span className="player-card-index">
                {String(
                  1 +
                    stats.filter(
                      (v) =>
                        (v.stats[sort] ?? -Infinity) > (s[sort] ?? -Infinity),
                    ).length,
                ).padStart(2, "0")}
              </span>
              <span className="agent-word">{f.agent.toUpperCase()}</span>
              <AgentImage agent={f.agent} full className="player-portrait" />
              <div className="player-rank">
                <Shield size={12} />
                {f.rank ?? "Rank unavailable"}
              </div>
            </div>
            <div className="player-card-body">
              <div className="player-identity">
                <PlayerDot friend={f} />
                <h3>{f.name}</h3>
                <span>#{f.tag}</span>
              </div>
              <div className="player-featured">
                <div>
                  <span className="eyebrow">
                    <MetricLabel metric={sort} />
                  </span>
                  <strong>{metricValue(s, sort)}</strong>
                </div>
                <span
                  className={
                    s[sort] !== null &&
                    s[sort] === stats[0].stats[sort] &&
                    s.matches
                      ? "leader-pill"
                      : "sample-pill"
                  }
                >
                  {s[sort] !== null &&
                  s[sort] === stats[0].stats[sort] &&
                  s.matches
                    ? "SETTING THE PACE ↗"
                    : `${s.matches} MATCHES`}
                </span>
              </div>
              <div className="player-stat-grid">
                {(
                  ["kd", "acs", "adr", "hs", "winRate", "delta"] as MetricKey[]
                ).map((key) => (
                  <div key={key}>
                    <MetricLabel metric={key} />
                    <strong>{metricValue(s, key)}</strong>
                  </div>
                ))}
              </div>
              <div className="player-outcome">
                <span>
                  <b>{s.wins}W</b>
                  <span> / </span>
                  {s.losses}L{s.draws ? ` / ${s.draws}D` : ""}
                </span>
                <span>
                  {s.kills} / {s.deaths} / {s.assists}
                  <small> KDA</small>
                </span>
              </div>
              <div className="win-track">
                <span style={{ width: `${s.winRate}%` }} />
              </div>
              <button className="player-detail" onClick={onPlayer}>
                Compare performance <ArrowUpRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Overview({
  data,
  navigate,
}: {
  data: DashboardData;
  navigate: (tab: string) => void;
}) {
  const [metric, setMetric] = useState<MetricKey>("acs");
  const stats = data.friends.map((f) => aggregate(data.matches, f.id));
  const totalKills = stats.reduce((n, s) => n + s.kills, 0);
  const shared = data.matches.filter(
    (m) =>
      m.players.filter((p) => data.friends.some((f) => f.id === p.id)).length >=
      2,
  ).length;
  return (
    <>
      <div className="overview-hero">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> THE FRIEND GROUP. UNDER REVIEW.
          </div>
          <h1>
            BIG TALK.
            <br />
            <span>HARD NUMBERS.</span>
            <sup>™</sup>
          </h1>
          <p>Settle it on the scoreboard.</p>
        </div>
        <div className="hero-note">
          <div className="hero-crosshair">
            <Crosshair size={40} strokeWidth={1} />
          </div>
          <span className="eyebrow">NO VIBES. JUST EVIDENCE.</span>
          <p>
            The group chat has opinions.
            <br />
            We brought the receipts.
          </p>
          <div className="hero-stamp">
            SQUAD COURT
            <br />
            <strong>
              {String(data.friends.length).padStart(2, "0")} MEMBERS
            </strong>
            <span>COMPETITIVE ONLY</span>
          </div>
        </div>
      </div>
      <div className="squad-strip">
        <span>
          <Users size={17} />
          <b>{data.friends.length}</b> FRIENDS
        </span>
        <span>
          <Swords size={17} />
          <b>{data.matches.length}</b> UNIQUE MATCHES
        </span>
        <span>
          <Crosshair size={17} />
          <b>{totalKills.toLocaleString("en-US")}</b> TRACKED KILLS
        </span>
        <span>
          <b>{shared}</b> SHARED LOBBIES
        </span>
        <span className="strip-right">ALL NUMBERS. ZERO ALIBIS.</span>
      </div>
      <PlayerCards data={data} onPlayer={() => navigate("compare")} />
      <div className="overview-two-up">
        <section className="comparison-panel">
          <div className="panel-top">
            <div>
              <span className="eyebrow muted">02 / THE TALE OF THE TAPE</span>
              <h2>Who&apos;s doing the work?</h2>
            </div>
            <label className="sr-only" htmlFor="overview-metric">
              Comparison metric
            </label>
            <select
              id="overview-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricKey)}
            >
              {Object.entries(metrics)
                .filter(([k]) => k !== "wins")
                .map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.label}
                  </option>
                ))}
            </select>
          </div>
          <ComparisonBars
            friends={data.friends}
            matches={data.matches}
            metric={metric}
            compact
          />
          <TextLink onClick={() => navigate("compare")}>
            Full comparison
          </TextLink>
        </section>
        <CourtTeaser data={data} onEnter={() => navigate("court")} />
      </div>
      <MatchHistory
        friends={data.friends}
        matches={data.matches}
        compact
        onViewAll={() => navigate("matches")}
      />
    </>
  );
}
export function Comparison({ data }: { data: DashboardData }) {
  const [metric, setMetric] = useState<MetricKey>("acs");
  return (
    <>
      <SectionHeading
        number="02"
        title="The numbers pick a side."
        subtitle="One scale. Everyone on it. Compare the retrieved competitive sample."
      />
      <div
        className="metric-tabs"
        role="group"
        aria-label="Choose comparison metric"
      >
        {Object.entries(metrics).map(([key, m]) => (
          <button
            key={key}
            aria-pressed={metric === key}
            className={metric === key ? "active" : ""}
            onClick={() => setMetric(key as MetricKey)}
          >
            {m.name}
          </button>
        ))}
      </div>
      <section className="large-chart-panel">
        <div className="panel-top">
          <h2>{metrics[metric].name}</h2>
          <span className="tag">{data.matches.length} UNIQUE MATCHES</span>
        </div>
        <p className="metric-description">{metrics[metric].hint}</p>
        <ComparisonBars
          metric={metric}
          friends={data.friends}
          matches={data.matches}
        />
      </section>
      <section className="trend-panel">
        <div className="panel-top">
          <div>
            <span className="eyebrow muted">FORM CHECK</span>
            <h2>The last twelve.</h2>
          </div>
          <span className="tag">ACS / MATCH</span>
        </div>
        <TrendChart friends={data.friends} matches={data.matches} />
      </section>
      <div className="comparison-table">
        <SectionHeading number="02B" title="Side by side." />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {data.friends.map((f) => (
                  <th key={f.id}>
                    <PlayerDot friend={f} />
                    {f.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(metrics).map((k) => (
                <tr key={k}>
                  <th>
                    <MetricLabel metric={k as MetricKey} />
                  </th>
                  {data.friends.map((f) => (
                    <td key={f.id}>
                      {metricValue(
                        aggregate(data.matches, f.id),
                        k as MetricKey,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>K / D / A</th>
                {data.friends.map((f) => {
                  const s = aggregate(data.matches, f.id);
                  return (
                    <td key={f.id}>
                      {s.kills} / {s.deaths} / {s.assists}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th>Matches</th>
                {data.friends.map((f) => (
                  <td key={f.id}>{aggregate(data.matches, f.id).matches}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <AgentComparison data={data} />
    </>
  );
}
function AgentComparison({ data }: { data: DashboardData }) {
  const agents = [
    ...new Set(
      data.matches.flatMap((m) =>
        m.players
          .filter((p) => data.friends.some((f) => f.id === p.id))
          .map((p) => p.agent),
      ),
    ),
  ];
  return (
    <section>
      <SectionHeading
        number="05B"
        title="Same agent. Different story."
        subtitle="Best ACS among friends with at least 5 retrieved matches on that agent."
      />
      <div className="agent-comparison-grid">
        {agents.map((agent) => {
          const entries = data.friends
            .map((f) => ({
              f,
              s: agentStats(data.matches, f.id).find((s) => s.agent === agent),
            }))
            .filter(
              (
                v,
              ): v is { f: Friend; s: ReturnType<typeof agentStats>[number] } =>
                !!v.s && v.s.matches >= 5,
            )
            .sort((a, b) => (b.s.acs ?? 0) - (a.s.acs ?? 0));
          const first = entries[0];
          const ties = entries.filter((e) => e.s.acs === first?.s.acs);
          return (
            <div className="agent-comparison" key={agent}>
              <AgentImage agent={agent} />
              <div>
                <h3>{agent}</h3>
                <p>
                  {first
                    ? ties.length > 1
                      ? `${ties.length} tied leaders`
                      : first.f.name
                    : "Building a sample"}
                </p>
              </div>
              <strong>
                {first ? fmt(first.s.acs) : "—"}
                <small>ACS · 5+ GAMES</small>
              </strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
export function Agents({ data }: { data: DashboardData }) {
  const [player, setPlayer] = useState(data.friends[0]?.id ?? "");
  const stats = agentStats(data.matches, player);
  return (
    <>
      <SectionHeading
        number="05"
        title="Comfort picks. Uncomfortable truths."
        subtitle="Agent performance, weighted by rounds. A minimum of 5 matches makes a useful starting sample."
      />
      <div className="player-chips">
        {data.friends.map((f) => (
          <button
            key={f.id}
            className={f.id === player ? "selected" : ""}
            onClick={() => setPlayer(f.id)}
          >
            <PlayerDot friend={f} />
            {f.name}
          </button>
        ))}
      </div>
      <div className="agent-grid">
        {stats.map((s) => (
          <article className="agent-card" key={s.agent}>
            <div className="agent-card-art">
              <span className="agent-watermark">{s.agent}</span>
              <AgentImage agent={s.agent} full />
              <span
                className={`sample-badge ${s.matches < 5 ? "small-sample" : ""}`}
              >
                {s.matches < 5 ? "SMALL SAMPLE" : "5+ MATCHES"}
              </span>
            </div>
            <div className="agent-card-body">
              <div className="panel-top">
                <h3>{s.agent}</h3>
                <span className="tag">{s.matches} MATCHES</span>
              </div>
              <div className="agent-feature">
                <strong>
                  {fmt(s.winRate, 1)}
                  <span>%</span>
                </strong>
                <div>
                  WIN RATE
                  <small>
                    {s.wins}W / {s.losses}L{s.draws ? ` / ${s.draws}D` : ""}
                  </small>
                </div>
              </div>
              <div className="agent-stat-row">
                <span>
                  <MetricLabel metric="acs" />
                  <b>{fmt(s.acs)}</b>
                </span>
                <span>
                  <MetricLabel metric="kd" />
                  <b>{fmt(s.kd, 2)}</b>
                </span>
                <span>
                  <MetricLabel metric="adr" />
                  <b>{fmt(s.adr)}</b>
                </span>
              </div>
              <p className="chart-note">
                K/D is total kills ÷ total deaths.{" "}
                {s.matches < 5
                  ? "Play more before drawing conclusions."
                  : "A sample, not a skill rating."}
              </p>
            </div>
          </article>
        ))}
      </div>
      {!stats.length && (
        <div className="empty-state">No supported agent matches yet.</div>
      )}
      <AgentComparison data={data} />
    </>
  );
}
export function Armory({ data }: { data: DashboardData }) {
  const [player, setPlayer] = useState(data.friends[0]?.id ?? "");
  const participants = data.matches.flatMap((m) =>
    m.players.filter((p) => p.id === player),
  );
  const supported =
    participants.length > 0 &&
    participants.every(
      (p) => p.head !== null && p.body !== null && p.leg !== null,
    );
  const head = participants.reduce((s, p) => s + (p.head ?? 0), 0),
    body = participants.reduce((s, p) => s + (p.body ?? 0), 0),
    leg = participants.reduce((s, p) => s + (p.leg ?? 0), 0),
    total = head + body + leg;
  return (
    <>
      <SectionHeading
        number="06"
        title="Aim is a conversation starter."
        subtitle="A clear view of what the provider can tell us — and what it can’t."
      />
      <div className="player-chips">
        {data.friends.map((f) => (
          <button
            key={f.id}
            className={f.id === player ? "selected" : ""}
            onClick={() => setPlayer(f.id)}
          >
            <PlayerDot friend={f} />
            {f.name}
          </button>
        ))}
      </div>
      <section className="hit-panel">
        <div className="hit-figure">
          <svg
            viewBox="0 0 100 210"
            role="img"
            aria-label="Hit regions: head, body and legs"
          >
            <circle cx="50" cy="23" r="16" fill="var(--orange)" />
            <path
              d="M27 48h46l13 57-13 5-9-34v50H36V76l-9 34-13-5Z"
              fill="var(--ink)"
            />
            <path d="M36 131h13v64H33Zm16 0h12l3 64H52Z" fill="var(--sage)" />
          </svg>
        </div>
        <div className="hit-content">
          <span className="eyebrow muted">
            ALL WEAPONS COMBINED / RECORDED HITS
          </span>
          <h2>Where the shots landed.</h2>
          <p>
            This breakdown uses provider-reported head, body and leg hits across
            every weapon. It does not describe headshot kills or weapon-specific
            accuracy.
          </p>
          {supported && total > 0 ? (
            <>
              <div className="hit-stack">
                {[
                  { value: head, color: "var(--orange)", label: "Head" },
                  { value: body, color: "var(--ink)", label: "Body" },
                  { value: leg, color: "var(--sage)", label: "Leg" },
                ].map((v) => (
                  <span
                    key={v.label}
                    style={{
                      width: `${(v.value / total) * 100}%`,
                      background: v.color,
                    }}
                    title={`${v.label}: ${fmt((v.value / total) * 100, 1)}%`}
                  />
                ))}
              </div>
              <div className="hit-legend">
                {[
                  { value: head, label: "Head", color: "var(--orange)" },
                  { value: body, label: "Body", color: "var(--ink)" },
                  { value: leg, label: "Leg", color: "var(--sage)" },
                ].map((v) => (
                  <div key={v.label}>
                    <span>
                      <i style={{ background: v.color }} />
                      {v.label}
                    </span>
                    <strong>{fmt((v.value / total) * 100, 1)}%</strong>
                    <small>{v.value.toLocaleString("en-US")} hits</small>
                  </div>
                ))}
              </div>
              <p className="chart-note">
                {total.toLocaleString("en-US")} reported hits ·{" "}
                {participants.length} matches · hit percentages total 100%
                before rounding
              </p>
            </>
          ) : (
            <div className="empty-state">Not available from data provider.</div>
          )}
        </div>
      </section>
      <div className="weapon-section-title">
        <h2>The weapon breakdown.</h2>
        <span className="tag">DATA AVAILABILITY</span>
      </div>
      <div className="weapon-grid">
        {["Vandal", "Phantom", "Sheriff"].map((weapon, i) => (
          <article className="weapon-card" key={weapon}>
            <span className="eyebrow muted">
              0{i + 1} / {i === 2 ? "SIDEARM" : "RIFLE"}
            </span>
            <div className="weapon-art">
              <Crosshair size={44} strokeWidth={0.7} />
              <span>{weapon.toUpperCase()}</span>
            </div>
            <h3>{weapon}</h3>
            <p>Not available from data provider.</p>
            <div className="weapon-metrics">
              <span>
                Head / body / leg hits <b>—</b>
              </span>
              <span>
                Damage distribution <b>—</b>
              </span>
              <span>
                Weapon-specific performance <b>—</b>
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="data-note">
        <Shield size={20} />
        <p>
          Global shot counts don’t identify the weapon used. This integration
          doesn’t attribute hit regions or damage to individual weapons, so
          those values stay unavailable.
        </p>
      </div>
    </>
  );
}
