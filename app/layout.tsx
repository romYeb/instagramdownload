import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaGrab — Téléchargeur Instagram",
  description:
    "Téléchargez photos, vidéos, reels et carrousels Instagram en quelques clics. Sans connexion requise.",
  keywords: ["instagram", "download", "télécharger", "reels", "photos"],
  openGraph: {
    title: "InstaGrab — Téléchargeur Instagram",
    description: "Téléchargez tous les médias Instagram publics instantanément.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
