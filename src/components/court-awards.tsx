"use client";
import { useState } from "react";
import {
  Crown,
  Trophy,
  Crosshair,
  Anchor,
  Handshake,
  ArrowUpRight,
  Gavel,
  Info,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { AwardKey, DashboardData } from "@/lib/model";
import { calculateAwards, hasPerformanceScores } from "@/lib/stats";
import {
  Modal,
  PlayerDot,
  PlayerName,
  SectionHeading,
  TextLink,
} from "./primitives";
import { MatchRow } from "./match-history";
const awardIcons = {
  bottom: Crown,
  mvp: Trophy,
  fragger: Crosshair,
  carry: Handshake,
  liability: Anchor,
  "best-kd": TrendingUp,
  "worst-kd": TrendingDown,
};
export function CourtTeaser({
  data,
  onEnter,
}: {
  data: DashboardData;
  onEnter: () => void;
}) {
  const award = calculateAwards(
    data.matches,
    data.friends.map((f) => f.id),
    data.act,
  )[0];
  const top = award.entries[0],
    f = data.friends.find((f) => f.id === top?.playerId);
  const leaders = award.entries.filter(
    (e) => e.matchIds.length === top?.matchIds.length,
  );
  return (
    <div className="court-teaser">
      <div className="teaser-copy">
        <span className="eyebrow">
          <span className="live-dot" /> THE COURT IS IN SESSION
        </span>
        <h3>
          ALL RISE.
          <br />
          SOMEONE
          <br />
          <em>HAD TO BE LAST.</em>
        </h3>
        <p>
          Ten players. One unfortunate throne.
          <br />
          Your friends are keeping receipts.
        </p>
        <button className="lime-button" onClick={onEnter}>
          Enter the court <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="teaser-winner">
        <Crown className="crown" size={48} strokeWidth={1.25} />
        <span className="shame-number">{top?.matchIds.length ?? 0}</span>
        <div className="winner-label">
          <span className="eyebrow">BOTTOM FRAG KING</span>
          <strong>
            {top?.matchIds.length
              ? leaders.length > 1
                ? `${leaders.length}-way tie`
                : f && <PlayerName friend={f} />
              : "Throne unclaimed"}
          </strong>
          <small>SOLE 10TH-PLACE FINISHES</small>
        </div>
      </div>
    </div>
  );
}
export function CourtAwards({ data }: { data: DashboardData }) {
  const awards = calculateAwards(
    data.matches,
    data.friends.map((f) => f.id),
    data.act,
  );
  const [category, setCategory] = useState<"awards" | "kd">("awards");
  const visibleAwards = awards.filter((award) =>
    category === "kd"
      ? award.key === "best-kd" || award.key === "worst-kd"
      : award.key !== "best-kd" && award.key !== "worst-kd",
  );
  const [selectedKey, setSelectedKey] = useState<AwardKey | null>(null),
    [player, setPlayer] = useState<string | null>(null),
    [rules, setRules] = useState(false);
  const selected = awards.find((award) => award.key === selectedKey);
  const inspected = selected?.entries.find((e) => e.playerId === player);
  const mvpCoverage = awards.find((award) => award.key === "mvp")!.eligible;
  const performanceCoverage = data.matches.filter(hasPerformanceScores).length;
  return (
    <>
      <SectionHeading
        number="03"
        title="The court of public opinion."
        subtitle="Bragging rights. Questionable legacies. All backed by evidence."
        action={
          <button className="button secondary" onClick={() => setRules(true)}>
            <Info size={15} />
            Award rules
          </button>
        }
      />
      <CourtTeaser
        data={data}
        onEnter={() => {
          setSelectedKey(awards[0].key);
          setPlayer(awards[0].entries[0]?.playerId ?? null);
        }}
      />
      {mvpCoverage < data.matches.length && (
        <p className="chart-note" role="status">
          MVP data verified for {mvpCoverage} of {data.matches.length} shared
          games. Missing MVP results are excluded. Refresh stats to continue
          updating history.
        </p>
      )}
      {performanceCoverage < data.matches.length && (
        <p className="chart-note" role="status">
          Complete Performance Scores available for {performanceCoverage} of{" "}
          {data.matches.length} shared games. Games with missing scores are
          excluded from top/bottom awards and placements. ACS and kills are not
          substituted.
        </p>
      )}
      <div className="metric-tabs" role="tablist" aria-label="Court categories">
        {(["awards", "kd"] as const).map((id) => (
          <button
            key={id}
            id={`court-tab-${id}`}
            role="tab"
            aria-selected={category === id}
            aria-controls="court-awards-panel"
            tabIndex={category === id ? 0 : -1}
            className={category === id ? "active" : ""}
            onClick={() => setCategory(id)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "awards"
                  : event.key === "End"
                    ? "kd"
                    : category === "awards"
                      ? "kd"
                      : "awards";
              setCategory(next);
              document.getElementById(`court-tab-${next}`)?.focus();
            }}
          >
            {id === "awards" ? "Court awards" : "K/D"}
          </button>
        ))}
      </div>
      <div
        id="court-awards-panel"
        className={`award-grid${category === "kd" ? " award-grid-kd" : ""}`}
        role="tabpanel"
        aria-labelledby={`court-tab-${category}`}
        tabIndex={0}
      >
        {visibleAwards.map((award) => {
          const Icon = awardIcons[award.key],
            top = award.entries[0]?.matchIds.length ?? 0;
          return (
            <article
              className={`award-card ${award.key === "bottom" ? "shame" : ""}`}
              key={award.key}
            >
              <div className="award-card-top">
                <span className="award-icon">
                  <Icon size={23} strokeWidth={1.5} />
                </span>
                <span className="eyebrow">
                  {award.key === "bottom" ||
                  award.key === "liability" ||
                  award.key === "worst-kd"
                    ? "HALL OF SHAME"
                    : "HALL OF FAME"}
                </span>
              </div>
              <h3>{award.title}</h3>
              <p>{award.description}</p>
              <div className="award-ranking">
                {award.entries.map((entry, i) => {
                  const f = data.friends.find((f) => f.id === entry.playerId)!;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSelectedKey(award.key);
                        setPlayer(f.id);
                      }}
                      className={
                        top > 0 && entry.matchIds.length === top
                          ? "award-leading"
                          : ""
                      }
                    >
                      <span className="rank-number">
                        {entry.matchIds.length ===
                        award.entries[0].matchIds.length
                          ? "01"
                          : String(
                              1 +
                                award.entries.filter(
                                  (e) =>
                                    e.matchIds.length > entry.matchIds.length,
                                ).length,
                            ).padStart(2, "0")}
                      </span>
                      <PlayerDot friend={f} />
                      <PlayerName friend={f} />
                      <strong>{entry.matchIds.length}</strong>
                      <ArrowUpRight size={14} />
                    </button>
                  );
                })}
              </div>
              <div className="award-foot">
                <span>{award.eligible} qualifying matches</span>
                <TextLink
                  onClick={() => {
                    setSelectedKey(award.key);
                    setPlayer(award.entries[0]?.playerId ?? null);
                  }}
                >
                  Evidence
                </TextLink>
              </div>
            </article>
          );
        })}
      </div>
      <div className="court-note">
        <Gavel size={20} />
        <p>
          These verdicts are final. Your excuses are welcome in voice chat.
          <br />
          <span>
            Equal leaders share awards. Tied bottom players do not receive a
            sole 10th-place award.
          </span>
        </p>
      </div>
      {rules && (
        <Modal title="The rules of the court" onClose={() => setRules(false)}>
          <div className="prose">
            <p>
              Only completed, ten-player, two-team Competitive matches inside
              this act with at least two tracked friends count. Unsupported or
              incomplete scoreboards are excluded.
            </p>
            <p>
              Scoreboard placement, Top Fragger and Bottom Frag King use
              reported Riot Performance Score across all ten players. Equal
              scores share competition placement (1, 1, 3). Every player must
              have a valid Performance Score for these rankings; missing scores
              never fall back to ACS or kills.
            </p>
            <p>
              Match MVP uses the provider's official MVP, or the highest
              reported Riot Performance Score when explicit MVP metadata is
              absent. Games without either are excluded from MVP counts. ACS
              does not determine MVP. Top Fragger credits all tied highest
              Performance Scores. Bottom Frag King requires sole 10th place: a
              tie for last has rank 9 or better and receives no credit.
            </p>
            <p>
              Best K/D and Worst K/D compare kills divided by deaths across the
              entire lobby for each match, ignoring assists and combat score.
              Ties share credit. Kills with zero deaths rank above every finite
              ratio; zero kills and zero deaths are excluded from K/D awards.
            </p>
            <p>
              Friend Carry and Liability require at least two tracked
              participants. Every match ID counts once. Qualifying counts
              describe each award’s eligible sample, including matches with no
              recipient.
            </p>
            <p>
              Names of untracked participants are anonymized. Fixture results
              are fictional. Live totals cover retrieved matches only.
            </p>
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          title={`${selected.title} · Evidence`}
          onClose={() => setSelectedKey(null)}
        >
          <p className="modal-description">
            {selected.description} · {selected.eligible} qualifying matches
          </p>
          <div className="player-chips">
            {data.friends.map((f) => (
              <button
                key={f.id}
                className={player === f.id ? "selected" : ""}
                onClick={() => setPlayer(f.id)}
              >
                <PlayerDot friend={f} />
                <PlayerName friend={f} />
                <b>
                  {selected.entries.find((e) => e.playerId === f.id)?.matchIds
                    .length ?? 0}
                </b>
              </button>
            ))}
          </div>
          <div className="evidence-list">
            {inspected?.matchIds.length ? (
              data.matches
                .filter((m) => inspected.matchIds.includes(m.id))
                .map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    friends={data.friends}
                    playerId={player ?? undefined}
                  />
                ))
            ) : (
              <div className="empty-state">
                A clean record. No contributing matches for this player.
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
