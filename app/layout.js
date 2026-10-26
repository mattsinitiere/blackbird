import "./globals.css";
import { figtree } from "./fonts";
import { siteUrl } from "@/lib/siteUrl";

export const metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Blackbird — Every Dart Counts.",
    template: "%s — Blackbird",
  },
  description:
    "Blackbird brings dart scoring, practice, player stats and live TV scoreboards together. Nine games. One place to play.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Blackbird",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b1942",
  viewportFit: "cover",
};

// The app's theme before first paint: the choice cached on this device
// (light, dark or system), so a dark-mode user never sees a light flash
// while the session loads. The public website keeps its own look.
const THEME_SCRIPT = `try{if(location.pathname.indexOf("/app")===0){var t=localStorage.getItem("bb-theme")||"system";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
