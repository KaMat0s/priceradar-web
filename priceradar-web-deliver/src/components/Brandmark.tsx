"use client";

/**
 * Identidade visual Vyntrix — arte ORIGINAL em SVG (não é a imagem enviada,
 * apenas inspirada nela): serpente neon coilada + wordmark VYNTRIX com glow.
 */

export function SerpentGlyph({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 100 118"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="vyn-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b6ff8e" />
          <stop offset="0.5" stopColor="#39ff14" />
          <stop offset="1" stopColor="#1f9c0a" />
        </linearGradient>
        <filter id="vyn-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#vyn-glow)" stroke="url(#vyn-body)" strokeLinecap="round">
        {/* corpo coilado em S */}
        <path
          d="M50 14
             C 26 14, 22 36, 40 44
             C 60 53, 78 60, 70 80
             C 64 96, 40 98, 30 90"
          strokeWidth="9"
          fill="none"
        />
        {/* escamas / ticks tech ao longo do corpo */}
        <g strokeWidth="2.4" opacity="0.7">
          <path d="M44 30 l7 -3" />
          <path d="M52 46 l7 3" />
          <path d="M67 70 l-7 3" />
          <path d="M40 88 l4 6" />
        </g>
      </g>

      {/* cabeça em diamante */}
      <g filter="url(#vyn-glow)">
        <path
          d="M50 6 L62 17 L50 30 L38 17 Z"
          fill="url(#vyn-body)"
          stroke="#d8ffc4"
          strokeWidth="1.5"
        />
        <circle cx="45.5" cy="16" r="1.9" fill="#04210a" />
        <circle cx="54.5" cy="16" r="1.9" fill="#04210a" />
        {/* língua bífida */}
        <path
          d="M50 30 L50 38 M50 38 L46 43 M50 38 L54 43"
          stroke="#39ff14"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* cauda */}
      <path
        d="M30 90 L22 96 L26 84"
        fill="url(#vyn-body)"
        filter="url(#vyn-glow)"
      />
    </svg>
  );
}

export function Brandmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <SerpentGlyph size={58} className="animate-reveal" />
      <svg
        viewBox="0 0 360 84"
        className="mt-3 w-[220px] sm:w-[260px]"
        aria-label="VYNTRIX"
        role="img"
      >
        <defs>
          <linearGradient id="vyn-text" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8ffc4" />
            <stop offset="0.55" stopColor="#39ff14" />
            <stop offset="1" stopColor="#1f9c0a" />
          </linearGradient>
          <filter id="vyn-tglow" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text
          x="50%"
          y="58"
          textAnchor="middle"
          fontFamily='var(--font-display), "Orbitron", sans-serif'
          fontWeight="900"
          fontSize="56"
          letterSpacing="6"
          fill="url(#vyn-text)"
          stroke="#0c2b06"
          strokeWidth="0.6"
          filter="url(#vyn-tglow)"
        >
          VYNTRIX
        </text>
      </svg>
      <div className="font-mono text-textTertiary text-[11px] tracking-[0.35em] mt-2">
        PRICERADAR&nbsp;AI · v3.0
      </div>
    </div>
  );
}
