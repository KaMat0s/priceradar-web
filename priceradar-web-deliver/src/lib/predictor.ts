// PriceRadar AI — IA de previsão de preço
// Portado de PricePredictor (app/window.py) — heurísticas estatísticas locais

import type { Product } from "./scrapers";

export interface Analysis {
  trend: string;
  color: string; // token de cor (accent | accentBright | danger | warn | textSecondary)
  confidence: number;
  summary: string;
}

function fmtBRL(v: number): string {
  return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function analyze(product: Product, allResults: Product[]): Analysis {
  const titleLow = product.title.toLowerCase();
  const keyTokens = titleLow.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);

  const siblings = allResults.filter((p) => {
    if (p.key === product.key) return false;
    const score = keyTokens.filter((t) => p.title.toLowerCase().includes(t)).length;
    return score >= 2;
  });

  const prices = [...siblings.map((p) => p.price), product.price];
  if (prices.length < 2) {
    return {
      trend: "DADOS INSUFICIENTES",
      color: "textSecondary",
      confidence: 25,
      summary:
        "Apenas uma ocorrência localizada. Adicione o produto à watchlist para iniciar o monitoramento — a IA opera com confiabilidade a partir de 5+ pontos de dados.",
    };
  }

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const mn = Math.min(...prices);
  const diffToAvg = ((product.price - avg) / avg) * 100;
  const diffToMin = ((product.price - mn) / mn) * 100;

  if (diffToAvg < -8) {
    return {
      trend: "OPORTUNIDADE DE COMPRA ▼",
      color: "accent",
      confidence: 84,
      summary: `Preço ${Math.abs(diffToAvg).toFixed(1)}% abaixo da média de mercado (${prices.length} cotações, mín ${fmtBRL(mn)}). Sem indícios de método do dobro — recomendamos compra.`,
    };
  }
  if (diffToAvg < 3) {
    return {
      trend: "PREÇO ALINHADO AO MERCADO",
      color: "accentBright",
      confidence: 72,
      summary: `Preço dentro da faixa esperada (média ${fmtBRL(avg)}, mín ${fmtBRL(mn)}). Aguarde alerta de queda ou configure um preço-alvo.`,
    };
  }
  if (diffToMin > 18) {
    return {
      trend: "POSSÍVEL MÉTODO DO DOBRO ▲",
      color: "danger",
      confidence: 88,
      summary: `Preço ${diffToMin.toFixed(1)}% acima do menor preço (${fmtBRL(mn)}). Padrão consistente com inflação artificial antes de promoção. Não recomendamos a compra agora.`,
    };
  }
  return {
    trend: "ACIMA DA MÉDIA ▲",
    color: "warn",
    confidence: 68,
    summary: `Preço ${diffToAvg.toFixed(1)}% acima da média. Existem ofertas melhores em outras lojas — compare antes de finalizar.`,
  };
}

export { fmtBRL };
