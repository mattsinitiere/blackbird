import "./globals.css";

export const metadata = {
  title: "Blackbird Dart Scoring System",
  description: "Score 501/301/701 and Cricket, track players, and predict matchups.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e8c5a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
