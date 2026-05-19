"use client";

import { useEffect, useRef } from "react";

/**
 * Chuva de código estilo "Matrix" — identidade visual Vyntrix.
 * Renderiza atrás de todo o conteúdo, em baixa opacidade, para não
 * prejudicar a leitura. Desliga automaticamente quando:
 *   • o usuário ativa "Reduzir movimento" (html.no-motion)
 *   • o usuário ativa "Alto contraste"   (html.hc)
 *   • o sistema pede prefers-reduced-motion: reduce
 * Reage em tempo real às mudanças na barra de acessibilidade.
 */
export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GLYPHS =
      "01010110ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾉﾊﾋﾌﾍﾎ01ｱｦｲｸｺｿﾝ01".split("");
    const FONT = 15;
    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    let running = false;

    const motionOff = () => {
      const el = document.documentElement;
      const prefersReduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return (
        prefersReduce ||
        el.classList.contains("no-motion") ||
        el.classList.contains("hc")
      );
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / FONT);
      drops = Array.from({ length: cols }, () =>
        Math.floor((Math.random() * canvas.height) / FONT)
      );
    };

    const frame = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (t - last < 58) return; // ritmo calmo (~17fps) — discreto
      last = t;

      // rastro: leve fade do quadro anterior
      ctx.fillStyle = "rgba(5, 8, 5, 0.16)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${FONT}px "JetBrains Mono", monospace`;

      for (let i = 0; i < cols; i++) {
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const x = i * FONT;
        const y = drops[i] * FONT;
        // caractere "líder" mais brilhante
        ctx.fillStyle = "rgba(180, 255, 150, 0.85)";
        ctx.fillText(ch, x, y);
        ctx.fillStyle = "rgba(57, 255, 20, 0.45)";
        ctx.fillText(
          GLYPHS[(Math.random() * GLYPHS.length) | 0],
          x,
          y - FONT
        );
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        else drops[i]++;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const apply = () => {
      if (motionOff()) stop();
      else start();
    };

    resize();
    apply();

    window.addEventListener("resize", resize);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener?.("change", apply);
    // reage à barra de acessibilidade (classes em <html>)
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      mq.removeEventListener?.("change", apply);
      obs.disconnect();
    };
  }, []);

  return <canvas id="vyntrix-rain" ref={ref} aria-hidden="true" />;
}
