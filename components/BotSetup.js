import { useState, useEffect, useRef } from "react";
import { BackBar } from "./ui";
import BotAvatar from "./BotAvatar";
import Icon from "./Icon";
import { X01Options, CricketOptions, BaseballNote } from "./GameOptions";
import { BOT_GAMES } from "@/lib/bots";
import { newGameId } from "@/lib/games";

const GAMES = [
  ["x01", "X01"],
  ["cricket", "Cricket"],
  ["baseball", "Baseball"],
].filter(([k]) => BOT_GAMES.has(k));

/**
 * Play a Bot: a practice match against one of the ladder's bird
 * characters. Pick the opponent from the gallery, the game and who throws
 * first. Always you vs one bot and always saved as practice, so there is
 * no player picker here. The game it starts is built exactly like a bot
 * game from the New Game screen used to be (config.bot, [me, bot]).
 */
export default function BotSetup({ me, ladder, initial = null, onStart, back }) {
  const firstOpen = (ladder.filter((l) => l.unlocked).slice(-1)[0] || ladder[0])?.bot.id;
  const wanted = initial?.bot && ladder.find((l) => l.bot.id === initial.bot && l.unlocked) ? initial.bot : firstOpen;
  const [botId, setBotId] = useState(wanted);
  const [gameType, setGameType] = useState(BOT_GAMES.has(initial?.gameType) ? initial.gameType : "x01");
  const [startScore, setStartScore] = useState(501);
  const [doubleOut, setDoubleOut] = useState(true);
  const [legs, setLegs] = useState(1);
  const [variant, setVariant] = useState("standard");
  const [meFirst, setMeFirst] = useState(true);
  // "Play Magpie" right after the win that unlocked her can arrive before
  // the saved game refreshes the ladder: select her once she opens, unless
  // the player has already picked someone else
  const picked = useRef(false);
  const wantedOpen = !!initial?.bot && !!ladder.find((l) => l.bot.id === initial.bot && l.unlocked);
  useEffect(() => {
    if (wantedOpen && !picked.current) setBotId(initial.bot);
  }, [wantedOpen, initial]);

  const entry = ladder.find((l) => l.bot.id === botId) || ladder[0];
  if (!entry) return null;
  const bot = entry.bot;
  const played = entry.wins + entry.losses;
  const idx = ladder.indexOf(entry);
  const nextLocked = ladder[idx + 1] && !ladder[idx + 1].unlocked ? ladder[idx + 1].bot : null;

  const start = () => {
    let config = {};
    if (gameType === "x01") config = { startScore, doubleOut, legs };
    else if (gameType === "cricket") config = { variant };
    config.bot = { id: bot.id, level: bot.level };
    onStart({
      id: newGameId(),
      gameType,
      players: meFirst ? [me, bot.id] : [bot.id, me],
      config,
      startedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fade">
      <BackBar back={back} title="Play a Bot" />

      <section className="card mb-12 bot-hero" aria-live="polite">
        <BotAvatar bot={bot} sizeCss="calc(96px * var(--fs-chrome))" title={`${bot.name}, level ${bot.level}`} />
        <div className="bot-hero-text">
          <div className="bot-hero-name">{bot.name}</div>
          <div className="bot-hero-meta">
            Level {bot.level} · {bot.avg} average
          </div>
          <p className="bot-hero-quote">&ldquo;{bot.blurb}&rdquo;</p>
          <div className="bot-hero-record">
            {played ? (
              <>
                Your record <strong className="num">{entry.wins}–{entry.losses}</strong>
              </>
            ) : (
              "You haven't played this bot yet."
            )}
          </div>
        </div>
      </section>

      <section className="card mb-12" aria-labelledby="bot-pick-title">
        <h2 className="tag mb-12" id="bot-pick-title" style={{ margin: "0 0 12px" }}>Choose Your Opponent</h2>
        <div className="bot-grid" role="radiogroup" aria-label="Opponent">
          {ladder.map(({ bot: b, wins, unlocked }, i) => {
            const on = b.id === botId;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`bot-tile${on ? " is-on" : ""}${unlocked ? "" : " is-locked"}`}
                onClick={() => {
                  if (!unlocked) return;
                  picked.current = true;
                  setBotId(b.id);
                }}
                disabled={!unlocked}
                title={unlocked ? `${b.name}: ${b.blurb}` : `Beat ${ladder[i - 1].bot.name} to unlock`}
              >
                <span className="bot-tile-avatar">
                  <BotAvatar bot={b} sizeCss="100%" locked={!unlocked} />
                  {!unlocked && (
                    <span className="bot-tile-lock">
                      <Icon id="lock" size="55%" strokeWidth={2.4} />
                    </span>
                  )}
                  {unlocked && wins > 0 && (
                    <span className="bot-tile-beaten" title="Beaten">
                      <Icon id="trophy" size="70%" strokeWidth={2.4} />
                    </span>
                  )}
                </span>
                <span className="bot-tile-name">{b.name}</span>
                <span className="bot-tile-level">{unlocked ? `L${b.level} · ${b.avg}` : `Beat ${ladder[i - 1].bot.name}`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card mb-12">
        <h2 className="tag" style={{ margin: "0 0 12px" }}>Game</h2>
        <div className="row">
          {GAMES.map(([k, l]) => (
            <button key={k} type="button" className={`btn ${gameType === k ? "btn-primary" : ""}`} style={{ flex: 1 }} onClick={() => setGameType(k)}>
              {l}
            </button>
          ))}
        </div>
        {gameType === "x01" && <X01Options startScore={startScore} setStartScore={setStartScore} doubleOut={doubleOut} setDoubleOut={setDoubleOut} legs={legs} setLegs={setLegs} />}
        {gameType === "cricket" && <CricketOptions variant={variant} setVariant={setVariant} />}
        {gameType === "baseball" && <BaseballNote />}

        <div className="tag" style={{ marginTop: 14, marginBottom: 6 }}>Throws First</div>
        <div className="row">
          <button type="button" className={`btn ${meFirst ? "btn-toggle-on" : ""}`} style={{ flex: 1 }} onClick={() => setMeFirst(true)} aria-pressed={meFirst}>
            You First
          </button>
          <button type="button" className={`btn ${!meFirst ? "btn-toggle-on" : ""}`} style={{ flex: 1 }} onClick={() => setMeFirst(false)} aria-pressed={!meFirst}>
            {bot.name} First
          </button>
        </div>
      </section>

      <p className="bot-note">
        <Icon id="book" size="1.1em" />
        <span>
          Practice match: saved to your practice log, never to stats, Elo or the leaderboard.
          {nextLocked && ` Win to unlock ${nextLocked.name}.`}
        </span>
      </p>

      <button type="button" className="btn btn-primary bot-start" onClick={start} disabled={!me}>
        Play {bot.name}
      </button>
    </div>
  );
}
