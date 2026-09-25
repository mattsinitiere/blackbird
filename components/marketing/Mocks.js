/**
 * Static, coded mock-ups of app screens for the feature pages. Example data
 * only: nothing here reads a session or the database.
 */

function Frame({ label, pill, title, children, footer }) {
  return (
    <figure className="mk-mock">
      <div className="mk-match-head">
        <div>
          <span className="mk-label">{label}</span>
          {title && <h3>{title}</h3>}
        </div>
        {pill && <span className="mk-pill">{pill}</span>}
      </div>
      {children}
      {footer && <figcaption className="mk-preview-footer">{footer}</figcaption>}
    </figure>
  );
}

function Bars({ values, max = 100, labels }) {
  return (
    <div aria-hidden="true" className="mk-bars">
      {values.map((v, i) => (
        <div key={i}>
          <span style={{ height: `${Math.round((v / max) * 100)}%` }} />
          {labels && <small>{labels[i]}</small>}
        </div>
      ))}
    </div>
  );
}

function Scoring() {
  return (
    <Frame label="GAME NIGHT" pill="LEG 1 OF 3" title={<>501 <span> / DOUBLE OUT</span></>} footer={<span>Undo · Best of 3 · Double out</span>}>
      <div className="mk-mock-split">
        <div className="mk-player mk-active">
          <div className="mk-player-name">
            <span className="mk-avatar">Y</span>You <span className="mk-turn-label">YOUR THROW</span>
          </div>
          <div className="mk-big-score">161</div>
          <div className="mk-player-stat">
            <span>3-DART AVERAGE</span>
            <strong>70.0</strong>
          </div>
        </div>
        <div className="mk-player">
          <div className="mk-player-name">
            <span className="mk-avatar mk-gray">R</span>Rival
          </div>
          <div className="mk-big-score mk-muted">245</div>
          <div className="mk-player-stat">
            <span>3-DART AVERAGE</span>
            <strong>85.3</strong>
          </div>
        </div>
      </div>
      <div className="mk-darts">
        <span>T20<small>60</small></span>
        <span>T20<small>60</small></span>
        <span>20<small>20</small></span>
      </div>
    </Frame>
  );
}

function Report() {
  return (
    <Frame label="MATCH REPORT" pill="BEST OF 3" title="You win, 2–1" footer={<span>Remaining score, dart by dart</span>}>
      <svg aria-hidden="true" className="mk-line-chart" viewBox="0 0 300 120">
        <polyline points="0,10 40,30 80,42 120,60 160,72 200,88 240,104 280,116" />
        <polyline className="mk-line-muted" points="0,10 40,26 80,50 120,58 160,70 200,80 240,92 280,100" />
      </svg>
      <div className="mk-mock-stats">
        <div><span>Average</span><strong>70.0</strong></div>
        <div><span>Checkout</span><strong>2/5</strong></div>
        <div><span>Best finish</span><strong>81</strong></div>
      </div>
    </Frame>
  );
}

function Sync() {
  return (
    <Frame label="HOME SCREEN APP" pill="OFFLINE" title="Game saved on this device" footer={<span>Syncs when you’re back online</span>}>
      <ul className="mk-mock-list">
        <li><span className="mk-dot mk-dot-live" />501 vs Rival<small>Saved · waiting to sync</small></li>
        <li><span className="mk-dot" />Cricket vs Sam<small>Synced</small></li>
        <li><span className="mk-dot" />Bob’s 27<small>Synced</small></li>
      </ul>
    </Frame>
  );
}

function AI() {
  return (
    <Frame label="BLACKBIRD AI" pill="BALANCED">
      <div className="mk-chat">
        <p className="mk-chat-q">How are my doubles lately?</p>
        <div className="mk-chat-a">
          <p>Across your last 15 X01 games you hit 31% of darts at a double, up from 24% last month. D16 is your best bed; D8 is costing you legs.</p>
          <Bars values={[24, 26, 29, 31]} max={40} labels={["Jun", "Jul", "Aug", "Sep"]} />
        </div>
        <div className="mk-chips">
          <span>Build me a doubles plan</span>
          <span>Compare me with Sam</span>
        </div>
      </div>
    </Frame>
  );
}

function AskAI() {
  return (
    <Frame label="ASK AI SHORTCUTS" title="One tap from anywhere">
      <ul className="mk-mock-list mk-ask-list">
        <li>Scout with AI<small>Matchup</small></li>
        <li>Ask AI About This Game<small>Match report</small></li>
        <li>Ask AI About My Stats<small>Profile</small></li>
        <li>Build Me a Practice Plan<small>Practice</small></li>
      </ul>
    </Frame>
  );
}

function Plan() {
  return (
    <Frame label="TRAINING PLAN" pill="WEEK 2 OF 4" title="Sharper Doubles" footer={<span>Drafted by Merlin, your Blackbird coach</span>}>
      <div className="mk-progress" aria-hidden="true">
        <span style={{ width: "45%" }} />
      </div>
      <p className="mk-mock-note">5 of 11 sessions done</p>
      <div className="mk-next-drill">
        <span className="mk-label mk-blue">NEXT DRILL</span>
        <strong>Checkout Drill · 10 finishes</strong>
        <small>About 10 minutes</small>
      </div>
    </Frame>
  );
}

function Hint() {
  return (
    <Frame label="STRATEGY HINT" pill="3 DARTS LEFT" title={<>121 <span> / DOUBLE OUT</span></>}>
      <div className="mk-darts mk-route">
        <span>T20<small>60</small></span>
        <span>T11<small>33</small></span>
        <span>D14<small>28</small></span>
      </div>
      <div className="mk-why">
        <strong>Why this route?</strong>
        <p>T20 leaves 61. If T11 lands in the single 11, you’re left on 50 for the bull, so a miss still leaves a finish.</p>
      </div>
    </Frame>
  );
}

function AlterEgo() {
  return (
    <Frame label="ALTER EGO" pill="X01 PRACTICE" title="You, last 30 days" footer={<span>Plays like your recent form</span>}>
      <div className="mk-mock-split">
        <div className="mk-player mk-active">
          <div className="mk-player-name"><span className="mk-avatar">Y</span>You</div>
          <div className="mk-player-stat"><span>AVERAGE</span><strong>61.4</strong></div>
          <div className="mk-player-stat"><span>CHECKOUT</span><strong>28%</strong></div>
        </div>
        <div className="mk-player">
          <div className="mk-player-name"><span className="mk-avatar mk-gray">A</span>Alter Ego</div>
          <div className="mk-player-stat"><span>AVERAGE</span><strong>≈ 61</strong></div>
          <div className="mk-player-stat"><span>CHECKOUT</span><strong>≈ 28%</strong></div>
        </div>
      </div>
    </Frame>
  );
}

function Drills() {
  return (
    <Frame label="PRACTICE" title="Pick a drill" footer={<span>Logged apart from competitive stats</span>}>
      <div className="mk-stat-preview">
        <div><span>Bob’s 27</span><strong>84</strong><small>Best score</small></div>
        <div><span>Checkout</span><strong>6/10</strong><small>Last session</small></div>
        <div><span>Scoring · T20</span><strong>52.1</strong><small>Average</small></div>
      </div>
    </Frame>
  );
}

const LADDER = [
  { name: "Rook", avg: 32 },
  { name: "Sparrow", avg: 40 },
  { name: "Jay", avg: 48 },
  { name: "Magpie", avg: 56 },
  { name: "Raven", avg: 65 },
  { name: "Falcon", avg: 75 },
  { name: "Kestrel", avg: 88 },
  { name: "Blackbird", avg: 100 },
];

function Bots() {
  return (
    <Frame label="THE BOT LADDER" pill="8 LEVELS">
      <ol className="mk-ladder">
        {LADDER.map((b, i) => (
          <li key={b.name} className={i < 3 ? "mk-beaten" : undefined}>
            <span className="mk-bot-num">{String(i + 1).padStart(2, "0")}</span>
            <strong>{b.name}</strong>
            <small>{b.avg} avg</small>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

function Stats() {
  return (
    <Frame label="YOUR STATS" pill="LAST 90 DAYS" title="Your game, in focus" footer={<span>Tap any chart to read it</span>}>
      <Bars values={[55, 58, 57, 62, 60, 66, 67]} max={80} />
      <div className="mk-mock-stats">
        <div><span>3-dart avg</span><strong>66.7</strong></div>
        <div><span>High finish</span><strong>140</strong></div>
        <div><span>Cricket MPR</span><strong>2.8</strong></div>
      </div>
    </Frame>
  );
}

function Matchup() {
  const rows = [
    ["1,284", "Elo", "1,241"],
    ["66.7", "Average", "63.2"],
    ["34%", "Checkout", "29%"],
    ["W W L W L", "Last 5", "L L W L W"],
  ];
  return (
    <Frame label="MATCHUP" title="Tale of the Tape">
      <div className="mk-odds" aria-hidden="true">
        <span style={{ width: "56%" }}>You 56%</span>
        <span>Sam 44%</span>
      </div>
      <table className="mk-tape">
        <tbody>
          {rows.map(([a, label, b]) => (
            <tr key={label}>
              <td>{a}</td>
              <th scope="row">{label}</th>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

function Badges() {
  const badges = [
    { name: "Ton Up", note: "Score 100+ in a visit", done: true },
    { name: "Hat-trick", note: "Win three in a row", done: true },
    { name: "Fixture", note: "Play 50 ranked games", done: false, progress: 64 },
    { name: "Big Fish", note: "Check out 170", done: false, progress: 0 },
  ];
  return (
    <Frame label="ACHIEVEMENTS" pill="EXAMPLE">
      <ul className="mk-badges">
        {badges.map((b) => (
          <li key={b.name} className={b.done ? "mk-earned" : undefined}>
            <span aria-hidden="true" className="mk-badge-icon">{b.done ? "★" : "☆"}</span>
            <strong>{b.name}</strong>
            <small>{b.note}</small>
            {!b.done && (
              <span aria-hidden="true" className="mk-progress">
                <span style={{ width: `${b.progress}%` }} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function Card() {
  return (
    <figure className="mk-mock mk-player-card">
      <div className="mk-card-cover" aria-hidden="true" />
      <div className="mk-card-body">
        <span className="mk-avatar mk-card-avatar">Y</span>
        <div>
          <strong>You</strong>
          <small>@you · League night</small>
        </div>
        <svg aria-hidden="true" className="mk-card-qr" viewBox="0 0 7 7">
          <path d="M0 0h3v3H0zM4 0h3v3H4zM0 4h3v3H0zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6z" />
        </svg>
      </div>
      <div className="mk-mock-stats">
        <div><span>Elo</span><strong>1,284</strong></div>
        <div><span>Average</span><strong>66.7</strong></div>
        <div><span>Badges</span><strong>23</strong></div>
      </div>
      <figcaption className="mk-preview-footer">
        <span>Export and share your player card</span>
      </figcaption>
    </figure>
  );
}

export const MOCKS = {
  scoring: Scoring,
  report: Report,
  sync: Sync,
  ai: AI,
  askai: AskAI,
  plan: Plan,
  hint: Hint,
  alterego: AlterEgo,
  drills: Drills,
  bots: Bots,
  stats: Stats,
  matchup: Matchup,
  badges: Badges,
  card: Card,
};

export function Mock({ name }) {
  const Component = MOCKS[name];
  return Component ? <Component /> : null;
}
