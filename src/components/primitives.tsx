"use client";
import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { X, ArrowUpRight, Crosshair } from "lucide-react";
import type { Friend, Aggregate, Match } from "@/lib/model";
import { aggregate } from "@/lib/stats";
import { profileAccounts, playerLabel } from "@/lib/player-names";
import catalog from "@/config/assets.json";

export const metrics = {
  acs: {
    label: "ACS",
    name: "Average combat score",
    hint: "Total combat score divided by total rounds played. Weighted by rounds, not by matches.",
    digits: 0,
  },
  kd: {
    label: "K/D",
    name: "Kill / death ratio",
    hint: "Total kills divided by total deaths. A zero-death sample with kills is undefined, shown as —.",
    digits: 2,
  },
  adr: {
    label: "ADR",
    name: "Average damage per round",
    hint: "Total damage dealt divided by total rounds played.",
    digits: 0,
  },
  winRate: {
    label: "WIN %",
    name: "Win rate",
    hint: "Wins divided by matches played. Draws count as matches, not wins.",
    digits: 1,
  },
  hs: {
    label: "HS %",
    name: "Headshot hit percentage",
    hint: "Head hits divided by head, body and leg hits. This is hit percentage, not headshot kills.",
    digits: 1,
  },
  delta: {
    label: "DDΔ",
    name: "Damage delta per round",
    hint: "Damage dealt minus damage received, divided by total rounds played.",
    digits: 0,
  },
  wins: {
    label: "WINS",
    name: "Matches won",
    hint: "Completed competitive matches won within the selected act and retrieved sample.",
    digits: 0,
  },
} as const;
export type MetricKey = keyof typeof metrics;
export function fmt(value: number | null, digits = 0) {
  return value === null ? "—" : value.toFixed(digits);
}
export function metricValue(stats: Aggregate, key: MetricKey) {
  const v = stats[key];
  return v === null
    ? "—"
    : `${key === "delta" && v > 0 ? "+" : ""}${fmt(v, metrics[key].digits)}${key === "hs" || key === "winRate" ? "%" : ""}`;
}
export function MetricLabel({ metric }: { metric: MetricKey }) {
  return (
    <abbr title={metrics[metric].hint} tabIndex={0}>
      {metrics[metric].label}
    </abbr>
  );
}
export function AgentImage({
  agent,
  full = false,
  className = "",
}: {
  agent: string;
  full?: boolean;
  className?: string;
}) {
  const name = agent.toLowerCase();
  const asset = (
    catalog.agents as Record<string, { icon: string; portrait: string }>
  )[name];
  return asset ? (
    <img
      src={full ? asset.portrait : asset.icon}
      alt={agent}
      className={className}
      loading="lazy"
      width={full ? 500 : 96}
      height={full ? 500 : 96}
    />
  ) : (
    <span className={`agent-fallback ${className}`} title={agent}>
      <Crosshair size={22} />
    </span>
  );
}
export function PlayerDot({ friend }: { friend: Friend }) {
  return <i className="player-dot" style={{ background: friend.color }} />;
}
export function AccountNames({
  accounts,
  showTags = false,
}: {
  accounts: { name: string; tag: string }[];
  showTags?: boolean;
}) {
  return (
    <span className="player-names">
      {accounts.map((account) => (
        <span
          className="player-name-line"
          key={`${account.name}#${account.tag}`}
        >
          {account.name}
          {showTags && (
            <small className="account-tag">#{account.tag}</small>
          )}{" "}
        </span>
      ))}
    </span>
  );
}
export function PlayerName({
  friend,
  showTags = false,
}: {
  friend: Friend;
  showTags?: boolean;
}) {
  return (
    <AccountNames accounts={profileAccounts(friend)} showTags={showTags} />
  );
}
export function SectionHeading({
  number,
  title,
  subtitle,
  action,
}: {
  number: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow muted">{number} / ON THE RECORD</div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={22} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function ComparisonBars({
  friends,
  matches,
  metric,
  compact = false,
}: {
  friends: Friend[];
  matches: Match[];
  metric: MetricKey;
  compact?: boolean;
}) {
  const values = friends
    .map((f) => ({ friend: f, stats: aggregate(matches, f.id) }))
    .sort(
      (a, b) => (b.stats[metric] ?? -Infinity) - (a.stats[metric] ?? -Infinity),
    );
  const min = Math.min(0, ...values.map((v) => v.stats[metric] ?? 0));
  const max = Math.max(1, ...values.map((v) => v.stats[metric] ?? 0));
  const span = max - min;
  const zero = (-min / span) * 100;
  return (
    <div className={`comparison-bars ${compact ? "compact" : ""}`}>
      <div className="bar-scale">
        <span>{fmt(min)}</span>
        <span>{metrics[metric].name} →</span>
        <span>{fmt(max, metric === "kd" ? 2 : 0)}</span>
      </div>
      {values.map(({ friend, stats }, i) => {
        const value = stats[metric];
        return (
          <div className="comparison-row" key={friend.id}>
            <span className="bar-place">
              {value === null
                ? "—"
                : String(
                    1 +
                      values.filter(
                        (v) => (v.stats[metric] ?? -Infinity) > value,
                      ).length,
                  ).padStart(2, "0")}
            </span>
            <div className="bar-player">
              <PlayerDot friend={friend} />
              <PlayerName friend={friend} />
            </div>
            <div className="bar-track">
              <span className="zero-line" style={{ left: `${zero}%` }} />
              <span
                className="bar-fill"
                style={{
                  left: `${value !== null && value < 0 ? ((value - min) / span) * 100 : zero}%`,
                  width: `${(Math.abs(value ?? 0) / span) * 100}%`,
                  background: friend.color,
                }}
              />
            </div>
            <strong>{metricValue(stats, metric)}</strong>
          </div>
        );
      })}
      <p className="chart-note">
        Zero-based scale ·{" "}
        {metric === "delta"
          ? "negative values extend left of zero"
          : "higher is better"}{" "}
        · retrieved competitive matches
      </p>
    </div>
  );
}
export function TrendChart({
  friends,
  matches,
}: {
  friends: Friend[];
  matches: Match[];
}) {
  const series = friends.map((f) => ({
    friend: f,
    values: matches
      .filter((m) => m.players.some((p) => p.id === f.id))
      .slice(0, 12)
      .reverse()
      .map((m) => aggregate([m], f.id).acs ?? 0),
  }));
  const max = Math.max(
    100,
    Math.ceil(Math.max(...series.flatMap((s) => s.values)) / 100) * 100,
  );
  return (
    <div className="trend">
      <svg
        viewBox="0 0 640 210"
        role="img"
        aria-label="Average combat score over each friend's last twelve matches, chronological left to right. The vertical scale starts at zero."
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="36"
              x2="625"
              y1={175 - v * 150}
              y2={175 - v * 150}
              stroke="currentColor"
              opacity=".15"
              strokeDasharray="3 5"
            />
            <text x="0" y={179 - v * 150} fill="currentColor" fontSize="10">
              {fmt(max * v)}
            </text>
          </g>
        ))}
        {series.map(({ friend, values }) => (
          <polyline
            key={friend.id}
            points={values
              .map(
                (v, i) =>
                  `${36 + (i / Math.max(1, values.length - 1)) * 589},${175 - (v / max) * 150}`,
              )
              .join(" ")}
            fill="none"
            stroke={friend.color}
            strokeWidth="2.5"
          >
            <title>
              {playerLabel(friend)}: {values.map((v) => fmt(v)).join(", ")} ACS
            </title>
          </polyline>
        ))}
        <text x="36" y="203" fill="currentColor" fontSize="10">
          OLDER
        </text>
        <text x="565" y="203" fill="currentColor" fontSize="10">
          LATEST
        </text>
      </svg>
      <div className="chart-legend">
        {friends.map((f) => (
          <span key={f.id}>
            <PlayerDot friend={f} />
            <PlayerName friend={f} />
          </span>
        ))}
      </div>
      <p className="chart-note">
        ACS per match · last 12 matches per player, aligned by match index, not
        date.
      </p>
    </div>
  );
}
export function playerStyle(friend: Friend): CSSProperties {
  return { "--player": friend.color } as CSSProperties;
}
