import { useState } from "react";

function accentColor() {
  if (typeof window === "undefined") return "#16a34a";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  return v || "#16a34a";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFont(ctx, text, maxWidth, startSize, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 28) {
    size -= 4;
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
  }
  return size;
}

function drawCard(user, stats, elo) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const accent = accentColor();

  // background
  ctx.fillStyle = "#0e1116";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, 120, 60, W * 0.8, 120, 700);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // border frame
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.stroke();

  const cx = W / 2;

  // header
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  ctx.font = "800 34px Arial, sans-serif";
  ctx.fillText("BLACKBIRD", cx, 150);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 24px Arial, sans-serif";
  ctx.fillText("DART SCORING", cx, 188);

  // player name
  ctx.fillStyle = "#ffffff";
  const nameSize = fitFont(ctx, user, W - 220, 110, "800");
  ctx.font = `800 ${nameSize}px Arial, sans-serif`;
  ctx.fillText(user, cx, 360);

  // ELO block
  ctx.fillStyle = accent;
  ctx.font = "800 150px Arial, sans-serif";
  ctx.fillText(String(Math.round(elo || 1000)), cx, 540);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("ELO RATING", cx, 590);

  // record line
  const wins = stats.wins;
  const losses = stats.games - stats.wins;
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillText(`${wins}-${losses}  ·  ${stats.games} games  ·  ${stats.winPct.toFixed(0)}% win`, cx, 670);

  // stat tiles
  const tiles = [
    ["3-DART AVG", stats.x01.threeDartAvg ? stats.x01.threeDartAvg.toFixed(1) : "—"],
    ["BEST LEG", stats.x01.bestLeg ? `${stats.x01.bestLeg}` : "—"],
    ["HIGH OUT", stats.x01.highestCheckout || "—"],
    ["HIGH TURN", stats.x01.highestTurn || "—"],
    ["CRICKET MPR", stats.cricket.mpr ? stats.cricket.mpr.toFixed(2) : "—"],
    ["AVG RUNS", stats.baseball.avgRuns ? stats.baseball.avgRuns.toFixed(1) : "—"],
  ];
  const cols = 2;
  const gap = 28;
  const tileW = (W - 160 - gap) / cols;
  const tileH = 150;
  const startX = 80;
  const startY = 740;
  tiles.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (tileW + gap);
    const y = startY + row * (tileH + gap);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, x, y, tileW, tileH, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, tileW, tileH, 22);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "700 24px Arial, sans-serif";
    ctx.fillText(t[0], x + 28, y + 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 56px Arial, sans-serif";
    ctx.fillText(String(t[1]), x + 28, y + 116);
  });

  // footer
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 26px Arial, sans-serif";
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(`blackbird · ${date}`, cx, H - 70);

  return canvas;
}

export default function PlayerCard({ user, stats, elo, onOpenAccount }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const exportCard = async () => {
    setBusy(true);
    setNote("");
    try {
      const canvas = drawCard(user, stats, elo);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("Could not create image.");
      const file = new File([blob], `${user}-blackbird.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${user} — Blackbird`, text: `${user}'s darts card` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setNote("Card downloaded — attach it to a text or message.");
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        // user cancelled the share sheet — no-op
      } else {
        setNote(e.message || "Couldn't export the card.");
      }
    } finally {
      setBusy(false);
    }
  };

  const wins = stats.wins;
  const losses = stats.games - stats.wins;

  return (
    <div className="card mb-12" style={{ overflow: "hidden", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(60% 50% at 90% 0%, var(--accent-soft), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>
        <div className="tag" style={{ color: "var(--accent)" }}>Player card</div>
        <div style={{ fontWeight: 800, fontSize: 26, marginTop: 4 }}>{user}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
          <span className="num" style={{ fontSize: 40, color: "var(--accent)" }}>{Math.round(elo || 1000)}</span>
          <span className="tag">Elo</span>
        </div>
        <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 6 }}>
          {wins}-{losses} · {stats.games} games · {stats.winPct.toFixed(0)}% win · avg {stats.x01.threeDartAvg.toFixed(1)}
        </div>

        <div className="row mt-12" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ flex: 1, minWidth: 150 }} onClick={exportCard} disabled={busy}>
            {busy ? "Preparing…" : "Export Player Card"}
          </button>
          {onOpenAccount && (
            <button className="btn" style={{ flex: 1, minWidth: 120 }} onClick={onOpenAccount}>
              Settings
            </button>
          )}
        </div>
        {note && (
          <p className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 10 }}>{note}</p>
        )}
      </div>
    </div>
  );
}
