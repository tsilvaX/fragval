"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  Gavel,
  Info,
  LoaderCircle,
  Users,
  RefreshCw,
  Settings2,
  WifiOff,
} from "lucide-react";
import type { DashboardData, SetupStatus } from "@/lib/model";
import { eligibleMatch } from "@/lib/stats";
import { Overview, Comparison, Agents, Armory } from "./analytics";
import { CourtAwards } from "./court-awards";
import { MatchHistory } from "./match-history";
import { Modal } from "./primitives";
import { SetupPanel } from "./setup-panel";
const tabs = [
  { id: "overview", label: "Overview", num: "01" },
  { id: "compare", label: "Head to head", num: "02" },
  { id: "court", label: "The court", num: "03" },
  { id: "matches", label: "Match history", num: "04" },
  { id: "agents", label: "Agents", num: "05" },
  { id: "armory", label: "Armory", num: "06" },
];
export function CourtApp() {
  const [data, setData] = useState<DashboardData | null>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<"setup" | "about" | "coverage" | null>(null);
  const refreshingRef = useRef(false);
  const demoRef = useRef(false);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  useEffect(() => {
    const syncHash = () => {
      const id = window.location.hash.slice(1);
      if (id === "main-content") return;
      setTab(tabs.some((t) => t.id === id) ? id : "overview");
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    const controller = new AbortController();
    demoRef.current =
      new URLSearchParams(window.location.search).get("demo") === "1";
    fetch("/api/setup", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error("Could not check the court's connection settings.");
        const status: SetupStatus = await r.json();
        setSetup(status);
        if (!demoRef.current && status.provider === "henrik" && !status.ready)
          return;
        const response = await fetch(
          `/api/dashboard${demoRef.current ? "?demo=1" : ""}`,
          { signal: controller.signal },
        );
        const d = await response.json();
        if (!response.ok) {
          if (d.setup) setSetup(d.setup);
          throw Error(d.error ?? "Could not load the court.");
        }
        setData(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  const navigate = (id: string) => {
    setTab(id);
    window.location.hash = id;
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      const statusResponse = await fetch("/api/setup");
      if (statusResponse.ok) setSetup(await statusResponse.json());
      const r = await fetch(`/api/refresh${demoRef.current ? "?demo=1" : ""}`, {
        method: "POST",
      });
      const result = await r.json();
      if (!r.ok) {
        if (result.setup) setSetup(result.setup);
        throw Error(result.error ?? "Refresh failed.");
      }
      setData(result.data);
      setNotice(
        result.data.mode === "fixture"
          ? "Exhibition fixtures synchronized. The same deterministic results are preserved."
          : `${result.added} new matches imported. All statistics recalculated.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }
  const filteredData = data
    ? {
        ...data,
        matches: data.matches.filter((m) => eligibleMatch(m, data.act)),
      }
    : null;
  function exportData() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frag-court-${data.mode}-${data.act.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="masthead">
        <div className="masthead-inner">
          <a
            className="brand"
            href="#overview"
            aria-label="FRAG COURT home"
            onClick={() => navigate("overview")}
          >
            <span className="brand-mark">
              <Gavel size={26} strokeWidth={2} />
            </span>
            <span>
              FRAG<span className="brand-light">COURT</span>
              <small>EVERY FRAG ON THE RECORD.</small>
            </span>
          </a>
          <div className="header-right">
            <span className="private-label">
              <Users size={12} />
              SQUAD STATS
            </span>
            <button
              className="icon-button settings"
              aria-label="Court settings and data setup"
              onClick={() => setModal("setup")}
            >
              <Settings2 size={19} />
            </button>
            <button
              className="button refresh-button"
              onClick={refresh}
              disabled={refreshing || loading}
            >
              <RefreshCw size={15} className={refreshing ? "spinning" : ""} />
              <span>{refreshing ? "SYNCING…" : "REFRESH STATS"}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="nav-wrap">
        <nav className="main-nav" aria-label="Main navigation">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(t.id);
              }}
              aria-current={tab === t.id ? "page" : undefined}
              className={tab === t.id ? "active" : ""}
            >
              <span>{t.num}</span>
              {t.label}
              {t.id === "court" && <i />}
            </a>
          ))}
          <span className="nav-mode">
            <span className="live-dot" />
            {data?.mode === "fixture"
              ? "EXHIBITION MODE"
              : data
                ? "LIVE PROVIDER"
                : "COURT RECORDS"}
          </span>
        </nav>
      </div>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="context-bar">
          <div>
            <span className="status-square" />
            <strong>{data?.act.name ?? "CURRENT ACT"}</strong>
            <span className="context-slash">/</span>
            <span>COMPETITIVE</span>
            <span className="context-slash">/</span>
            <span>
              {data?.mode === "fixture" ? "FICTIONAL FRIENDS" : "YOUR SQUAD"}
            </span>
          </div>
          <button onClick={() => setModal("coverage")} className="context-sync">
            {data?.lastSync
              ? `SYNCED ${new Date(data.lastSync).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
              : "AWAITING FIRST SYNC"}
            <Info size={12} />
          </button>
        </div>
        {data?.mode === "fixture" && (
          <div className="demo-banner">
            <span>
              <b>DEMO, UNDER OATH.</b> Fictional friends. Deterministic
              fixtures. No live account data.
            </span>
            <button onClick={() => setModal("setup")}>
              Connect your squad <ArrowUpRight size={13} />
            </button>
            {demoRef.current && (
              <a href="/" className="demo-exit">
                Back to live squad ↗
              </a>
            )}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <WifiOff size={18} />
            <div>
              <strong>
                {data
                  ? "Refresh paused. Cached results are still available."
                  : "The court needs a little setup."}
              </strong>
              <p>{error}</p>
            </div>
            <button className="text-link" onClick={() => setModal("setup")}>
              Data setup <ArrowUpRight size={15} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        {loading ? (
          <div className="loading-state" role="status">
            <LoaderCircle size={28} className="spinning" />
            <p>ASSEMBLING THE EVIDENCE…</p>
          </div>
        ) : filteredData ? (
          <div key={tab} className="view-enter">
            {tab === "overview" ? (
              <Overview data={filteredData} navigate={navigate} />
            ) : tab === "compare" ? (
              <Comparison data={filteredData} />
            ) : tab === "court" ? (
              <CourtAwards data={filteredData} />
            ) : tab === "matches" ? (
              <MatchHistory
                matches={filteredData.matches}
                friends={filteredData.friends}
              />
            ) : tab === "agents" ? (
              <Agents data={filteredData} />
            ) : (
              <Armory data={filteredData} />
            )}
          </div>
        ) : (
          <SetupPanel setup={setup} refreshing={refreshing} onRetry={refresh} />
        )}
        {data && (
          <div className="coverage-foot">
            <Info size={13} />
            <span>{data.coverage}</span>
            <button onClick={() => setModal("coverage")}>Details ↗</button>
          </div>
        )}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Gavel size={19} />
            <strong>FRAG COURT</strong>
            <span>FRIENDSHIPS TEMPORARILY SUSPENDED.</span>
          </div>
          <div>
            <span>BUILT FOR THE STACK.</span>
            <button onClick={() => setModal("about")}>
              About & credits <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
        <p>
          FRAG COURT isn’t endorsed by Riot Games and doesn’t reflect the views
          or opinions of Riot Games. VALORANT and its assets are trademarks of
          Riot Games.
        </p>
      </footer>
      {modal && (
        <Modal
          title={
            modal === "setup"
              ? "Your court. Your squad."
              : modal === "coverage"
                ? "What’s on the record?"
                : "Every frag on the record."
          }
          onClose={() => setModal(null)}
        >
          {modal === "setup" ? (
            <div className="prose">
              <span className="tag">
                CURRENT PROVIDER: {data?.mode ?? "SERVER CONFIGURATION"}
              </span>
              <h3>Your tracked accounts</h3>
              <ul className="configured-roster">
                {setup?.accounts.map((p) => (
                  <li key={p.riotId}>
                    {p.riotId}
                    <span>
                      {p.consent ? "Consent confirmed" : "Consent needed"}
                    </span>
                  </li>
                ))}
              </ul>
              <h3>Start with the exhibition</h3>
              <p>
                Fixture mode needs no credentials. Every match is deterministic
                and clearly labeled. Refresh exercises the real SQLite cache
                without fabricating new results.
              </p>
              <h3>Connect real accounts</h3>
              <ol>
                <li>
                  Read <code>docs/PROVIDERS.md</code> and obtain permitted
                  provider access plus each friend’s required opt-in.
                </li>
                <li>
                  Your four Riot IDs are already configured in{" "}
                  <code>src/config/players.ts</code>.
                </li>
                <li>
                  Run <code>npm run setup:live</code> after obtaining permitted
                  provider access. Paste the key into its hidden prompt. Region
                  detection is automatic.
                </li>
                <li>
                  Restart the server and refresh. Real and fixture caches stay
                  separate.
                </li>
              </ol>
              <p>
                Riot’s official integration remains unavailable until production
                approval and RSO are in place. A key alone does not authorize
                it.
              </p>
              <h3>Open and play</h3>
              <p>
                No password or sign-in is required. Open the app and use the
                dashboard. The data-provider API key stays on the server.
              </p>
            </div>
          ) : modal === "coverage" ? (
            <div className="prose">
              <h3>{data?.act.name ?? "No act loaded"}</h3>
              <p>{data?.act.source}</p>
              {data && (
                <p>
                  {data.act.startsAt} through {data.act.endsAt} (end exclusive).
                </p>
              )}
              <p>{data?.coverage ?? "No matches synchronized yet."}</p>
              <p>
                Last successful sync:{" "}
                <strong>
                  {data?.lastSync
                    ? new Date(data.lastSync).toUTCString()
                    : "Never"}
                </strong>
                .
              </p>
              <p>
                Only completed ten-player Competitive matches are included.
                Wins, damage and percentages are calculated from the retrieved
                sample. Missing metrics show a dash.
              </p>
              {data?.warnings.map((w, i) => (
                <p className="data-warning" key={i}>
                  {w}
                </p>
              ))}
              <button
                className="button secondary"
                onClick={exportData}
                disabled={!data}
              >
                <Download size={16} />
                Export court records
              </button>
            </div>
          ) : (
            <div className="prose">
              <p>
                A VALORANT statistics court for a very opinionated friend group.
                Big talk deserves hard numbers.
              </p>
              <h3>Assets & typography</h3>
              <p>
                Agent portraits and map images are Riot Games assets served
                through{" "}
                <a
                  href="https://valorant-api.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  VALORANT-API
                </a>
                . Barlow Condensed, DM Sans and IBM Plex Mono are locally hosted
                open-source fonts under the SIL Open Font License.
              </p>
              <h3>Privacy & accuracy</h3>
              <p>
                Untracked players are anonymized before persistence. No browser
                tokens, private endpoints or scraped tracker data are used. The
                app runs in fixture mode until authorized live access is
                configured.
              </p>
              <p>
                Not endorsed by Riot Games. VALORANT, characters and related
                marks belong to Riot Games.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
