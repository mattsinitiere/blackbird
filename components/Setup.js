import { useState } from "react";
import { BackBar } from "./ui";

export default function Setup({ players, addPlayer, onStart, back }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [gameType, setGameType] = useState("x01");
  const [startScore, setStartScore] = useState(501);
  const [doubleOut, setDoubleOut] = useState(true);

  const selectSafe = (u) =>
    setSelected((s) => (s.length < 4 && !s.includes(u) ? [...s, u] : s));

  const toggle = (u) =>
    setSelected((s) =>
      s.includes(u) ? s.filter((x) => x !== u) : s.length < 4 ? [...s, u] : s
    );

  const onAdd = async () => {
    const u = name.trim();
    if (!u) return;
    const ok = await addPlayer(u);
    if (ok) selectSafe(u);
    setName("");
  };

  const canStart = selected.length >= 2;

  const start = () => {
    onStart({
      id: Date.now().toString(36),
      gameType,
      players: selected,
      config: gameType === "x01" ? { startScore, doubleOut } : {},
      startedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fade">
      <BackBar back={back} title="New game" />

      <div className="card mb-12">
        <div className="tag mb-12">Game type</div>
        <div className="row">
          <button
            className={`btn ${gameType === "x01" ? "btn-primary" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setGameType("x01")}
          >
            X01
          </button>
          <button
            className={`btn ${gameType === "cricket" ? "btn-primary" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setGameType("cricket")}
          >
            Cricket
          </button>
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
      </div>

      <div className="card mb-12">
        <div className="tag mb-12">Players (2–4)</div>
        <div className="row mb-12">
          <input
            className="input"
            placeholder="add a username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
          <button className="btn" onClick={onAdd}>
            Add
          </button>
        </div>
        <div className="flex-wrap">
          {players.length === 0 && (
            <span className="subtle">No players yet — add some above.</span>
          )}
          {players.map((p) => {
            const on = selected.includes(p.username);
            const idx = selected.indexOf(p.username);
            return (
              <button
                key={p.username}
                className={`btn ${on ? "btn-primary" : ""}`}
                onClick={() => toggle(p.username)}
              >
                {on ? `${idx + 1}· ` : ""}
                {p.username}
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="btn btn-primary"
        disabled={!canStart}
        style={{ width: "100%", fontSize: 15, padding: 15 }}
        onClick={start}
      >
        {canStart ? "Throw first" : "Pick at least 2 players"}
      </button>
    </div>
  );
}
