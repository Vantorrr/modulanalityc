import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health AI | Медицинский ассистент",
  description: "Загружайте анализы, получайте расшифровку и персональные рекомендации",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
