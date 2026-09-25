import { ImageResponse } from "next/og";

export const alt = "Blackbird — Every Dart Counts.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The shared social preview card: wordmark, tagline and a dot field in the brand navy. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#fcfcfd",
          backgroundImage: "radial-gradient(#c4d1e9 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          color: "#1b1942",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Blackbird</div>
        <div style={{ fontSize: 86, lineHeight: 1.08, letterSpacing: -3, marginTop: 28, color: "#111827" }}>Every Dart Counts.</div>
        <div style={{ fontSize: 86, lineHeight: 1.08, letterSpacing: -3, color: "#1b1942" }}>Make Yours Matter.</div>
        <div style={{ fontSize: 30, marginTop: 36, color: "#5b6475" }}>Scoring · AI coaching · Practice · Stats · TV scoreboard</div>
      </div>
    ),
    size
  );
}
