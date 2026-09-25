"use client";

import { useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/marketing/games";

export default function GameModes() {
  const [current, setCurrent] = useState(GAMES[0]);
  return (
    <section className="mk-section mk-games" id="games">
      <div className="mk-section-mark">
        <span>[ 03 / 05 ]</span>
      </div>
      <div className="mk-games-layout">
        <div>
          <span className="mk-label mk-blue">SAME BOARD. NEW POSSIBILITIES.</span>
          <h2>
            Your Classics.
            <br />
            Your New Favorites.
          </h2>
          <p>Choose from nine game modes, with options for competitive matches and casual play.</p>
          <Link className="mk-text-link" href="/games">
            How each game plays <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="mk-game-browser">
          <div aria-label="Choose a game to learn about" className="mk-game-options" role="group">
            {GAMES.map((g) => (
              <button
                key={g.id}
                aria-pressed={current.id === g.id}
                className={current.id === g.id ? "mk-selected" : undefined}
                data-game={g.id}
                type="button"
                onClick={() => setCurrent(g)}
              >
                {g.id}
              </button>
            ))}
          </div>
          <div aria-live="polite" className="mk-game-description">
            <h3 id="game-title">{current.title}</h3>
            <p id="game-copy">{current.copy}</p>
            <Link className="mk-button mk-game-play" href="/app">
              PLAY
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
