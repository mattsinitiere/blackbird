import localFont from "next/font/local";

/**
 * Figtree, self-hosted (SIL Open Font License, see ./fonts/OFL-Figtree.txt).
 * Exposed as the --font-figtree custom property that globals.css builds its
 * font stacks from; next/font hashes the files, preloads them and generates
 * size-matched fallback metrics so text does not shift while they load.
 */
export const figtree = localFont({
  src: [
    { path: "./fonts/figtree-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/figtree-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/figtree-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/figtree-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/figtree-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-figtree",
  display: "swap",
});
