"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { Pause, Play, Link2, MoveUpRight } from "lucide-react";
import type { DashboardData, Friend } from "@/lib/model";
import type { squadInsights } from "@/lib/squad";
import { playerPortrait } from "@/config/portraits";

type Insights = ReturnType<typeof squadInsights>;

export function PlayerFace({
  friend,
  size = 48,
}: {
  friend: Friend;
  size?: number;
}) {
  const src = playerPortrait(friend.name);
  return (
    <span
      className="squad-face"
      style={
        {
          "--face-color": friend.color,
          width: size,
          height: size,
        } as CSSProperties
      }
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
        />
      ) : (
        <span>{friend.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

export function SquadSpotlight({
  data,
  insights,
}: {
  data: DashboardData;
  insights: Insights;
}) {
  const [paused, setPaused] = useState(false);
  const standing = insights.carriers[0];
  const carrier = data.friends.find((f) => f.id === standing?.playerId);
  const riders = carrier
    ? data.friends.filter((f) => f.id !== carrier.id).slice(0, 3)
    : [];
  const otherLeaders = insights.carriers
    .slice(1)
    .map((s) => data.friends.find((f) => f.id === s.playerId)!.name);

  return (
    <section className="squad-spotlight" aria-labelledby="cart-heading">
      <div className="cart-heading-row">
        <div>
          <span className="eyebrow">THE SQUAD TRANSPORT DEPARTMENT</span>
          <h2 id="cart-heading">
            {carrier ? (
              <>
                One engine. <em>Three passengers.</em>
              </>
            ) : (
              <>
                The cart is <em>in the garage.</em>
              </>
            )}
          </h2>
        </div>
        <span className="tag">
          LAST {insights.recentMatches} SHARED GAMES · MAX 10
        </span>
      </div>
      <div className={`carry-stage${paused || !carrier ? " is-paused" : ""}`}>
        <svg
          viewBox="0 0 800 290"
          role="img"
          aria-labelledby="cart-scene-title cart-scene-description"
          className="carry-scene"
        >
          <title id="cart-scene-title">
            {carrier
              ? `${carrier.name} is pulling the squad cart`
              : "Squad cart awaiting a carrier"}
          </title>
          <desc id="cart-scene-description">
            {carrier
              ? `${riders.map((f) => f.name).join(", ")} ride in the cart. The puller has the highest average ACS advantage over tracked teammates in the latest ten shared matches, with at least three appearances.`
              : "A carrier is chosen after at least three shared games with a positive combat-score advantage over tracked teammates."}
          </desc>
          <path d="M30 251H770" className="cart-ground" />
          <g className="cart-road" aria-hidden="true">
            <path d="M35 267h38m70 0h70m80 0h35m85 0h60m100 0h38m75 0h55" />
          </g>
          <g className="cart-wagon">
            {riders.map((friend, index) => {
              const x = 150 + index * 112;
              return (
                <g
                  key={friend.id}
                  className={`cart-passenger cart-passenger-${index}`}
                  data-player={friend.id}
                >
                  <path
                    d={`M${x + 35} 113v57m0-37l-30 28m30-28l30 28m-30 9l22 22h25`}
                    stroke={friend.color}
                    className="cart-person-body"
                  />
                  <foreignObject x={x} y="44" width="72" height="72">
                    <PlayerFace friend={friend} size={72} />
                  </foreignObject>
                </g>
              );
            })}
            <path d="M480 181l147-12" className="cart-handle" />
            <path d="M90 151h404l-23 66H114z" className="cart-bed" />
            <path
              d="M108 174h376M115 194h361M178 153l10 61M301 153v62M419 153l-10 61"
              className="cart-slats"
            />
            <text x="295" y="191" textAnchor="middle" className="cart-label">
              PREMIUM PASSENGERS
            </text>
          </g>
          {[174, 419].map((x) => (
            <g key={x} transform={`translate(${x} 226)`}>
              <circle r="25" className="cart-tire" />
              <g className="cart-wheel">
                <path d="M0-18v36m-18-18h36m-31-13l26 26m-26 0l26-26" />
                <circle r="6" />
              </g>
            </g>
          ))}
          {carrier ? (
            <g className="cart-puller" data-player={carrier.id}>
              <g className="cart-stride-back">
                <path
                  d="M664 191l-31 34-25 20"
                  className="cart-person-body"
                  stroke={carrier.color}
                />
              </g>
              <g className="cart-stride-front">
                <path
                  d="M664 191l29 30 22 24"
                  className="cart-person-body"
                  stroke={carrier.color}
                />
              </g>
              <g className="cart-puller-upper">
                <path
                  d="M695 121l-31 70m18-42l-21 22-35-2m61-32l24 28 23-8"
                  className="cart-person-body"
                  stroke={carrier.color}
                />
                <foreignObject x="670" y="52" width="76" height="76">
                  <PlayerFace friend={carrier} size={76} />
                </foreignObject>
                <path
                  d="M750 119l13-7m-12 20h17m-23 11l13 8"
                  className="cart-effort"
                />
              </g>
            </g>
          ) : (
            <text x="650" y="162" textAnchor="middle" className="cart-awaiting">
              ENGINE WANTED
            </text>
          )}
        </svg>
        {carrier && (
          <button
            className="cart-pause"
            onClick={() => setPaused((v) => !v)}
            aria-pressed={paused}
            aria-label={paused ? "Play cart animation" : "Pause cart animation"}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
      </div>
      <div className="carry-caption">
        <div>
          <span className="eyebrow">
            {carrier ? "TODAY’S DESIGNATED ENGINE" : "NO VOLUNTEERS. YET."}
          </span>
          <h3>
            {carrier?.name ?? "Waiting for a clear carry"}
            {carrier && <MoveUpRight size={23} />}
          </h3>
          <p>
            {standing && carrier
              ? `${standing.advantage.toFixed(0)} ACS above the tracked team average · ${standing.matches} recent games.`
              : "Play three shared games to get the wheels turning. Nobody gets assigned a carry on vibes."}
          </p>
          {otherLeaders.length > 0 && (
            <p className="carry-tie">
              Shared lead with {otherLeaders.join(" and ")}. {carrier?.name}{" "}
              takes this shift.
            </p>
          )}
        </div>
        {carrier && (
          <div className="cart-manifest">
            <span className="eyebrow">PRECIOUS CARGO</span>
            <div>
              {riders.map((f) => (
                <span key={f.id}>
                  <PlayerFace friend={f} size={30} />
                  {f.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <details className="squad-methods">
        <summary>How the squad earns its titles</summary>
        <p>
          Titles recalculate whenever match data updates. K/D uses total kills ÷
          total deaths, ignoring assists. MVPs and sole bottom finishes use the
          entire ten-player lobby. Equal totals share titles; zero awards do not
          earn one. Metronome measures the lowest relative variation in match
          ACS, with at least three games per player and two qualifying players.
        </p>
        <p>
          The cart uses the latest ten unique act matches with at least two
          tracked players on the same team. For each appearance, we subtract
          that tracked team’s average ACS from the player’s ACS, then average
          the advantages. A puller needs three appearances and a positive
          advantage. Equal leaders share credit; one takes the illustrated
          shift. Assists are not added to K/D.
        </p>
        <p>
          Duos require three same-team games. We choose disjoint pairings for as
          many squad members as possible, maximizing the sum of adjusted win
          rates: (wins + 1) ÷ (games + 2). Ties use more shared games, then
          higher combined ACS. Opposing teams do not count as a duo. All results
          cover the retrieved act sample.
        </p>
      </details>
      <div className="duo-section">
        <div className="duo-heading">
          <Link2 size={18} />
          <h3>Partners in crime.</h3>
          <span>THE BEST FIT FOR THE WHOLE STACK</span>
        </div>
        {insights.duos.length ? (
          <div className="duo-grid">
            {insights.duos.map((duo) => {
              const pair = duo.playerIds.map((id) =>
                data.friends.find((f) => f.id === id)!,
              );
              return (
                <article className="duo-card" key={duo.playerIds.join(":")}>
                  <div className="duo-faces">
                    {pair.map((f) => (
                      <PlayerFace key={f.id} friend={f} size={42} />
                    ))}
                    <Link2 size={14} />
                  </div>
                  <div>
                    <h4>{pair.map((f) => f.name).join(" + ")}</h4>
                    <p>
                      {duo.wins}W / {duo.matches - duo.wins - duo.draws}L
                      {duo.draws ? ` / ${duo.draws}D` : ""} · {duo.matches}{" "}
                      games together
                    </p>
                  </div>
                  <strong>
                    {duo.winRate.toFixed(0)}
                    <small>% WIN</small>
                  </strong>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="duo-empty">
            Chemistry takes a sample. Duo pairings unlock after three games on
            the same team.
          </p>
        )}
        {insights.duos.length > 0 &&
          data.friends.some(
            (f) => !insights.duos.some((d) => d.playerIds.includes(f.id)),
          ) && (
            <p className="duo-empty">
              Unpaired players need more shared games with an available
              teammate.
            </p>
          )}
      </div>
    </section>
  );
}
