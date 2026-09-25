"use client";

import { useRef, useState } from "react";
import { usePreview } from "./PreviewProvider";
import { MOCKS } from "./Mocks";

const TABS = [
  { id: "scoring", num: "01", label: "Match Scoring" },
  { id: "practice", num: "02", label: "Practice & Bots" },
  { id: "stats", num: "03", label: "Player Stats" },
  { id: "coaching", num: "04", label: "AI Coaching" },
];

/** The framed product preview under the hero: three tabs and a tap-to-score demo. */
export default function ProductPreview() {
  const { panel, setPanel } = usePreview();
  const tabRefs = useRef([]);
  const [scored, setScored] = useState(false);

  const select = (id, focus = false) => {
    setPanel(id);
    if (focus) {
      const i = TABS.findIndex((t) => t.id === id);
      tabRefs.current[i]?.focus();
    }
  };
  const onKey = (e, i) => {
    let next;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      select(TABS[next].id, true);
    }
  };

  return (
    <div aria-label="Blackbird product preview with example match and player data" className="mk-preview-shell" id="preview">
      <div className="mk-preview-toolbar">
        <span className="mk-preview-brand">
          <img alt="Blackbird" height="32" src="/brand/word-color.svg" width="105" />
          <span> / Product Preview</span>
        </span>
      </div>
      <div aria-label="Product preview" className="mk-preview-tabs" role="tablist">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (tabRefs.current[i] = el)}
            aria-controls={`panel-${t.id}`}
            aria-selected={panel === t.id}
            data-panel={t.id}
            id={`tab-${t.id}`}
            role="tab"
            tabIndex={panel === t.id ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.num} <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div aria-labelledby="tab-scoring" className="mk-demo-panel" hidden={panel !== "scoring"} id="panel-scoring" role="tabpanel">
        <div className="mk-match-head">
          <div>
            <span className="mk-label">GAME NIGHT</span>
            <h3>
              501 <span> / DOUBLE OUT</span>
            </h3>
          </div>
          <span className="mk-pill">LEG 1 OF 3</span>
        </div>
        <div className="mk-scoring-grid">
          <div className="mk-player mk-active">
            <div className="mk-player-name">
              <span className="mk-avatar">Y</span>You <span className="mk-turn-label">YOUR THROW</span>
            </div>
            <div aria-live="polite" className="mk-big-score" id="demo-score">
              {scored ? "161" : "301"}
            </div>
            <div className="mk-player-stat">
              <span>3-DART AVERAGE</span>
              <strong>66.7</strong>
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
          <div className="mk-visit">
            <span className="mk-label">YOUR NEXT VISIT</span>
            <div className="mk-darts">
              <span>
                T20<small>60</small>
              </span>
              <span>
                T20<small>60</small>
              </span>
              <span>
                20<small>20</small>
              </span>
            </div>
            <button className="mk-button mk-score-button" id="score-button" type="button" onClick={() => setScored(true)} disabled={scored}>
              {scored ? "Visit recorded ✓" : <>Score 140 <span aria-hidden="true">↵</span></>}
            </button>
            <button className="mk-reset-button" id="reset-button" type="button" onClick={() => setScored(false)}>
              Reset preview
            </button>
          </div>
        </div>
        <div className="mk-preview-footer">
          <span>
            TRY A VISIT <span aria-hidden="true">↑</span>
          </span>
        </div>
      </div>

      <div aria-labelledby="tab-practice" className="mk-demo-panel" hidden={panel !== "practice"} id="panel-practice" role="tabpanel">
        <div className="mk-match-head">
          <div>
            <span className="mk-label">A LITTLE BETTER. EVERY SESSION.</span>
            <h3>Meet your next opponent.</h3>
          </div>
          <span className="mk-pill">8 BOT LEVELS</span>
        </div>
        <div className="mk-bot-ladder">
          <div>
            <span className="mk-bot-num">01</span>
            <strong>Rook</strong>
            <span>32 average</span>
          </div>
          <div>
            <span className="mk-bot-num">02—07</span>
            <strong>Work your way up</strong>
            <span>Beat a bot. Unlock the next.</span>
          </div>
          <div>
            <span className="mk-bot-num">08</span>
            <strong>Blackbird</strong>
            <span>100 average</span>
          </div>
        </div>
        <div className="mk-preview-footer">
          <span>Bob’s 27 · Checkout drills · Scoring drills</span>
          <span>YOUR OWN PRACTICE LOG</span>
        </div>
      </div>

      <div aria-labelledby="tab-stats" className="mk-demo-panel" hidden={panel !== "stats"} id="panel-stats" role="tabpanel">
        <div className="mk-match-head">
          <div>
            <span className="mk-label">SEE THE PROGRESS BEHIND THE SCORE.</span>
            <h3>Your game, in focus.</h3>
          </div>
          <span className="mk-pill">EXAMPLE PLAYER</span>
        </div>
        <div className="mk-stat-preview">
          <div>
            <span>3-dart average</span>
            <strong>66.7</strong>
            <small>Every visit tells a story.</small>
          </div>
          <div>
            <span>Highest checkout</span>
            <strong>140</strong>
            <small>Remember your best finishes.</small>
          </div>
          <div>
            <span>Cricket MPR</span>
            <strong>2.8</strong>
            <small>Track your marks per round.</small>
          </div>
        </div>
        <div className="mk-preview-footer">
          <span>Player profiles · Trend charts · Elo ratings</span>
          <span>KNOW YOUR GAME</span>
        </div>
      </div>

      <div aria-labelledby="tab-coaching" className="mk-demo-panel mk-demo-coaching" hidden={panel !== "coaching"} id="panel-coaching" role="tabpanel">
        <MOCKS.ai />
      </div>
    </div>
  );
}
