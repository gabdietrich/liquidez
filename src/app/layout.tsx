import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Liquidez Dashboard | Gestão de Ativos",
  description: "Visualize janelas de liquidez, vencimentos e rentabilidade real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b bg-card">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
            <Link
              href="/"
              className="font-semibold text-primary hover:underline"
            >
              Liquidez Dashboard
            </Link>
            <Link
              href="/input"
              className="text-muted-foreground hover:text-foreground"
            >
              Input Inteligente
            </Link>
            <Link
              href="/investimentos"
              className="text-muted-foreground hover:text-foreground"
            >
              Investimentos
            </Link>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
