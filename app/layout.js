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
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1b1942",
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
