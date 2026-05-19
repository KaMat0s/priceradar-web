import type { Metadata, Viewport } from "next";
import "./globals.css";
import MatrixRain from "@/components/MatrixRain";

export const metadata: Metadata = {
  title: "PriceRadar AI · by Vyntrix",
  description:
    "Monitoramento inteligente de preços em 6 lojas brasileiras — versão web responsiva com IA, alertas e acessibilidade.",
};

export const viewport: Viewport = {
  themeColor: "#050805",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MatrixRain />
        <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
