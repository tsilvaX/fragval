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
} from "lucide-react";
import type { Award, DashboardData } from "@/lib/model";
import { calculateAwards } from "@/lib/stats";
import {
  AgentImage,
  Modal,
  PlayerDot,
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
                : f?.name
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
  const [selected, setSelected] = useState<Award | null>(null),
    [player, setPlayer] = useState<string | null>(null),
    [rules, setRules] = useState(false);
  const inspected = selected?.entries.find((e) => e.playerId === player);
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
          setSelected(awards[0]);
          setPlayer(awards[0].entries[0]?.playerId ?? null);
        }}
      />
      <div className="award-grid">
        {awards.map((award) => {
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
                  {award.key === "bottom" || award.key === "liability"
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
                        setSelected(award);
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
                      <span>{f.name}</span>
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
                    setSelected(award);
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
              this act count. Unsupported or incomplete scoreboards are
              excluded.
            </p>
            <p>
              Placement uses total combat score divided by rounds. All ten
              players in a supported match share the same round denominator.
              Equal scores share competition placement (1, 1, 3).
            </p>
            <p>
              Match MVP, kill leader and friend-group awards credit all tied
              leaders. Bottom Frag King requires sole 10th place: a tie for last
              has rank 9 or better and receives no credit.
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
          onClose={() => setSelected(null)}
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
                {f.name}
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
