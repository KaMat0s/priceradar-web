import { NextRequest, NextResponse } from "next/server";
import { searchAll } from "@/lib/scrapers";
import { analyze } from "@/lib/predictor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  if (query.length < 2) {
    return NextResponse.json({ error: "Consulta muito curta." }, { status: 400 });
  }

  try {
    const t0 = Date.now();
    const { products, sources, usedDemo, note } = await searchAll(query, 40);

    // anexa análise de IA a cada produto
    const enriched = products.map((p) => ({
      ...p,
      ai: analyze(p, products),
    }));

    const prices = products.map((p) => p.price);
    const kpis = {
      total: products.length,
      stores: new Set(products.map((p) => p.store)).size,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      elapsed_ms: Date.now() - t0,
    };

    return NextResponse.json({ query, products: enriched, sources, kpis, usedDemo, note });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Falha na varredura", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
