"use client";
import {
  Check,
  CircleDashed,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { SetupStatus } from "@/lib/model";

export function SetupPanel({
  setup,
  refreshing,
  onRetry,
}: {
  setup: SetupStatus | null;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const checks = [
    {
      label: "Squad configured and consent confirmed",
      done: setup?.rosterReady ?? false,
    },
    { label: "Server API key connected", done: setup?.hasKey ?? false },
    { label: "Provider access acknowledged", done: setup?.authorized ?? false },
  ];
  return (
    <section className="live-setup" aria-label="Live data setup">
      <div className="section-heading">
        <div>
          <div className="eyebrow muted">YOUR SQUAD / LIVE RECORDS</div>
          <h1>Your squad is on the docket.</h1>
          <p>
            The accounts are configured. Real statistics appear after authorized
            data access is connected.
          </p>
        </div>
        <span className="tag">
          {setup?.accounts.length ?? 0} ACCOUNTS READY
        </span>
      </div>
      <div className="roster-preview">
        {setup?.accounts.map((account, i) => (
          <article
            key={account.riotId}
            style={{ borderTopColor: account.color }}
          >
            <span className="eyebrow muted">PLAYER 0{i + 1}</span>
            <h2>{account.riotId.split("#")[0]}</h2>
            <p>#{account.riotId.split("#")[1]}</p>
            <span className="roster-status">
              <ShieldCheck size={13} />
              {account.consent ? "Consent confirmed" : "Consent needed"}
            </span>
            <div className="roster-no-data">
              Awaiting first live sync <span>—</span>
            </div>
          </article>
        ))}
      </div>
      <div className="connection-panel">
        <div>
          <KeyRound size={28} />
          <h2>
            {setup?.hasKey
              ? "Finish connecting the court."
              : "One key. Then we play."}
          </h2>
          <p>
            HenrikDev requires an API key from its dashboard. Complete its
            Discord sign-in and key request, then connect the key on the server.
          </p>
          <a
            className="button secondary"
            href="https://api.henrikdev.xyz/dashboard/"
            target="_blank"
            rel="noreferrer"
          >
            Get a provider API key <ExternalLink size={14} />
          </a>
        </div>
        <div>
          <ul className="connection-checks">
            {checks.map((c) => (
              <li key={c.label} className={c.done ? "done" : ""}>
                {c.done ? <Check size={16} /> : <CircleDashed size={16} />}
                <span>{c.label}</span>
                <b>{c.done ? "READY" : "PENDING"}</b>
              </li>
            ))}
          </ul>
          <p className="connection-command">
            After receiving the key, run <code>npm run setup:live</code> in the
            project. It prompts securely and saves the key only in your ignored
            local environment file.
          </p>
          <p className="chart-note">
            Region:{" "}
            {setup?.region === "auto"
              ? "detected from each account"
              : (setup?.region ?? "auto")}
            . No rank, main agent or match totals are assumed.
          </p>
          <div className="connection-actions">
            <button className="button" onClick={onRetry} disabled={refreshing}>
              {refreshing ? "CHECKING…" : "Check connection"}
            </button>
            <a className="text-link" href="?demo=1#overview">
              Explore labeled demo ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
