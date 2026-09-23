"use client";

import { useState } from "react";
import DartboardSvg from "./DartboardSvg";

/** The TV scoreboard mock with its dark/light appearance toggle. */
export default function TVPreview() {
  const [theme, setTheme] = useState("dark");
  return (
    <>
      <div aria-label="TV preview theme" className="mk-tv-preview-controls" role="group">
        <button aria-controls="tv-preview" aria-pressed={theme === "dark"} data-tv-theme="dark" type="button" onClick={() => setTheme("dark")}>
          Dark
        </button>
        <button
          aria-controls="tv-preview"
          aria-label="Light theme design preview"
          aria-pressed={theme === "light"}
          data-tv-theme="light"
          type="button"
          onClick={() => setTheme("light")}
        >
          Light
        </button>
      </div>
      <figure className="mk-tv-screen" data-theme={theme}>
        <div aria-label="Blackbird TV scoreboard preview" className="mk-tv-preview" id="tv-preview">
          <div className="mk-tv-match-title">501 · double out</div>
          <div className="mk-tv-match-content">
            <div className="mk-tv-players">
              <div className="mk-tv-player">
                <strong>Matt</strong>
                <span className="mk-tv-score">366</span>
                <small>avg 135.0 · 3 darts</small>
              </div>
              <div className="mk-tv-player mk-is-current">
                <strong>Sam</strong>
                <span className="mk-tv-score">501</span>
                <small>avg 0.0 · 0 darts</small>
              </div>
            </div>
            <div className="mk-tv-dartboard">
              <DartboardSvg />
            </div>
          </div>
          <div className="mk-tv-room">BLACKBIRD · CODE J7CW</div>
        </div>
        <figcaption>BLACKBIRD TV</figcaption>
      </figure>
    </>
  );
}
