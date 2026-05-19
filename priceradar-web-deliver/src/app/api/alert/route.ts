import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Comunicação externa: envia alerta de preço por e-mail (Resend).
// Sem RESEND_API_KEY => "modo preview" (não envia, mas confirma o fluxo p/ avaliação).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.title) {
    return NextResponse.json({ error: "Campos obrigatórios: to, title" }, { status: 400 });
  }

  const { to, title, store, price, target, url } = body;
  const subject = `🟢 PriceRadar AI · alerta de preço: ${String(title).slice(0, 60)}`;
  const html = `
    <div style="font-family:'JetBrains Mono',monospace;background:#050805;color:#EDEFED;padding:28px;border:1px solid #1E2D1E;border-radius:12px;max-width:560px">
      <div style="color:#39FF14;font-weight:700;letter-spacing:2px;font-size:13px">◢◣ PRICERADAR AI · INTELLIGENCE LAYER</div>
      <h2 style="color:#7BFF5C;margin:18px 0 6px">Alerta de preço disparado</h2>
      <p style="color:#A8B5A8;margin:0 0 16px">Um produto da sua watchlist atingiu a condição monitorada.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="color:#6B7A6B;padding:6px 0">Produto</td><td style="color:#EDEFED;text-align:right">${escapeHtml(title)}</td></tr>
        <tr><td style="color:#6B7A6B;padding:6px 0">Loja</td><td style="color:#EDEFED;text-align:right">${escapeHtml(store || "—")}</td></tr>
        <tr><td style="color:#6B7A6B;padding:6px 0">Preço atual</td><td style="color:#39FF14;text-align:right;font-weight:700">R$ ${Number(price || 0).toFixed(2)}</td></tr>
        <tr><td style="color:#6B7A6B;padding:6px 0">Preço-alvo</td><td style="color:#EDEFED;text-align:right">R$ ${Number(target || 0).toFixed(2)}</td></tr>
      </table>
      ${url ? `<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:20px;background:#39FF14;color:#020402;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700">▸ ABRIR PRODUTO</a>` : ""}
      <p style="color:#46524A;font-size:11px;margin-top:24px">© 2025 VYNTRIX · build vy.3.0.0</p>
    </div>`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Modo preview — fluxo validado sem credencial (não envia e-mail real)
    return NextResponse.json({
      ok: true,
      mode: "preview",
      message:
        "Alerta processado em modo preview. Configure RESEND_API_KEY para envio real.",
      preview: { to, subject },
    });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL || "PriceRadar AI <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, mode: "live", error: data?.message || "Falha no envio" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, mode: "live", id: data?.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}
