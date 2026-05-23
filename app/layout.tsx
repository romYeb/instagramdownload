import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lia Downloader — Instagram & TikTok Downloader",
  description:
    "Téléchargez des photos, vidéos, reels et carrousels Instagram ainsi que des vidéos et slideshows TikTok. Sans connexion requise.",
  keywords: [
    "instagram downloader",
    "tiktok downloader",
    "télécharger instagram",
    "télécharger tiktok",
    "reels",
    "vidéos",
    "photos",
    "carrousels",
    "slideshow",
  ],
  openGraph: {
    title: "Lia Downloader — Instagram & TikTok Downloader",
    description:
      "Téléchargez des médias publics Instagram et TikTok en quelques clics.",
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
