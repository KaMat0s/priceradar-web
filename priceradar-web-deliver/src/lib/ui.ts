// Tipos e helpers seguros para o cliente (sem dependências de servidor)

export interface AIAnalysis {
  trend: string;
  color: string;
  confidence: number;
  summary: string;
}

export interface UIProduct {
  title: string;
  price: number;
  store: string;
  url: string;
  image: string;
  list_price: number | null;
  seller: string | null;
  relevance: number;
  key: string;
  discount_pct: number | null;
  ai: AIAnalysis;
}

export interface KPIs {
  total: number;
  stores: number;
  min: number;
  max: number;
  avg: number;
  elapsed_ms: number;
}

export interface SourceStatus {
  store: string;
  status: string;
  message: string;
  elapsed_ms: number;
  products: unknown[];
}

export function fmtBRL(v: number): string {
  return (
    "R$ " +
    v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

export const STORE_COLOR: Record<string, string> = {
  "Mercado Livre": "#FFE600",
  Kabum: "#FF6500",
  Magalu: "#0086FF",
  Amazon: "#FF9900",
  Pichau: "#E22C2C",
  Terabyte: "#A4D000",
  "Demo Dataset": "#39FF14",
};

export const AI_COLOR: Record<string, string> = {
  accent: "#39FF14",
  accentBright: "#7BFF5C",
  danger: "#FF3366",
  warn: "#FFB800",
  textSecondary: "#A8B5A8",
};
