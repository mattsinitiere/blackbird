import { useState } from "react";
import { BackBar } from "./ui";
import { CRICKET_VARIANTS } from "@/lib/constants";

export default function Setup({ players, addPlayer, onStart, back, me }) {
  const meName = (me || "").trim();
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState(meName ? [meName] : []);
  const [gameType, setGameType] = useState("x01");
  const [startScore, setStartScore] = useState(501);
  const [doubleOut, setDoubleOut] = useState(true);
  const [variant, setVariant] = useState("standard");

  const add = (u) => setSelected((s) => (s.length < 4 && !s.includes(u) ? [...s, u] : s));
  const remove = (u) => setSelected((s) => s.filter((x) => x !== u));

  const onAddNew = async () => {
    const u = newName.trim();
    if (!u) return;
    await addPlayer(u, true); // guest: added hidden so they stay off the leaderboard
    add(u);
    setNewName("");
  };

  const rosterOptions = players
    .map((p) => p.username)
    .filter((u) => u.toLowerCase() !== meName.toLowerCase() && !selected.includes(u));

  const solo = selected.length === 1;
  const canStart = selected.length >= 1;

  const start = () => {
    let config = {};
    if (gameType === "x01") config = { startScore, doubleOut };
    else if (gameType === "cricket") config = { variant };
    onStart({
      id: Date.now().toString(36),
      gameType,
      players: selected,
      config,
      startedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fade">
      <BackBar back={back} title="New game" />

      <div className="card mb-12">
        <div className="tag mb-12">Game type</div>
        <div className="row">
          {[
            ["x01", "X01"],
            ["cricket", "Cricket"],
            ["baseball", "Baseball"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={`btn ${gameType === k ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setGameType(k)}
            >
              {l}
            </button>
          ))}
        </div>

        {gameType === "x01" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>
              Starting score
            </div>
            <div className="row">
              {[301, 501, 701].map((v) => (
                <button
                  key={v}
                  className={`btn ${startScore === v ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setStartScore(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={doubleOut}
                onChange={(e) => setDoubleOut(e.target.checked)}
              />
              <span>Double out (finish on exactly 0; can&apos;t leave 1)</span>
            </label>
          </div>
        )}

        {gameType === "cricket" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>
              Variant
            </div>
            <div className="row">
              {CRICKET_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  className={`btn ${variant === v.id ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setVariant(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
              {variant === "standard" && "Close all numbers and lead on points to win."}
              {variant === "cutthroat" && "Points go to opponents — lowest score wins."}
              {variant === "noscore" && "First to close all numbers wins. Points ignored."}
            </p>
          </div>
        )}

        {gameType === "baseball" && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
            9 innings. In inning N you aim at number N; single/double/triple = 1/2/3 runs.
            Most runs after 9 innings wins.
          </p>
        )}
      </div>

      <div className="card mb-12">
        <div className="tag mb-12">Players (1 = solo practice, up to 4)</div>

        <div className="flex-wrap">
          {selected.length === 0 && <span className="subtle">No players selected yet.</span>}
          {selected.map((u) => (
            <button key={u} className="btn btn-primary" onClick={() => remove(u)}>
              {u}
              {u === meName ? " (you)" : ""} ✕
            </button>
          ))}
        </div>

        {rosterOptions.length > 0 && selected.length < 4 && (
          <select
            className="select mt-12"
            value=""
            onChange={(e) => {
              if (e.target.value) add(e.target.value);
            }}
          >
            <option value="">+ Add a player…</option>
            {rosterOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
        {rosterOptions.length === 0 && selected.length < 4 && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
            No other players to pick yet — add a guest below. (People appear here once they&apos;ve signed in with a display name.)
          </p>
        )}

        <div className="row mt-12">
          <input
            className="input"
            placeholder="or add a new name (guest)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddNew()}
          />
          <button className="btn" onClick={onAddNew}>
            Add
          </button>
        </div>

        {solo && (
          <p className="tag" style={{ marginTop: 10, color: "var(--amber)", textTransform: "none", letterSpacing: 0 }}>
            Solo practice — this game won&apos;t be saved to stats or the leaderboard.
          </p>
        )}
      </div>

      <button
        className="btn btn-primary"
        disabled={!canStart}
        style={{ width: "100%", fontSize: 15, padding: 15 }}
        onClick={start}
      >
        {canStart ? (solo ? "Start practice" : "Throw first") : "Pick at least 1 player"}
      </button>
    </div>
  );
}
