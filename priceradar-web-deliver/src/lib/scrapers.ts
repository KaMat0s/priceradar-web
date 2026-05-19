// ═══════════════════════════════════════════════════════════════════
//  PRICERADAR AI · SCRAPERS · v3.0 (WEB / serverless)
//  Portado de app/scrapers.py — mesma estratégia:
//    • Mercado Livre = fonte primária (API JSON pública, confiável)
//    • Kabum / Magalu = HTML secundário (degrada com elegância)
//    • DemoDataProvider = fallback curado p/ demonstração quando bloqueado
//    • Filtro de relevância (>=50% dos tokens) + validação de URL
// ═══════════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";

export interface Product {
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
}

export interface ScrapeResult {
  store: string;
  products: Product[];
  status: "OK" | "EMPTY" | "TIMEOUT" | "BLOCKED" | "ERROR";
  message: string;
  elapsed_ms: number;
}

// ─── filtro de relevância (normalização + fuzzy) ───
const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "para", "com", "sem", "em", "no", "na",
  "the", "for", "and", "with", "without", "of", "a", "o", "os", "as",
  "pol", "polegadas", "novo", "nova", "original",
]);

// remove acentos/diacríticos e baixa caixa → "Memória" e "memoria" viram iguais
export function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(query: string): string[] {
  const raw = normalize(query).split(" ").filter(Boolean);
  // tokens curtos só entram se forem alfanuméricos relevantes (ex.: "i7", "4k", "rx")
  return raw.filter(
    (t) => !STOP_WORDS.has(t) && (t.length >= 3 || /\d/.test(t))
  );
}

// distância de Levenshtein (tolerância a erro de digitação)
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur.push(Math.min(cur[j] + 1, prev[j + 1] + 1, prev[j] + cost));
    }
    prev = cur;
  }
  return prev[b.length];
}

// 1 token "casa" com o título se: substring exata significativa, OU
// contenção parcial entre tokens longos, OU erro de digitação pequeno.
// Tokens curtos NÃO geram match parcial (evita "a" casar com "geladeira").
function tokenMatch(token: string, titleTokens: string[], titleFlat: string): number {
  if (token.length >= 3 && titleFlat.includes(token)) return 1;
  // tokens de modelo (i9, i7, rx, "9", "7"...) casam como token inteiro
  if (/\d/.test(token) && titleTokens.includes(token)) return 1;
  const numericOnly = /^\d+$/.test(token); // "4070" não deve "casar" com "4080"
  let best = 0;
  for (const tt of titleTokens) {
    if (tt.length < 3) continue; // ignora ruído ("a", "ii", "x")
    // contenção parcial só vale entre tokens de tamanho razoável
    const shorter = Math.min(tt.length, token.length);
    if (shorter >= 4 && (tt.includes(token) || token.includes(tt))) {
      best = Math.max(best, 0.85);
      continue;
    }
    if (numericOnly) continue; // sem fuzzy em número puro (modelo é exato)
    // tolerância a erro de digitação: distância pequena E proporcional
    const maxLen = Math.max(tt.length, token.length);
    if (maxLen >= 4 && Math.abs(tt.length - token.length) <= 2) {
      const d = levenshtein(tt, token);
      const limit = maxLen >= 8 ? 2 : 1;
      if (d <= limit && d / maxLen <= 0.34) best = Math.max(best, 0.72);
    }
  }
  return best;
}

// Relevância ponderada: o NÚMERO/MODELO ("9", "4070", "1tb") é o mais
// discriminante. "ryzen 9" não deve trazer "ryzen 7".
function relevance(title: string, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const flat = normalize(title);
  const titleTokens = flat.split(" ").filter(Boolean);
  const modelT = tokens.filter((t) => /\d/.test(t));
  const wordT = tokens.filter((t) => !/\d/.test(t));
  const avg = (arr: string[]) =>
    arr.length === 0
      ? 1
      : arr.reduce((s, t) => s + tokenMatch(t, titleTokens, flat), 0) / arr.length;
  const wordScore = avg(wordT);
  const modelScore = avg(modelT);
  if (modelT.length === 0) return wordScore; // só palavras
  if (wordT.length === 0) return modelScore; // só modelo
  if (modelScore === 0) return wordScore * 0.35; // modelo errado → descarta
  return 0.45 * wordScore + 0.55 * modelScore;
}

// limiar firme — a busca fuzzy/normalizada compensa termos livres sem
// deixar passar produtos não relacionados
const MIN_RELEVANCE = 0.5;

function parseBRL(text: string): number | null {
  if (!text) return null;
  const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*,\d{2}|\d+,\d{2}|\d+\.?\d*)/);
  if (!m) return null;
  const s = m[1].replace(/[.\s]/g, "").replace(",", ".");
  const v = parseFloat(s);
  return v > 0 ? v : null;
}

function validUrl(u: string): boolean {
  if (!u) return false;
  u = u.trim();
  return u.startsWith("http://") || u.startsWith("https://");
}

function sha(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function makeProduct(p: Partial<Product> & { title: string; price: number; store: string; url: string }): Product {
  const list = p.list_price ?? null;
  const discount = list && list > p.price && p.price > 0
    ? Math.round((1 - p.price / list) * 1000) / 10 : null;
  return {
    title: p.title, price: p.price, store: p.store, url: p.url,
    image: p.image || "", list_price: list, seller: p.seller ?? null,
    relevance: p.relevance ?? 1,
    key: sha(`${p.store}|${p.title}|${p.url}`),
    discount_pct: discount,
  };
}

// ─── Mercado Livre — API pública (fonte primária, roda no servidor) ───
const KNOWN_ML_SELLERS: Record<string, string> = {
  kabum: "Kabum", kabumstore: "Kabum", magazineluiza: "Magalu", magalu: "Magalu",
  amazon: "Amazon", pichau: "Pichau", pichauinformatica: "Pichau",
  terabyteshop: "Terabyte", terabyte: "Terabyte",
};

async function scrapeMercadoLivre(query: string, limit: number): Promise<Product[]> {
  const q = encodeURIComponent(query.trim());
  const lim = Math.min(limit, 50);
  // estratégia de múltiplos endpoints — se um for bloqueado, tenta o próximo
  const endpoints = [
    `https://api.mercadolibre.com/sites/MLB/search?q=${q}&limit=${lim}`,
    `https://api.mercadolibre.com/sites/MLB/search?q=${q}&limit=${lim}&official_store=all`,
  ];
  let data: any = null;
  let lastErr = "";
  for (const url of endpoints) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            Accept: "application/json,text/plain,*/*",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          signal: AbortSignal.timeout(13000),
        });
        if (r.status === 200) {
          data = await r.json();
          break;
        }
        lastErr = `HTTP ${r.status}`;
        if ([403, 429, 500, 502, 503].includes(r.status) && attempt < 2) {
          await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
          continue;
        }
        break;
      } catch (e: any) {
        lastErr = String(e?.message || e);
        if (attempt < 2) {
          await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
          continue;
        }
      }
    }
    if (data?.results?.length) break;
  }
  if (!data) throw new Error(lastErr || "sem resposta");
  const products: Product[] = [];
  for (const item of data.results || []) {
    const price = item.price;
    if (!price || price <= 0) continue;
    const permalink = item.permalink || "";
    if (!validUrl(permalink)) continue;
    const nick = (item.seller?.nickname || "").toLowerCase();
    let sellerName = "Mercado Livre";
    for (const [k, v] of Object.entries(KNOWN_ML_SELLERS)) if (nick.includes(k)) sellerName = v;
    products.push(makeProduct({
      title: (item.title || "").slice(0, 140),
      price: Number(price),
      store: "Mercado Livre",
      seller: sellerName !== "Mercado Livre" ? sellerName : null,
      url: permalink,
      image: (item.thumbnail || "").replace("-I.jpg", "-O.jpg"),
      list_price: item.original_price ? Number(item.original_price) : null,
    }));
  }
  return products;
}

// ─── Kabum — HTML secundário ───
async function scrapeKabum(query: string, limit: number): Promise<Product[]> {
  const r = await fetch(`https://www.kabum.com.br/busca/${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36", "Accept-Language": "pt-BR,pt;q=0.9" },
    signal: AbortSignal.timeout(14000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const $ = cheerio.load(await r.text());
  const products: Product[] = [];
  const seen = new Set<string>();
  $('article[class*="productCard"], div[class*="productCard"], a[href*="/produto/"]').each((_, el) => {
    if (products.length >= limit * 2) return;
    const c = $(el);
    const a = el.tagName === "a" ? c : c.find("a[href]").first();
    let href = a.attr("href") || "";
    if (!href || seen.has(href)) return;
    seen.add(href);
    if (href.startsWith("/")) href = "https://www.kabum.com.br" + href;
    const title = (c.find("h2,h3,span").first().text() || "").trim().slice(0, 140);
    if (title.length < 10) return;
    const price = parseBRL(c.text());
    if (!price) return;
    products.push(makeProduct({ title, price, store: "Kabum", url: href, image: c.find("img").attr("src") || "" }));
  });
  return products;
}

// ═══════════════════════════════════════════════════════════════════
//  BASE DE REFERÊNCIA — catálogo curado de preços (fallback honesto)
//  Cada produto é listado nas 6 lojas com variação de preço realista
//  e DETERMINÍSTICA (estável entre chamadas). Usada quando as fontes
//  ao vivo estão indisponíveis. Preços-base aproximados (BR, 2025).
// ═══════════════════════════════════════════════════════════════════

// [nome exibido, preço-base BRL, termo para o link de busca da loja]
type RefItem = [string, number, string];

const REF_CATALOG: RefItem[] = [
  // ─── GPUs NVIDIA ───
  ["Placa de Vídeo NVIDIA GeForce RTX 4090 24GB GDDR6X", 13499, "rtx 4090"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4080 Super 16GB GDDR6X", 7799, "rtx 4080 super"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4080 16GB GDDR6X", 7499, "rtx 4080"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4070 Ti Super 16GB GDDR6X", 5499, "rtx 4070 ti super"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4070 Ti 12GB GDDR6X", 4999, "rtx 4070 ti"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4070 Super 12GB GDDR6X", 4199, "rtx 4070 super"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4070 12GB GDDR6X", 3799, "rtx 4070"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4060 Ti 16GB GDDR6", 2999, "rtx 4060 ti 16gb"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4060 Ti 8GB GDDR6", 2599, "rtx 4060 ti"],
  ["Placa de Vídeo NVIDIA GeForce RTX 4060 8GB GDDR6", 1999, "rtx 4060"],
  ["Placa de Vídeo NVIDIA GeForce RTX 3060 12GB GDDR6", 1699, "rtx 3060"],
  ["Placa de Vídeo NVIDIA GeForce RTX 3050 8GB GDDR6", 1299, "rtx 3050"],
  // ─── GPUs AMD ───
  ["Placa de Vídeo AMD Radeon RX 7900 XTX 24GB GDDR6", 6999, "rx 7900 xtx"],
  ["Placa de Vídeo AMD Radeon RX 7900 XT 20GB GDDR6", 5499, "rx 7900 xt"],
  ["Placa de Vídeo AMD Radeon RX 7800 XT 16GB GDDR6", 3499, "rx 7800 xt"],
  ["Placa de Vídeo AMD Radeon RX 7700 XT 12GB GDDR6", 2999, "rx 7700 xt"],
  ["Placa de Vídeo AMD Radeon RX 7600 8GB GDDR6", 1799, "rx 7600"],
  ["Placa de Vídeo AMD Radeon RX 6750 XT 12GB GDDR6", 2499, "rx 6750 xt"],
  ["Placa de Vídeo AMD Radeon RX 6650 XT 8GB GDDR6", 1599, "rx 6650 xt"],
  // ─── GPUs Intel ───
  ["Placa de Vídeo Intel Arc A770 16GB GDDR6", 2199, "arc a770"],
  ["Placa de Vídeo Intel Arc A750 8GB GDDR6", 1699, "arc a750"],
  // ─── CPUs AMD AM5 ───
  ["Processador AMD Ryzen 9 7950X3D 16-Core 32-Threads AM5 5.7GHz", 3999, "ryzen 9 7950x3d"],
  ["Processador AMD Ryzen 9 7950X 16-Core 32-Threads AM5 5.7GHz", 3299, "ryzen 9 7950x"],
  ["Processador AMD Ryzen 9 7900X 12-Core 24-Threads AM5 5.6GHz", 2599, "ryzen 9 7900x"],
  ["Processador AMD Ryzen 9 7900 12-Core 24-Threads AM5 5.4GHz", 2399, "ryzen 9 7900"],
  ["Processador AMD Ryzen 7 7800X3D 8-Core 16-Threads AM5 5.0GHz", 2899, "ryzen 7 7800x3d"],
  ["Processador AMD Ryzen 7 7700X 8-Core 16-Threads AM5 5.4GHz", 1999, "ryzen 7 7700x"],
  ["Processador AMD Ryzen 7 7700 8-Core 16-Threads AM5 5.3GHz", 1899, "ryzen 7 7700"],
  ["Processador AMD Ryzen 7 8700G 8-Core Radeon 780M AM5 5.1GHz", 2199, "ryzen 7 8700g"],
  ["Processador AMD Ryzen 5 7600X 6-Core 12-Threads AM5 5.3GHz", 1499, "ryzen 5 7600x"],
  ["Processador AMD Ryzen 5 7600 6-Core 12-Threads AM5 5.1GHz", 1399, "ryzen 5 7600"],
  ["Processador AMD Ryzen 5 8600G 6-Core Radeon 760M AM5 5.0GHz", 1499, "ryzen 5 8600g"],
  // ─── CPUs AMD AM4 ───
  ["Processador AMD Ryzen 7 5800X3D 8-Core 16-Threads AM4 4.5GHz", 1799, "ryzen 7 5800x3d"],
  ["Processador AMD Ryzen 7 5700X 8-Core 16-Threads AM4 4.6GHz", 999, "ryzen 7 5700x"],
  ["Processador AMD Ryzen 5 5600X 6-Core 12-Threads AM4 4.6GHz", 799, "ryzen 5 5600x"],
  ["Processador AMD Ryzen 5 5600 6-Core 12-Threads AM4 4.4GHz", 699, "ryzen 5 5600"],
  ["Processador AMD Ryzen 5 5500 6-Core 12-Threads AM4 4.2GHz", 549, "ryzen 5 5500"],
  // ─── CPUs Intel LGA1700 ───
  ["Processador Intel Core i9-14900K 24-Core LGA1700 6.0GHz", 3699, "i9 14900k"],
  ["Processador Intel Core i9-14900KF 24-Core LGA1700 6.0GHz", 3499, "i9 14900kf"],
  ["Processador Intel Core i7-14700K 20-Core LGA1700 5.6GHz", 2599, "i7 14700k"],
  ["Processador Intel Core i7-14700KF 20-Core LGA1700 5.6GHz", 2449, "i7 14700kf"],
  ["Processador Intel Core i5-14600K 14-Core LGA1700 5.3GHz", 1899, "i5 14600k"],
  ["Processador Intel Core i5-14400F 10-Core LGA1700 4.7GHz", 1199, "i5 14400f"],
  ["Processador Intel Core i5-13400F 10-Core LGA1700 4.6GHz", 1099, "i5 13400f"],
  ["Processador Intel Core i3-14100F 4-Core LGA1700 4.7GHz", 749, "i3 14100f"],
  ["Processador Intel Core i3-12100F 4-Core LGA1700 4.3GHz", 549, "i3 12100f"],
  // ─── Memória RAM DDR5 ───
  ["Memória RAM DDR5 16GB 5600MHz CL40", 299, "memoria ddr5 16gb"],
  ["Memória RAM DDR5 16GB 6000MHz CL36 RGB", 349, "memoria ddr5 16gb 6000"],
  ["Memória RAM DDR5 32GB (2x16GB) 6000MHz CL30 RGB", 749, "memoria ddr5 32gb"],
  ["Memória RAM DDR5 32GB (2x16GB) 6400MHz CL32 RGB", 899, "memoria ddr5 32gb 6400"],
  ["Memória RAM DDR5 64GB (2x32GB) 6000MHz CL30", 1599, "memoria ddr5 64gb"],
  // ─── Memória RAM DDR4 ───
  ["Memória RAM DDR4 8GB 3200MHz CL16", 149, "memoria ddr4 8gb"],
  ["Memória RAM DDR4 16GB 3200MHz CL16", 259, "memoria ddr4 16gb"],
  ["Memória RAM DDR4 16GB 3600MHz CL18 RGB", 299, "memoria ddr4 16gb 3600"],
  ["Memória RAM DDR4 32GB (2x16GB) 3200MHz CL16", 499, "memoria ddr4 32gb"],
  // ─── Armazenamento ───
  ["SSD NVMe 500GB M.2 PCIe 4.0 Gen4 3500MB/s", 269, "ssd nvme 500gb"],
  ["SSD NVMe 1TB M.2 PCIe 4.0 Gen4 5000MB/s", 399, "ssd nvme 1tb"],
  ["SSD NVMe 2TB M.2 PCIe 4.0 Gen4 7000MB/s", 749, "ssd nvme 2tb"],
  ["SSD NVMe 1TB M.2 PCIe 5.0 Gen5 10000MB/s", 899, "ssd nvme 1tb gen5"],
  ["SSD NVMe 4TB M.2 PCIe 4.0 Gen4 7000MB/s", 1799, "ssd nvme 4tb"],
  ["SSD SATA 480GB 2.5\" 550MB/s", 199, "ssd 480gb"],
  ["SSD SATA 1TB 2.5\" 560MB/s", 349, "ssd 1tb"],
  ["HD HDD 1TB 7200RPM SATA 3.5\"", 249, "hd 1tb"],
  ["HD HDD 2TB 7200RPM SATA 3.5\"", 379, "hd 2tb"],
  ["HD HDD 4TB 5400RPM SATA 3.5\"", 599, "hd 4tb"],
  // ─── Placas-mãe ───
  ["Placa-Mãe B650 AM5 DDR5 ATX PCIe 4.0 WiFi", 1199, "placa mae b650"],
  ["Placa-Mãe B650E AM5 DDR5 ATX PCIe 5.0 WiFi", 1699, "placa mae b650e"],
  ["Placa-Mãe X670E AM5 DDR5 ATX PCIe 5.0 WiFi", 2499, "placa mae x670e"],
  ["Placa-Mãe B550 AM4 DDR4 ATX PCIe 4.0", 799, "placa mae b550"],
  ["Placa-Mãe X570 AM4 DDR4 ATX PCIe 4.0 WiFi", 1199, "placa mae x570"],
  ["Placa-Mãe B760 LGA1700 DDR5 ATX PCIe 4.0", 999, "placa mae b760"],
  ["Placa-Mãe Z790 LGA1700 DDR5 ATX PCIe 5.0 WiFi", 1999, "placa mae z790"],
  ["Placa-Mãe H610 LGA1700 DDR4 mATX", 549, "placa mae h610"],
  ["Placa-Mãe A620 AM5 DDR5 mATX", 699, "placa mae a620"],
  // ─── Fontes ───
  ["Fonte 550W 80 Plus Bronze ATX", 329, "fonte 550w"],
  ["Fonte 650W 80 Plus Bronze ATX", 399, "fonte 650w"],
  ["Fonte 750W 80 Plus Gold Modular ATX 3.0", 599, "fonte 750w"],
  ["Fonte 850W 80 Plus Gold Full Modular ATX 3.0", 749, "fonte 850w"],
  ["Fonte 1000W 80 Plus Gold Full Modular ATX 3.0", 999, "fonte 1000w"],
  ["Fonte 1200W 80 Plus Platinum Full Modular", 1499, "fonte 1200w"],
  // ─── Refrigeração ───
  ["Air Cooler CPU Torre Dupla 120mm 4 Heatpipes", 199, "air cooler"],
  ["Water Cooler 240mm ARGB Intel/AMD", 549, "water cooler 240"],
  ["Water Cooler 360mm ARGB Intel/AMD", 849, "water cooler 360"],
  ["Water Cooler 420mm ARGB Intel/AMD", 1099, "water cooler 420"],
  ["Kit 3 Fans 120mm ARGB com Controladora", 199, "fan 120mm argb"],
  // ─── Gabinetes ───
  ["Gabinete Gamer Mid-Tower ATX Vidro Temperado", 449, "gabinete gamer"],
  ["Gabinete Gamer mATX Compacto Vidro", 299, "gabinete matx"],
  ["Gabinete Full-Tower ATX Airflow Vidro", 899, "gabinete full tower"],
  // ─── Periféricos ───
  ["Teclado Mecânico Gamer RGB ABNT2 Switch Red", 299, "teclado mecanico"],
  ["Teclado Mecânico Sem Fio 75% Hot-Swap RGB", 599, "teclado mecanico sem fio"],
  ["Mouse Gamer Sem Fio 26000 DPI 60g Leve", 349, "mouse gamer sem fio"],
  ["Mouse Gamer USB 16000 DPI RGB", 159, "mouse gamer"],
  ["Headset Gamer 7.1 Surround USB com Microfone", 349, "headset gamer"],
  ["Headset Gamer Sem Fio Low Latency 2.4GHz", 699, "headset gamer sem fio"],
  ["Monitor Gamer 24\" Full HD 144Hz 1ms VA", 899, "monitor 24 144hz"],
  ["Monitor Gamer 27\" QHD 165Hz IPS 1ms", 1799, "monitor 27 qhd 165hz"],
  ["Monitor Gamer 27\" Full HD 180Hz IPS", 1199, "monitor 27 180hz"],
  ["Monitor Gamer 32\" 4K UHD 144Hz IPS HDR", 3499, "monitor 32 4k"],
  ["Monitor Ultrawide 34\" QHD 165Hz Curvo", 2999, "monitor ultrawide 34"],
  ["Mousepad Gamer Speed Grande 90x40cm", 89, "mousepad gamer"],
  ["Cadeira Gamer Reclinável Apoio Lombar", 1199, "cadeira gamer"],
  ["Microfone USB Condensador Streaming Cardioide", 599, "microfone usb"],
  ["Webcam Full HD 1080p 60fps com Tripé", 349, "webcam full hd"],
  ["Controle Sem Fio para PC e Console", 349, "controle sem fio"],
  ["Caixa de Som Gamer 2.1 RGB Bluetooth", 299, "caixa de som gamer"],
  ["Placa de Captura 4K USB para Streaming", 799, "placa de captura"],
  ["Placa de Som USB 7.1 Externa", 299, "placa de som usb"],
];

const REF_STORES: { store: string; url: (t: string) => string }[] = [
  { store: "Kabum", url: (t) => `https://www.kabum.com.br/busca/${t.replace(/\s+/g, "-")}` },
  { store: "Mercado Livre", url: (t) => `https://lista.mercadolivre.com.br/${t.replace(/\s+/g, "-")}` },
  { store: "Pichau", url: (t) => `https://www.pichau.com.br/search?q=${encodeURIComponent(t)}` },
  { store: "Terabyte", url: (t) => `https://www.terabyteshop.com.br/busca?str=${encodeURIComponent(t)}` },
  { store: "Magalu", url: (t) => `https://www.magazineluiza.com.br/busca/${encodeURIComponent(t)}/` },
  { store: "Amazon", url: (t) => `https://www.amazon.com.br/s?k=${encodeURIComponent(t)}` },
];

let _refCache: Product[] | null = null;
function refListings(): Product[] {
  if (_refCache) return _refCache;
  const out: Product[] = [];
  for (const [name, base, term] of REF_CATALOG) {
    const seed = parseInt(sha(name).slice(0, 8), 16) || 1;
    REF_STORES.forEach((s, i) => {
      // variação determinística -7%..+11% por loja (estável entre chamadas)
      const pct = (((seed >> (i * 4)) % 19) - 7) / 100;
      const price = Math.max(1, Math.round(base * (1 + pct)));
      const promo = ((seed >> i) & 3) === 0; // ~25% com preço "de/por"
      const list = promo ? Math.round(price * (1.08 + ((seed >> i) % 14) / 100)) : null;
      out.push(
        makeProduct({
          title: name,
          price,
          store: s.store,
          url: s.url(term),
          list_price: list,
          relevance: 1,
        })
      );
    });
  }
  _refCache = out;
  return out;
}

// Fallback honesto: pontua CADA item pelo título contra o termo buscado.
// Catálogo amplo (~110 modelos × 6 lojas) → muitos resultados relevantes.
function demoSearch(query: string): Product[] {
  const tokens = significantTokens(query);
  if (tokens.length === 0) return [];
  const scored: { p: Product; r: number }[] = [];
  for (const p of refListings()) {
    const r = relevance(p.title, tokens);
    if (r >= MIN_RELEVANCE) scored.push({ p: { ...p, relevance: r }, r });
  }
  return scored.sort((a, b) => b.r - a.r || a.p.price - b.p.price).map((x) => x.p);
}

// ─── Agregador: roda fontes em paralelo, aplica filtros, com fallback ───
export interface SearchResponse {
  products: Product[];
  sources: ScrapeResult[];
  usedDemo: boolean;
  note: string;
}

export async function searchAll(query: string, limit = 40): Promise<SearchResponse> {
  const tokens = significantTokens(query);
  const sources: ScrapeResult[] = [];

  const runners: { name: string; fn: () => Promise<Product[]> }[] = [
    { name: "Mercado Livre", fn: () => scrapeMercadoLivre(query, limit) },
    { name: "Kabum", fn: () => scrapeKabum(query, limit) },
  ];

  let all: Product[] = [];
  let liveBlocked = 0;
  await Promise.all(
    runners.map(async (s) => {
      const t0 = Date.now();
      try {
        const raw = await s.fn();
        const filtered = raw
          .map((p) => ({ ...p, relevance: relevance(p.title, tokens) }))
          .filter((p) => p.relevance >= MIN_RELEVANCE && validUrl(p.url));
        all = all.concat(filtered);
        sources.push({
          store: s.name, products: filtered,
          status: filtered.length ? "OK" : "EMPTY",
          message: filtered.length ? "" : "Nenhum produto relevante.",
          elapsed_ms: Date.now() - t0,
        });
      } catch (e: any) {
        const msg = String(e?.message || e);
        const blocked = msg.includes("403") || msg.includes("429") || msg.includes("503");
        if (blocked) liveBlocked++;
        sources.push({
          store: s.name, products: [],
          status: blocked ? "BLOCKED" : "ERROR",
          message: msg.slice(0, 120), elapsed_ms: Date.now() - t0,
        });
      }
    })
  );

  let usedDemo = false;
  let note = "";
  // usa o dataset curado se as fontes ao vivo vieram vazias OU muito escassas
  if (all.length < 3) {
    const demo = demoSearch(query);
    if (demo.length) {
      usedDemo = true;
      const seedKeys = new Set(all.map((p) => p.key));
      for (const d of demo) if (!seedKeys.has(d.key)) all.push(d);
      note =
        all.length > demo.length
          ? "Resultados ao vivo complementados com base curada de referência."
          : liveBlocked > 0
          ? "Fontes ao vivo indisponíveis no momento — exibindo base curada de preços de referência."
          : "Exibindo base curada de preços de referência.";
      sources.push({
        store: "Base de referência", products: demo, status: "OK",
        message: note, elapsed_ms: 0,
      });
    }
  }

  // de-dup por key, ordena por relevância desc, preço asc
  const byKey = new Map<string, Product>();
  for (const p of all) if (!byKey.has(p.key)) byKey.set(p.key, p);
  const products = [...byKey.values()]
    .sort((a, b) => b.relevance - a.relevance || a.price - b.price)
    .slice(0, limit);

  if (products.length === 0) {
    note = `Nenhum resultado encontrado para “${query.trim()}”. Tente termos mais genéricos (ex.: "rtx 4070", "ssd 1tb", "monitor 27").`;
  }

  return { products, sources, usedDemo, note };
}
