"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import {
  AI_COLOR,
  STORE_COLOR,
  fmtBRL,
  type KPIs,
  type SourceStatus,
  type UIProduct,
} from "@/lib/ui";
import AccessibilityBar from "@/components/AccessibilityBar";
import { SerpentGlyph } from "@/components/Brandmark";

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "err" | "info";
}
interface WatchRow {
  product_key: string;
  title: string;
  store: string;
  url: string;
  current_price: number;
  target_price: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [usedDemo, setUsedDemo] = useState(false);
  const [note, setNote] = useState("");
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<UIProduct | null>(null);
  const [watch, setWatch] = useState<WatchRow[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // ─── auth bootstrap ───
  useEffect(() => {
    (async () => {
      if (!supabaseConfigured) {
        if (sessionStorage.getItem("pr_guest") === "1") {
          setGuest(true);
          setUserName(sessionStorage.getItem("pr_name") || "Convidado");
          loadGuestWatch();
          setReady(true);
        } else {
          router.replace("/login");
        }
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserEmail(data.user.email || "");
      setUserName(
        (data.user.user_metadata?.full_name as string) ||
          data.user.email?.split("@")[0] ||
          "Usuário"
      );
      await loadWatch(supabase, data.user.id);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadGuestWatch() {
    try {
      setWatch(JSON.parse(localStorage.getItem("pr_watch") || "[]"));
    } catch {
      setWatch([]);
    }
  }
  function saveGuestWatch(rows: WatchRow[]) {
    localStorage.setItem("pr_watch", JSON.stringify(rows));
  }

  async function loadWatch(supabase: ReturnType<typeof createClient>, uid: string) {
    const { data } = await supabase
      .from("watchlist")
      .select("product_key,title,store,url,current_price,target_price")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setWatch(data as WatchRow[]);
  }

  async function logout() {
    if (guest) {
      sessionStorage.clear();
    } else {
      await createClient().auth.signOut();
    }
    router.replace("/login");
  }

  // ─── busca ───
  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) return;
      setLoading(true);
      setSearched(true);
      setSelected(null);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Falha na busca");
        setProducts(data.products);
        setKpis(data.kpis);
        setSources(data.sources);
        setUsedDemo(!!data.usedDemo);
        setNote(data.note || "");
        // registra scan_log no banco remoto
        if (!guest && supabaseConfigured) {
          const supabase = createClient();
          const { data: u } = await supabase.auth.getUser();
          if (u.user) {
            await supabase.from("scan_log").insert({
              user_id: u.user.id,
              query: q,
              store: "ALL",
              status: data.products.length ? "OK" : "EMPTY",
              count: data.products.length,
              elapsed_ms: data.kpis?.elapsed_ms ?? 0,
            });
          }
        }
        toast(
          data.products.length
            ? `${data.products.length} resultados em ${data.kpis.elapsed_ms}ms`
            : "Nenhum produto relevante encontrado",
          data.products.length ? "ok" : "info"
        );
      } catch (e: any) {
        toast(e?.message || "Erro na varredura", "err");
        setProducts([]);
        setKpis(null);
      } finally {
        setLoading(false);
      }
    },
    [guest, toast]
  );

  // ─── watchlist ───
  async function toggleWatch(p: UIProduct) {
    const exists = watch.find((w) => w.product_key === p.key);
    if (exists) {
      const rows = watch.filter((w) => w.product_key !== p.key);
      setWatch(rows);
      if (guest) saveGuestWatch(rows);
      else {
        const supabase = createClient();
        const { data: u } = await supabase.auth.getUser();
        if (u.user)
          await supabase
            .from("watchlist")
            .delete()
            .eq("user_id", u.user.id)
            .eq("product_key", p.key);
      }
      toast("Removido da watchlist", "info");
      return;
    }
    const target = Math.round(p.price * 0.9 * 100) / 100;
    const row: WatchRow = {
      product_key: p.key,
      title: p.title,
      store: p.store,
      url: p.url,
      current_price: p.price,
      target_price: target,
    };
    const rows = [row, ...watch];
    setWatch(rows);
    if (guest) saveGuestWatch(rows);
    else {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("watchlist").upsert({
          user_id: u.user.id,
          ...row,
          notify_email: true,
        });
        await supabase.from("price_history").insert({
          user_id: u.user.id,
          product_key: p.key,
          price: p.price,
          store: p.store,
        });
      }
    }
    toast(`Monitorando · alvo ${fmtBRL(target)}`, "ok");
  }

  async function sendAlert(w: WatchRow) {
    const to = userEmail || prompt("Enviar alerta para qual e-mail?") || "";
    if (!to) return;
    toast("Enviando alerta…", "info");
    try {
      const r = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          title: w.title,
          store: w.store,
          price: w.current_price,
          target: w.target_price,
          url: w.url,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.ok === false) throw new Error(d?.error || "Falha");
      toast(
        d.mode === "preview"
          ? "Alerta processado (modo preview — configure RESEND_API_KEY)"
          : `Alerta enviado para ${to}`,
        "ok"
      );
    } catch (e: any) {
      toast(e?.message || "Falha ao enviar alerta", "err");
    }
  }

  const isWatched = (k: string) => watch.some((w) => w.product_key === k);

  if (!ready)
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="font-mono text-accent text-glow animate-pulse tracking-widest">
          ◢◣ INICIALIZANDO…
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-30 backdrop-blur bg-bg1/85 border-b border-borderMid">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <SerpentGlyph size={26} />
            <span className="font-mono text-accent text-glow-strong text-sm tracking-[0.25em]">
              VYNTRIX&nbsp;<span className="text-textTertiary">·</span>&nbsp;PRICERADAR&nbsp;AI
            </span>
            <span className="hidden md:inline font-mono text-[10px] text-textQuat border border-borderSubtle rounded px-2 py-0.5">
              vy.3.0 · web
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AccessibilityBar />
            <div className="h-5 w-px bg-borderMid hidden sm:block" />
            <span className="font-ui text-sm text-textSecondary hidden sm:inline">
              ◈ {userName}
              {guest && (
                <span className="text-warn text-xs ml-1">(convidado)</span>
              )}
            </span>
            <button
              onClick={logout}
              className="font-ui text-xs font-semibold px-3 py-1.5 rounded-lg border border-borderMid text-textSecondary hover:text-danger hover:border-danger/50 transition"
            >
              SAIR
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* ─── BUSCA ─── */}
        <section aria-label="Busca de produtos" className="animate-reveal">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-textPrimary">
            Radar de preços
          </h1>
          <p className="font-ui text-textSecondary text-sm mt-1">
            Varredura em Mercado Livre, Kabum e parceiros · IA detecta método do
            dobro e oportunidades reais.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="mt-4 flex flex-col sm:flex-row gap-2"
            role="search"
          >
            <label htmlFor="q" className="sr-only">
              Buscar produto
            </label>
            <input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex.: RTX 4070 Super, Ryzen 7 7800X3D, monitor gamer…"
              className="flex-1 bg-surface border border-borderMid rounded-xl px-4 py-3 font-ui text-textPrimary placeholder:text-textQuat focus:border-accent outline-none transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-accent text-bg0 font-ui font-bold tracking-wide hover:bg-accentHover transition disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? "VARRENDO…" : "▸ ESCANEAR"}
            </button>
          </form>

          {/* atalhos de categoria */}
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Categorias rápidas">
            {CATEGORIES.slice(0, 12).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  const ex = c.examples[0];
                  setQuery(ex);
                  runSearch(ex);
                }}
                className="font-mono text-[11px] px-2.5 py-1 rounded-md border border-borderSubtle text-textTertiary hover:text-accent hover:border-accentDim transition"
                title={c.label}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* ─── KPIs ─── */}
        {(loading || kpis) && (
          <section
            aria-label="Indicadores"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-7"
          >
            <Kpi label="RESULTADOS" value={kpis?.total ?? 0} loading={loading} />
            <Kpi label="LOJAS" value={kpis?.stores ?? 0} loading={loading} />
            <Kpi
              label="MENOR PREÇO"
              value={kpis?.min ?? 0}
              money
              loading={loading}
            />
            <Kpi
              label="PREÇO MÉDIO"
              value={kpis?.avg ?? 0}
              money
              loading={loading}
            />
          </section>
        )}

        {usedDemo && note && products.length > 0 && (
          <p
            role="status"
            className="mt-4 text-xs font-mono text-warn border border-warn/30 bg-warn/10 rounded-lg px-3 py-2"
          >
            ⓘ {note}
          </p>
        )}

        {/* status das fontes */}
        {sources.length > 0 && !loading && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Status das fontes">
            {sources.map((s) => (
              <span
                key={s.store}
                className="font-mono text-[10px] px-2 py-1 rounded-md border border-borderSubtle"
                style={{
                  color:
                    s.status === "OK"
                      ? "#39FF14"
                      : s.status === "BLOCKED"
                      ? "#FFB800"
                      : "#6B7A6B",
                }}
              >
                {s.store}: {s.status} · {s.elapsed_ms}ms
              </span>
            ))}
          </div>
        )}

        {/* ─── RESULTADOS ─── */}
        <section aria-label="Resultados" className="mt-7" aria-busy={loading}>
          {loading ? (
            <SkeletonGrid />
          ) : products.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p, i) => (
                <ProductCard
                  key={p.key}
                  p={p}
                  index={i}
                  watched={isWatched(p.key)}
                  onSelect={() => setSelected(p)}
                  onWatch={() => toggleWatch(p)}
                />
              ))}
            </div>
          ) : searched ? (
            <Empty note={note} />
          ) : (
            <Intro />
          )}
        </section>

        {/* ─── WATCHLIST ─── */}
        <section aria-label="Watchlist" className="mt-12">
          <h2 className="font-display text-lg font-bold text-textPrimary flex items-center gap-2">
            ◇ Watchlist
            <span className="font-mono text-xs text-textTertiary">
              {watch.length} item(s)
            </span>
          </h2>
          {watch.length === 0 ? (
            <p className="font-ui text-textTertiary text-sm mt-2">
              Nenhum produto monitorado. Use “◇ MONITORAR” em um resultado para
              começar a acompanhar quedas de preço.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-borderMid">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Produtos monitorados com preço atual, alvo e ações
                </caption>
                <thead>
                  <tr className="bg-bg2 text-left font-mono text-[11px] uppercase tracking-wider text-textTertiary">
                    <th scope="col" className="px-4 py-3">
                      Produto
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Loja
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Atual
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Alvo
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {watch.map((w) => (
                    <tr
                      key={w.product_key}
                      className="border-t border-borderSubtle hover:bg-surfaceHover transition"
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <span className="line-clamp-2 text-textPrimary font-ui">
                          {w.title}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs"
                        style={{ color: STORE_COLOR[w.store] || "#A8B5A8" }}
                      >
                        {w.store}
                      </td>
                      <td className="px-4 py-3 font-mono text-textPrimary">
                        {fmtBRL(w.current_price)}
                      </td>
                      <td className="px-4 py-3 font-mono text-accent">
                        {fmtBRL(w.target_price)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-ui text-xs font-semibold px-3 py-1.5 rounded-lg border border-borderMid text-textSecondary hover:text-accent hover:border-accentDim transition"
                          >
                            ABRIR
                          </a>
                          <button
                            onClick={() => sendAlert(w)}
                            className="font-ui text-xs font-semibold px-3 py-1.5 rounded-lg bg-accentFaint text-accent border border-accentDim hover:bg-accentGhost transition"
                          >
                            ✉ ALERTAR
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-16 pb-8 text-center font-mono text-[11px] text-textQuat">
          ◢◣ PRICERADAR AI · © 2025 VYNTRIX · banco remoto{" "}
          {supabaseConfigured ? "Supabase ✓" : "(configurar)"} · deploy Vercel
        </footer>
      </main>

      {/* ─── MODAL IA ─── */}
      {selected && (
        <AIModal
          p={selected}
          watched={isWatched(selected.key)}
          onClose={() => setSelected(null)}
          onWatch={() => toggleWatch(selected)}
        />
      )}

      {/* ─── TOASTS ─── */}
      <div
        className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-xs"
        role="region"
        aria-live="polite"
        aria-label="Notificações"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toastIn font-ui text-sm px-4 py-3 rounded-xl border backdrop-blur bg-surface/90"
            style={{
              borderColor:
                t.kind === "ok"
                  ? "#1F7A10"
                  : t.kind === "err"
                  ? "#7A1A33"
                  : "#1E2D1E",
              color:
                t.kind === "ok"
                  ? "#39FF14"
                  : t.kind === "err"
                  ? "#FF3366"
                  : "#A8B5A8",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── COMPONENTES ───────────────── */

function Kpi({
  label,
  value,
  money,
  loading,
}: {
  label: string;
  value: number;
  money?: boolean;
  loading?: boolean;
}) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    if (loading) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const dur = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisp(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, loading]);

  return (
    <div className="bg-surface border border-borderMid rounded-xl p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-textTertiary">
        {label}
      </div>
      <div className="font-display text-xl sm:text-2xl font-bold text-accent text-glow mt-1.5">
        {loading ? (
          <span className="inline-block w-20 h-6 rounded skeleton animate-shimmer" />
        ) : money ? (
          fmtBRL(disp)
        ) : (
          Math.round(disp)
        )}
      </div>
    </div>
  );
}

function ProductCard({
  p,
  index,
  watched,
  onSelect,
  onWatch,
}: {
  p: UIProduct;
  index: number;
  watched: boolean;
  onSelect: () => void;
  onWatch: () => void;
}) {
  return (
    <article
      className="bg-surface border border-borderMid rounded-2xl p-4 flex flex-col gap-3 hover:border-accentDim transition animate-reveal"
      style={{ animationDelay: `${Math.min(index * 35, 420)}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[10px] font-bold px-2 py-1 rounded-md"
          style={{
            color: STORE_COLOR[p.store] || "#39FF14",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {p.store}
          {p.seller ? ` · ${p.seller}` : ""}
        </span>
        {p.discount_pct && (
          <span className="font-mono text-[10px] font-bold text-bg0 bg-accent px-2 py-1 rounded-md">
            -{p.discount_pct}%
          </span>
        )}
      </div>

      <button
        onClick={onSelect}
        className="text-left font-ui text-sm text-textPrimary line-clamp-3 hover:text-accent transition min-h-[3.6em]"
      >
        {p.title}
      </button>

      <div className="flex items-end justify-between">
        <div>
          {p.list_price && (
            <div className="font-mono text-xs text-textQuat line-through">
              {fmtBRL(p.list_price)}
            </div>
          )}
          <div className="font-display text-xl font-bold text-accent text-glow">
            {fmtBRL(p.price)}
          </div>
        </div>
        <span
          className="font-mono text-[10px] px-2 py-1 rounded-md border"
          style={{
            color: AI_COLOR[p.ai.color] || "#A8B5A8",
            borderColor: (AI_COLOR[p.ai.color] || "#A8B5A8") + "55",
          }}
          title={`Confiança ${p.ai.confidence}%`}
        >
          {p.ai.trend}
        </span>
      </div>

      <div className="flex gap-2 mt-1">
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center font-ui text-xs font-bold px-3 py-2 rounded-lg bg-accent text-bg0 hover:bg-accentHover transition"
        >
          ▸ ABRIR
        </a>
        <button
          onClick={onWatch}
          aria-pressed={watched}
          className={`font-ui text-xs font-bold px-3 py-2 rounded-lg border transition ${
            watched
              ? "bg-accentFaint text-accent border-accentDim"
              : "border-borderMid text-textSecondary hover:text-accent hover:border-accentDim"
          }`}
        >
          {watched ? "◆ MONITORANDO" : "◇ MONITORAR"}
        </button>
      </div>
    </article>
  );
}

function AIModal({
  p,
  watched,
  onClose,
  onWatch,
}: {
  p: UIProduct;
  watched: boolean;
  onClose: () => void;
  onWatch: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const color = AI_COLOR[p.ai.color] || "#A8B5A8";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-bg0/80 backdrop-blur"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Análise de inteligência artificial"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-borderStrong rounded-2xl p-6 glow outline-none animate-reveal"
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-md"
            style={{ color: STORE_COLOR[p.store] || "#39FF14", background: "rgba(255,255,255,0.04)" }}
          >
            {p.store}
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-textTertiary hover:text-danger transition text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <h2 className="font-ui text-base text-textPrimary mt-3">{p.title}</h2>
        <div className="font-display text-3xl font-bold text-accent text-glow mt-3">
          {fmtBRL(p.price)}
        </div>

        <div
          className="mt-5 rounded-xl border p-4"
          style={{ borderColor: color + "55", background: color + "0F" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-textTertiary">
              ◢◣ Análise IA
            </span>
            <span className="font-mono text-xs" style={{ color }}>
              confiança {p.ai.confidence}%
            </span>
          </div>
          <div
            className="font-display text-lg font-bold mt-2"
            style={{ color }}
          >
            {p.ai.trend}
          </div>
          <p className="font-ui text-sm text-textSecondary mt-2 leading-relaxed">
            {p.ai.summary}
          </p>
          <div
            className="mt-3 h-1.5 rounded-full bg-bg2 overflow-hidden"
            role="progressbar"
            aria-valuenow={p.ai.confidence}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${p.ai.confidence}%`, background: color }}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center font-ui text-sm font-bold px-4 py-2.5 rounded-lg bg-accent text-bg0 hover:bg-accentHover transition"
          >
            ▸ ABRIR PRODUTO
          </a>
          <button
            onClick={onWatch}
            className={`font-ui text-sm font-bold px-4 py-2.5 rounded-lg border transition ${
              watched
                ? "bg-accentFaint text-accent border-accentDim"
                : "border-borderMid text-textSecondary hover:text-accent hover:border-accentDim"
            }`}
          >
            {watched ? "◆ MONITORANDO" : "◇ MONITORAR"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface border border-borderMid rounded-2xl p-4 space-y-3"
        >
          <div className="h-5 w-24 rounded skeleton animate-shimmer" />
          <div className="h-4 w-full rounded skeleton animate-shimmer" />
          <div className="h-4 w-3/4 rounded skeleton animate-shimmer" />
          <div className="h-7 w-28 rounded skeleton animate-shimmer" />
          <div className="h-9 w-full rounded skeleton animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

function Empty({ note }: { note?: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-borderMid rounded-2xl">
      <div className="text-4xl text-textQuat">◌</div>
      <h3 className="font-display text-lg font-bold text-textSecondary mt-3">
        Nenhum resultado encontrado
      </h3>
      <p className="font-ui text-sm text-textTertiary mt-1 max-w-md mx-auto">
        {note ||
          'Tente termos mais genéricos (ex.: "rtx 4070", "ssd 1tb", "monitor 27"). A busca tolera acentos e pequenos erros de digitação.'}
      </p>
    </div>
  );
}

function Intro() {
  return (
    <div className="text-center py-16 border border-dashed border-borderMid rounded-2xl">
      <div className="text-5xl text-accent text-glow animate-radarSpin inline-block">
        ◎
      </div>
      <h3 className="font-display text-lg font-bold text-textPrimary mt-4">
        Pronto para escanear
      </h3>
      <p className="font-ui text-sm text-textTertiary mt-1 max-w-md mx-auto">
        Digite um produto ou escolha uma categoria. A IA compara preços entre
        lojas e identifica o “método do dobro”.
      </p>
    </div>
  );
}
