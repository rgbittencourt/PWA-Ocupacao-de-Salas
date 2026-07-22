import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ocupacao-salas-inovalab.rogerio-bittencourt.chatgpt.site"),
  title: "Ocupação de Salas INOVALAB",
  description: "Painel de ocupação e indicadores dos espaços do INOVALAB.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/favicon.png", type: "image/png" }, { url: "/ocupacao-icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ocupação de Salas" },
  openGraph: {
    title: "Ocupação de Salas INOVALAB",
    description: "Painel de ocupação e indicadores dos espaços do INOVALAB.",
    url: "/",
    siteName: "Ocupação de Salas INOVALAB",
    images: [{ url: "/ocupacao-salas-compartilhamento.png", width: 512, height: 512, alt: "Ocupação de Salas INOVALAB" }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Ocupação de Salas INOVALAB",
    description: "Painel de ocupação e indicadores dos espaços do INOVALAB.",
    images: ["/ocupacao-salas-compartilhamento.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
