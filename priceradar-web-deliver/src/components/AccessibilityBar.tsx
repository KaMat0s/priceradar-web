"use client";

import { useEffect, useState } from "react";

export default function AccessibilityBar() {
  const [fs, setFs] = useState(1);
  const [hc, setHc] = useState(false);
  const [noMotion, setNoMotion] = useState(false);

  // restaura preferências
  useEffect(() => {
    const f = parseFloat(localStorage.getItem("pr_fs") || "1");
    const h = localStorage.getItem("pr_hc") === "1";
    const m = localStorage.getItem("pr_nm") === "1";
    setFs(f); setHc(h); setNoMotion(m);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--fs", String(fs));
    localStorage.setItem("pr_fs", String(fs));
  }, [fs]);

  useEffect(() => {
    document.documentElement.classList.toggle("hc", hc);
    localStorage.setItem("pr_hc", hc ? "1" : "0");
  }, [hc]);

  useEffect(() => {
    document.documentElement.classList.toggle("no-motion", noMotion);
    localStorage.setItem("pr_nm", noMotion ? "1" : "0");
  }, [noMotion]);

  const btn =
    "px-2.5 py-1 rounded-md border border-borderMid bg-surface text-textSecondary hover:text-accent hover:border-accentDim transition text-xs font-ui font-semibold";

  return (
    <div
      role="region"
      aria-label="Controles de acessibilidade"
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      <span className="font-mono text-textTertiary uppercase tracking-widest hidden sm:inline">
        Acessibilidade
      </span>
      <div className="flex items-center gap-1" role="group" aria-label="Tamanho da fonte">
        <button
          className={btn}
          onClick={() => setFs((v) => Math.max(0.85, +(v - 0.1).toFixed(2)))}
          aria-label="Diminuir tamanho da fonte"
        >
          A−
        </button>
        <span className="font-mono text-textTertiary w-10 text-center" aria-live="polite">
          {Math.round(fs * 100)}%
        </span>
        <button
          className={btn}
          onClick={() => setFs((v) => Math.min(1.5, +(v + 0.1).toFixed(2)))}
          aria-label="Aumentar tamanho da fonte"
        >
          A+
        </button>
      </div>
      <button
        className={btn}
        onClick={() => setHc((v) => !v)}
        aria-pressed={hc}
        aria-label="Alternar alto contraste"
      >
        {hc ? "◑ Contraste: ON" : "◐ Alto contraste"}
      </button>
      <button
        className={btn}
        onClick={() => setNoMotion((v) => !v)}
        aria-pressed={noMotion}
        aria-label="Alternar redução de movimento"
      >
        {noMotion ? "⊘ Movimento: OFF" : "≈ Reduzir movimento"}
      </button>
    </div>
  );
}
