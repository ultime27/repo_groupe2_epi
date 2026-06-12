import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERO1 - Déneigement de Montréal",
  description: "Visualiseur de tournées de déneigement (postier chinois)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
