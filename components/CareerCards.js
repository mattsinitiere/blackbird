import { Mini } from "./ui";
import { LineChart, BarChart } from "./Charts";
import { X01_TARGETS } from "@/lib/constants";

const n1 = (v) => (v == null ? "—" : Number(v).toFixed(1));
const n2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const pc = (v) => (v == null ? "—" : `${Math.round(v)}%`);
const wl = (c) => (c.wins != null ? `${c.wins}-${c.games - c.wins}` : `${c.sessions} sessions`);

function Coverage({ c, what = "full dart logs" }) {
  const cov = c.coverage || {};
  const n = cov.withVisits ?? 0;
  const total = cov.games ?? 0;
  if (!total || n === total) return null;
  return (
    <div className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
      Detailed rates use the {n} of {total} games with {what}.
    </div>
  );
}

function Bars({ items, unit = "" }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0));
  return (
    <div className="career-bars">
      {items.map((i) => (
        <div key={i.label} className="career-bar">
          <span className="career-bar-label">{i.label}</span>
          <span className="career-bar-track"><span style={{ width: `${((i.value || 0) / max) * 100}%` }} /></span>
          <span className="career-bar-value">{i.value == null ? "—" : `${i.display ?? i.value}${unit}`}</span>
        </div>
      ))}
    </div>
  );
}

function X01Card({ c }) {
  const buckets = c.visitBuckets;
  return (
    <div className="card mb-12">
      <div className="between"><h3 className="section-title" style={{ margin: 0 }}>X01</h3><span className="tag">{wl(c)}</span></div>
      <div className="grid-4" style={{ marginTop: 10 }}>
        <Mini label="3-dart avg" value={n1(c.threeDartAvg)} />
        <Mini label="First 9" value={n1(c.first9Avg)} />
        <Mini label="Checkout %" value={c.checkoutChances ? pc(c.checkoutPct) : "—"} />
        <Mini label="High out" value={c.highestCheckout || "—"} />
      </div>
      <div className="grid-4" style={{ marginTop: 8 }}>
        <Mini label="High turn" value={c.highestTurn || "—"} />
        <Mini label="180s" value={c.one80s} />
        <Mini label="Tons / game" value={n2(c.tonsPerGame)} />
        <Mini label="Best leg" value={c.bestLeg ? `${c.bestLeg}d` : "—"} />
      </div>
      <div className="grid-4" style={{ marginTop: 8 }}>
        <Mini label="Busts / game" value={n2(c.bustsPerGame)} />
        <Mini label="T20 rate" value={pc(c.trebleTwentyPct)} />
        <Mini label="In the 20" value={pc(c.twentyBedPct)} />
        <Mini label="Miss %" value={pc(c.missPct)} />
      </div>
      <div className="grid-3" style={{ marginTop: 8 }}>
        <Mini label="1st dart" value={n1(c.byPosition?.[0])} />
        <Mini label="2nd dart" value={n1(c.byPosition?.[1])} />
        <Mini label="3rd dart" value={n1(c.byPosition?.[2])} />
      </div>
      {c.checkoutChances > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 4 }}>Checkouts by finish size · {c.checkoutsHit} of {c.checkoutChances} chances</div>
          <Bars items={Object.entries(c.checkoutByRange).map(([k, v]) => ({ label: k, value: v.pct ?? 0, display: v.chances ? `${v.hits}/${v.chances}` : "—" }))} />
        </div>
      )}
      {buckets && (
        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 4 }}>Visits by score</div>
          <Bars items={Object.entries(buckets).map(([k, v]) => ({ label: k, value: v }))} />
        </div>
      )}
      {c.series?.checkoutPct?.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 4 }}>Checkout % by game</div>
          <LineChart data={c.series.checkoutPct} unit="%" />
        </div>
      )}
      <Coverage c={c} />
    </div>
  );
}

function CricketCard({ c }) {
  return (
    <div className="card mb-12">
      <div className="between"><h3 className="section-title" style={{ margin: 0 }}>Cricket</h3><span className="tag">{wl(c)}</span></div>
      <div className="grid-4" style={{ marginTop: 10 }}>
        <Mini label="MPR" value={n2(c.mpr)} />
        <Mini label="Best MPR" value={n2(c.bestMpr)} />
        <Mini label="Pts / round" value={n1(c.pointsPerRound)} />
        <Mini label="Best round" value={c.marksPerRoundBest ?? "—"} />
      </div>
      <div className="grid-4" style={{ marginTop: 8 }}>
        <Mini label="Miss %" value={pc(c.missPct)} />
        <Mini label="Dead darts" value={pc(c.deadDartPct)} />
        <Mini label="Treble rate" value={pc(c.trebleRate)} />
        <Mini label="Opens on" value={c.favouriteOpener ? (c.favouriteOpener.number === "B" ? "Bull" : c.favouriteOpener.number) : "—"} />
      </div>
      {c.perNumber && (
        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 4 }}>Where your darts land (share of all darts · trebles)</div>
          <Bars items={X01_TARGETS.map((k) => ({ label: k === "B" ? "Bull" : k, value: c.perNumber[k].share ?? 0, display: `${Math.round(c.perNumber[k].share ?? 0)}% · ${c.perNumber[k].trebles}T` }))} />
        </div>
      )}
      <Coverage c={c} what="misses logged" />
    </div>
  );
}

function BaseballCard({ c }) {
  return (
    <div className="card mb-12">
      <div className="between"><h3 className="section-title" style={{ margin: 0 }}>Baseball</h3><span className="tag">{wl(c)}</span></div>
      <div className="grid-4" style={{ marginTop: 10 }}>
        <Mini label="Avg runs" value={n1(c.avgRuns)} />
        <Mini label="Best game" value={c.bestGame ?? "—"} />
        <Mini label="Big inning" value={c.biggestInning ?? "—"} />
        <Mini label="Hit rate" value={pc(c.hitRate)} />
      </div>
      {c.hitsBy && (
        <div className="grid-4" style={{ marginTop: 8 }}>
          <Mini label="Singles" value={c.hitsBy.S} />
          <Mini label="Doubles" value={c.hitsBy.D} />
          <Mini label="Trebles" value={c.hitsBy.T} />
          <Mini label="Misses" value={c.hitsBy.miss} />
        </div>
      )}
      {c.runsByInning?.some((v) => v != null) && (
        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 4 }}>Average runs by inning</div>
          <BarChart data={c.runsByInning.map((y, i) => ({ x: i + 1, y: y || 0, label: String(i + 1) }))} />
        </div>
      )}
    </div>
  );
}

function ClockCard({ c }) {
  return (
    <div className="card mb-12">
      <div className="between"><h3 className="section-title" style={{ margin: 0 }}>Around the Clock</h3><span className="tag">{wl(c)}</span></div>
      <div className="grid-4" style={{ marginTop: 10 }}>
        <Mini label="Avg darts" value={n1(c.avgDartsToFinish)} />
        <Mini label="Best" value={c.bestDartsToFinish ? `${c.bestDartsToFinish}d` : "—"} />
        <Mini label="Hit rate" value={pc(c.hitRate)} />
        <Mini label="Hardest" value={c.hardestTarget ? c.hardestTarget.target : "—"} />
      </div>
      {c.dartsPerTarget && (
        <div style={{ marginTop: 10 }}>
          <div className="tag" style={{ marginBottom: 4 }}>Average darts per target</div>
          <BarChart data={c.dartsPerTarget.map((y, i) => ({ x: i + 1, y, label: i === 20 ? "B" : String(i + 1) }))} />
        </div>
      )}
      <Coverage c={c} />
    </div>
  );
}

function SimpleCard({ title, c, items, children }) {
  return (
    <div className="card mb-12">
      <div className="between"><h3 className="section-title" style={{ margin: 0 }}>{title}</h3><span className="tag">{wl(c)}</span></div>
      <div className="grid-4" style={{ marginTop: 10 }}>
        {items.map(([label, value]) => <Mini key={label} label={label} value={value} />)}
      </div>
      {children}
      <Coverage c={c} />
    </div>
  );
}

/** Career cards for every game type the player has played. */
export default function CareerCards({ career }) {
  if (!career) return null;
  const c = career;
  return (
    <>
      {c.x01 && <X01Card c={c.x01} />}
      {c.cricket && <CricketCard c={c.cricket} />}
      {c.baseball && <BaseballCard c={c.baseball} />}
      {c.aroundTheClock && <ClockCard c={c.aroundTheClock} />}
      {c.killer && (
        <SimpleCard title="Killer" c={c.killer} items={[["Kills", c.killer.kills], ["Lives taken", c.killer.livesTaken], ["Lives lost", c.killer.livesLost], ["Self hits", c.killer.selfHits], ["Darts to killer", n1(c.killer.avgDartsToKiller)], ["Double rate", pc(c.killer.doubleHitRate)]]} />
      )}
      {c.shanghai && (
        <SimpleCard title="Shanghai" c={c.shanghai} items={[["Avg score", n1(c.shanghai.avgScore)], ["Best game", c.shanghai.bestGame ?? "—"], ["Best round", c.shanghai.bestRound ?? "—"], ["Shanghais", c.shanghai.shanghais], ["Hit rate", pc(c.shanghai.hitRate)]]} />
      )}
      {c.halveit && (
        <SimpleCard title="Halve It" c={c.halveit} items={[["Avg score", n1(c.halveit.avgScore)], ["Best", c.halveit.bestScore ?? "—"], ["Halved / game", n2(c.halveit.halvesPerGame)], ["Target hit %", pc(c.halveit.targetHitPct)]]}>
          {c.halveit.perTarget && (
            <div style={{ marginTop: 10 }}>
              <div className="tag" style={{ marginBottom: 4 }}>Hit rate by target{c.halveit.weakestTarget ? ` · weakest: ${c.halveit.weakestTarget.target}` : ""}</div>
              <Bars items={Object.entries(c.halveit.perTarget).filter(([, v]) => v.darts > 0).map(([k, v]) => ({ label: k, value: v.hitRate ?? 0, display: `${Math.round(v.hitRate ?? 0)}%` }))} />
            </div>
          )}
        </SimpleCard>
      )}
      {c.gotcha && (
        <SimpleCard title="Gotcha" c={c.gotcha} items={[["Bust rate", pc(c.gotcha.bustRate)], ["Resets dealt", c.gotcha.resetsDealt], ["Reset", `${c.gotcha.resetsReceived}×`], ["Avg darts", n1(c.gotcha.avgDartsToTarget)], ["Best", c.gotcha.bestDartsToTarget ? `${c.gotcha.bestDartsToTarget}d` : "—"]]} />
      )}
      {c.tictactoe && (
        <SimpleCard title="Tic-Tac-Toe" c={c.tictactoe} items={[["Claimed", c.tictactoe.claimed], ["Cancelled", c.tictactoe.cancelled], ["Darts / claim", n2(c.tictactoe.dartsPerClaim)], ["On the grid", pc(c.tictactoe.gridHitRate)]]} />
      )}
      {c.bobs27 && (
        <SimpleCard title="Bob's 27" c={c.bobs27} items={[["Best", c.bobs27.bestScore ?? "—"], ["Avg", n1(c.bobs27.avgScore)], ["Double rate", pc(c.bobs27.doubleHitRate)], ["Clean runs", c.bobs27.cleanRuns], ["Bust rate", pc(c.bobs27.bustRate)]]} />
      )}
      {c.checkoutDrill && (
        <SimpleCard title="Checkout Drill" c={c.checkoutDrill} items={[["Hit rate", pc(c.checkoutDrill.hitRate)], ["Darts / hit", n1(c.checkoutDrill.dartsPerHit)], ["Highest", c.checkoutDrill.highestCheckout ?? "—"], ["Double rate", pc(c.checkoutDrill.doubleHitRate)]]}>
          <div style={{ marginTop: 10 }}>
            <div className="tag" style={{ marginBottom: 4 }}>Finishes by range</div>
            <Bars items={Object.entries(c.checkoutDrill.byRange).map(([k, v]) => ({ label: k, value: v.pct ?? 0, display: v.finishes ? `${v.hits}/${v.finishes}` : "—" }))} />
          </div>
        </SimpleCard>
      )}
      {c.scoringDrill && (
        <SimpleCard title="Scoring Drill" c={c.scoringDrill} items={[["Best / visit", n1(c.scoringDrill.bestAvgPerVisit)], ["Hit rate", pc(c.scoringDrill.hitRate)], ["Treble rate", pc(c.scoringDrill.trebleRate)]]} />
      )}
    </>
  );
}
