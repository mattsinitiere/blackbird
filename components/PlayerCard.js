import { useState, useContext } from "react";
import { PlayerBadge, PlayerLookContext } from "./ui";
import { defaultPlayerColor } from "@/lib/constants";
import { isTagIcon, isDevTagIcon } from "@/lib/profile";
import { qrMatrix, inFinder } from "@/lib/qr";
import { iconParts } from "@/lib/icons";
import { cardStats } from "@/lib/playerCard";

// The app's Figtree is registered by next/font under a hashed family name
// (exposed as --font-figtree), so a canvas asking for "Figtree" would get
// Arial. Resolve the real family at export time.
function cardFont() {
  const fam = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--font-figtree").trim() : "";
  return `${fam ? `${fam}, ` : ""}"Figtree", Arial, sans-serif`;
}
let FONT = cardFont();

function isLight(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

/** The profile's palette, light or dark to match the app. */
function themePalette() {
  const theme = (typeof document !== "undefined" && document.documentElement.dataset.theme) || "light";
  if (theme === "dark") {
    return {
      theme,
      bg: "#101419",
      surface: "#181d23",
      cover: "#1b1942",
      accent: "#a9a3dc",
      accentSoft: "rgba(169,163,220,0.16)",
      ink: "#edf2f7",
      muted: "#939da9",
      tile: "#1f252c",
      line: "#2c333d",
    };
  }
  return {
    theme: "light",
    bg: "#f5f6f9",
    surface: "#ffffff",
    cover: "#26214d",
    accent: "#26214d",
    accentSoft: "#eeedf5",
    ink: "#201e3c",
    muted: "#727381",
    tile: "#f5f6f9",
    line: "#e6e7ed",
  };
}

async function ensureFont() {
  FONT = cardFont();
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all(["500", "600", "700", "800"].map((w) => document.fonts.load(`${w} 40px ${FONT}`)));
    await document.fonts.ready;
  } catch {
    /* fall back to Arial */
  }
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

/** Rounded rect with its own radius per corner: [tl, tr, br, bl]. */
function roundRect4(ctx, x, y, w, h, [tl, tr, br, bl]) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/**
 * The card's QR code in the "Flight" style: dots joined into strokes,
 * leaf-shaped corner squares pointing at the centre, and the Blackbird mark
 * in the middle (error correction H covers it). Always navy on white, so it
 * scans on either theme.
 */
function drawQR(ctx, text, x, y, size, logo, ink) {
  const { n, dark } = qrMatrix(text);
  const m = size / n;
  const hole = Math.round(n * 0.22) | 1; // odd, so it centres on a module
  const h0 = (n - hole) / 2;
  const inHole = (r, c) => r >= h0 - 0.5 && r < h0 + hole && c >= h0 - 0.5 && c < h0 + hole;
  const on = (r, c) => dark(r, c) && !inFinder(n, r, c) && !inHole(r, c);
  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue;
      const px = x + c * m;
      const py = y + r * m;
      ctx.beginPath();
      ctx.arc(px + m / 2, py + m / 2, m * 0.42, 0, Math.PI * 2);
      ctx.fill();
      if (on(r, c + 1)) ctx.fillRect(px + m / 2, py + m * 0.08, m, m * 0.84);
      if (on(r + 1, c)) ctx.fillRect(px + m * 0.08, py + m / 2, m * 0.84, m);
    }
  }
  // leaf eyes: the corner nearest the code's centre stays square
  for (const [er, ec, sharp] of [[0, 0, 2], [0, n - 7, 3], [n - 7, 0, 1]]) {
    const ex = x + ec * m;
    const ey = y + er * m;
    const s = 7 * m;
    const radii = (v) => [0, 1, 2, 3].map((i) => (i === sharp ? 0 : v));
    ctx.fillStyle = ink;
    roundRect4(ctx, ex, ey, s, s, radii(m * 3));
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    roundRect4(ctx, ex + m, ey + m, s - 2 * m, s - 2 * m, radii(m * 1.8));
    ctx.fill();
    ctx.fillStyle = ink;
    roundRect4(ctx, ex + 2 * m, ey + 2 * m, 3 * m, 3 * m, radii(m * 1.2));
    ctx.fill();
  }
  // the mark on a white plate
  const ls = hole * m;
  const lx = x + h0 * m;
  const ly = y + h0 * m;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, lx - m * 0.3, ly - m * 0.3, ls + m * 0.6, ls + m * 0.6, m * 1.2);
  ctx.fill();
  if (logo) ctx.drawImage(logo, lx + m * 0.2, ly + m * 0.2, ls - m * 0.4, ls - m * 0.4);
}

function setFont(ctx, weight, size, spacing = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
}

function fitFont(ctx, text, maxWidth, startSize, weight) {
  let size = startSize;
  setFont(ctx, weight, size);
  while (ctx.measureText(text).width > maxWidth && size > 36) {
    size -= 4;
    setFont(ctx, weight, size);
  }
  return size;
}

/** Draw one lib/icons.js icon on the canvas, `size` px square at (x, y). */
function drawIcon(ctx, id, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of iconParts(id)) {
    const path = new Path2D(p.d);
    if (p.fill) ctx.fill(path);
    else ctx.stroke(path);
  }
  ctx.restore();
}

/**
 * The shareable card, 1080×1350 (4:5), styled like the profile: an indigo
 * cover with the Blackbird mark, the avatar overlapping it, name and tag,
 * Elo / record / win % across, then only the stats the player actually has.
 */
export function drawCard({ user, stats, elo, playerColor, handle, look = {}, images = {}, qrUrl = null }) {
  const W = 1080;
  const H = 1350;
  const pal = themePalette();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";

  const X = 40;
  const Y = 40;
  const CW = W - 80;
  const CH = H - 80;
  const L = 96; // content left edge
  const R = W - 96; // content right edge

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  // card
  ctx.save();
  roundRect(ctx, X, Y, CW, CH, 48);
  ctx.fillStyle = pal.surface;
  ctx.fill();
  ctx.clip();

  // cover band
  const coverH = 280;
  ctx.fillStyle = pal.cover;
  ctx.fillRect(X, Y, CW, coverH);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  setFont(ctx, 700, 24, 5);
  ctx.textAlign = "left";
  ctx.fillText("EVERY DART COUNTS.", L, Y + 76);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X, Y, CW, coverH);
  ctx.clip(); // the big type stays inside the band
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  setFont(ctx, 800, 190, -6);
  ctx.textAlign = "right";
  ctx.fillText("PLAY ON.", R + 20, Y + coverH + 36);
  ctx.restore();
  if (images.icon) ctx.drawImage(images.icon, R - 64, Y + 40, 64, 64);
  ctx.restore();

  // card border on top of the clipped fill
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 2;
  roundRect(ctx, X, Y, CW, CH, 48);
  ctx.stroke();

  // avatar overlapping the cover
  const avR = 104;
  const avX = L + avR;
  const avY = Y + coverH;
  ctx.beginPath();
  ctx.arc(avX, avY, avR + 12, 0, Math.PI * 2);
  ctx.fillStyle = pal.surface;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  const avatarColor = playerColor || defaultPlayerColor(user);
  ctx.fillStyle = avatarColor;
  ctx.fill();
  ctx.fillStyle = isLight(avatarColor) ? "#333" : "#fff";
  setFont(ctx, 800, 104);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(user.charAt(0).toUpperCase(), avX, avY + 6);
  ctx.textBaseline = "alphabetic";

  // QR code to the website, right of the name (navy on white; on the dark
  // theme it sits on its own white plate so it still scans)
  const qrSize = 200;
  const qrX = R - qrSize;
  const qrY = Y + coverH + 16;
  if (qrUrl) {
    if (pal.theme === "dark") {
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 22);
      ctx.fill();
    }
    drawQR(ctx, qrUrl, qrX, qrY, qrSize, images.qrLogo, "#26214d");
  }

  // name, fitted to the width left of the QR code
  let y = avY + avR + 96;
  ctx.textAlign = "left";
  ctx.fillStyle = pal.ink;
  const nameSize = fitFont(ctx, user, (qrUrl ? qrX - 32 : R) - L, 88, 800);
  setFont(ctx, 800, nameSize, -1);
  ctx.fillText(user, L, y);

  // @handle, then the tag as a pill (letters and/or vector icon)
  y += 58;
  let x = L;
  if (handle) {
    ctx.fillStyle = pal.muted;
    setFont(ctx, 500, 34);
    ctx.fillText(`@${handle}`, x, y);
    x += ctx.measureText(`@${handle}`).width + 20;
  }
  const tagLetters = look.tag || "";
  const tagIcon = isTagIcon(look.tagIcon) ? look.tagIcon : null;
  if (tagLetters || tagIcon) {
    setFont(ctx, 700, 24, 2);
    const iconSize = 28;
    const textW = tagLetters ? ctx.measureText(tagLetters).width : 0;
    const pillW = 24 + (tagIcon ? iconSize : 0) + (tagIcon && tagLetters ? 10 : 0) + textW;
    const pillH = 44;
    const pillY = y - 33;
    // the developer's tag is gold outline, as in the app
    const dev = isDevTagIcon(tagIcon);
    const ink = dev ? (pal.theme === "dark" ? "#f1c75b" : "#9a7208") : pal.accent;
    roundRect(ctx, x, pillY, pillW, pillH, 10);
    ctx.fillStyle = dev ? "rgba(212, 160, 23, 0.10)" : pal.accentSoft;
    ctx.fill();
    if (dev) {
      ctx.strokeStyle = pal.theme === "dark" ? "#d9ae45" : "#d4a017";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    let px = x + 12;
    if (tagIcon) {
      drawIcon(ctx, tagIcon, px, pillY + (pillH - iconSize) / 2, iconSize, ink);
      px += iconSize + (tagLetters ? 10 : 0);
    }
    if (tagLetters) {
      ctx.fillStyle = ink;
      ctx.fillText(tagLetters, px, y - 2);
    }
  }

  // headline row: Elo, record, win %
  y += 52;
  const rowTop = y;
  const rowH = 150;
  ctx.fillStyle = pal.line;
  ctx.fillRect(L, rowTop, R - L, 2);
  ctx.fillRect(L, rowTop + rowH, R - L, 2);
  const heads = [
    { label: "ELO RATING", value: String(Math.round(elo || 1000)), color: pal.accent },
    { label: "RECORD", value: `${stats.wins}–${stats.games - stats.wins}`, color: pal.ink },
    { label: "WIN RATE", value: `${stats.winPct.toFixed(0)}%`, color: pal.ink },
  ];
  const colW = (R - L) / 3;
  heads.forEach((h, i) => {
    const hx = L + i * colW + (i === 0 ? 0 : 32);
    if (i > 0) {
      ctx.fillStyle = pal.line;
      ctx.fillRect(L + i * colW, rowTop + 28, 2, rowH - 56);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = h.color;
    setFont(ctx, 800, 72, -2);
    ctx.fillText(h.value, hx, rowTop + 92);
    ctx.fillStyle = pal.muted;
    setFont(ctx, 600, 20, 3);
    ctx.fillText(h.label, hx, rowTop + 126);
  });

  // stat tiles: only stats the player has (lib/playerCard.js)
  const tiles = cardStats(stats);
  const gridTop = rowTop + rowH + 40;
  const gap = 20;
  const tileW = (R - L - gap) / 2;
  // tiles shrink to fit above the footer (up to three rows)
  const footTop = Y + CH - 96;
  const rows = Math.max(1, Math.ceil(tiles.length / 2));
  const tileH = Math.min(124, (footTop - 32 - gridTop - gap * (rows - 1)) / rows);
  // fewer stats: centre the grid in the space instead of leaving a gap below
  const gridH = rows * tileH + gap * (rows - 1);
  const gridY = gridTop + Math.max(0, (footTop - 32 - gridTop - gridH) / 2);
  tiles.forEach((t, i) => {
    const tx = L + (i % 2) * (tileW + gap);
    const ty = gridY + Math.floor(i / 2) * (tileH + gap);
    roundRect(ctx, tx, ty, tileW, tileH, 22);
    ctx.fillStyle = pal.tile;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = pal.muted;
    setFont(ctx, 600, 20, 3);
    ctx.fillText(t.label.toUpperCase(), tx + 28, ty + tileH * 0.36);
    ctx.fillStyle = pal.ink;
    setFont(ctx, 800, 50, -1);
    ctx.fillText(t.value, tx + 28, ty + tileH * 0.8);
  });

  // footer: wordmark left, scope and date right
  const footY = footTop;
  ctx.fillStyle = pal.line;
  ctx.fillRect(L, footY, R - L, 2);
  if (images.word) {
    const h = 34;
    const w = h * (2995.033 / 914.325); // the wordmark's aspect (see Logo in ui.js)
    ctx.drawImage(images.word, L, footY + 30, w, h);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = pal.muted;
  setFont(ctx, 500, 24);
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  ctx.fillText(`All-time ranked · ${date}`, R, footY + 58);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  return canvas;
}

export default function PlayerCard({ user, handle, stats, elo, onOpenAccount, playerColors }) {
  const look = useContext(PlayerLookContext)?.[user];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const exportCard = async () => {
    setBusy(true);
    setNote("");
    try {
      await ensureFont();
      const color = playerColors?.[user] || defaultPlayerColor(user);
      const dark = document.documentElement.dataset.theme === "dark";
      const [icon, word, qrLogo] = await Promise.all([loadImage("/brand/icon-white.svg"), loadImage(`/brand/word-${dark ? "white" : "color"}.svg`), loadImage("/brand/icon-color.svg")]);
      const qrUrl = `${window.location.origin}/`;
      const canvas = drawCard({ user, stats, elo, playerColor: color, handle, look: look || {}, images: { icon, word, qrLogo }, qrUrl });
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
        setNote("Card saved to downloads.");
      }
    } catch (e) {
      if (e && e.name === "AbortError") {
        /* user cancelled the share sheet */
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="num" style={{ fontSize: "calc(36px * var(--fs))", color: "var(--accent)" }}>{Math.round(elo || 1000)}</span>
          <span className="tag">Elo</span>
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
