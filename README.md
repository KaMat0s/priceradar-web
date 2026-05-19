# PriceRadar AI · Web Edition · v3.0 · by Vyntrix

> Monitoramento inteligente de preços em lojas brasileiras — **agora como aplicação WEB completa**, responsiva, com login, banco remoto, comunicação externa, acessibilidade e deploy no Vercel.

```
  ◢◣  PRICERADAR AI · v3.0 · WEB
   ╲╱  INTELLIGENCE LAYER · BY VYNTRIX
```

## ▸ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | **Next.js 14 + React + TypeScript** (HTML/CSS/JS) |
| Estilo | **Tailwind CSS** + design system Vyntrix (tokens próprios) |
| Backend | **API Routes serverless** (Node.js, na Vercel) |
| Banco remoto | **Supabase** (PostgreSQL gerenciado) |
| Autenticação | **Supabase Auth** (login + cadastro, e-mail/senha) |
| Comunicação externa | **Resend** (e-mail de alerta de preço) |
| Deploy | **Vercel** |

---

## ▸ Como rodar localmente

```bash
npm install
cp .env.example .env.local      # preencha as variáveis (opcional p/ teste)
npm run dev                     # http://localhost:3000
```

> **Sem configurar nada**, o app já roda em **modo convidado** com dataset de demonstração — útil para avaliação imediata. Configure o Supabase para habilitar login real e banco remoto.

---

## ▸ Configurar o banco remoto (Supabase)

1. Crie um projeto grátis em <https://supabase.com>.
2. Vá em **SQL Editor**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas `profiles`, `watchlist`, `price_history`, `scan_log` com RLS (cada usuário só vê os próprios dados).
3. Em **Project Settings → API**, copie a `Project URL` e a `anon key`.
4. Preencha em `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seuprojeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

## ▸ Configurar comunicação externa (e-mail)

1. Crie conta grátis em <https://resend.com> e gere uma **API Key**.
2. Adicione em `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxx
ALERT_FROM_EMAIL=PriceRadar AI <onboarding@resend.dev>
```

> Sem a chave, o botão **✉ ALERTAR** funciona em *modo preview* (valida o fluxo sem enviar e-mail real), garantindo que a funcionalidade seja demonstrável mesmo sem credenciais.

---

## ▸ Publicar no GitHub

```bash
git init
git add .
git commit -m "PriceRadar AI - web edition v3.0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/priceradar-ai.git
git push -u origin main
```

## ▸ Publicar no Vercel

1. Acesse <https://vercel.com> e clique em **Add New → Project**.
2. Importe o repositório do GitHub. O Vercel detecta **Next.js** automaticamente.
3. Em **Environment Variables**, adicione as 4 variáveis do `.env.example`.
4. Clique em **Deploy**. Em ~1 min sai a URL pública (ex.: `https://priceradar-ai.vercel.app`).

---

## ▸ Funcionalidades

- **Login e cadastro** (Supabase Auth, e-mail/senha + perfil). Cadastro com **validação explícita**: e-mail válido, força de senha (letras+números), confirmação de senha, nome obrigatório.
- **Dashboard** com KPIs animados (resultados, lojas, menor preço, preço médio).
- **Busca multi-loja inteligente** (Mercado Livre via API pública com múltiplos endpoints + Kabum HTML; base curada de referência como complemento honesto).
- **Busca robusta**: normalização de acentos ("memoria" acha "Memória"), tolerância a erros de digitação (*fuzzy*, "supre" acha "Super"), relevância ponderada por token e **resposta honesta quando não há resultado** (não retorna produto errado).
- **IA de preço** (`PricePredictor` portado): detecta *oportunidade*, *alinhado*, *acima da média* e *método do dobro*.
- **Watchlist** persistida no banco remoto + histórico de preços + log de buscas.
- **Comunicação externa**: alerta de preço por e-mail (Resend), com template Vyntrix.
- **Acessibilidade**: ajuste de fonte, alto contraste, redução de movimento, navegação por teclado, ARIA, skip-link, foco visível, `prefers-reduced-motion`.
- **Responsivo**: mobile-first, breakpoints `sm/lg`, grid fluido, tabela com scroll.
- **Design system Vyntrix**: tokens de cor/tipografia/motion, skeleton shimmer, toasts, reveal staggered, radar animado.

---

## ▸ Ajustes feitos após a análise crítica

A revisão apontou pontos a melhorar. O que foi corrigido **no código** (não só documentado):

- **Sistema de busca (ponto crítico)** — `src/lib/scrapers.ts` foi reescrito: normalização de acentos/maiúsculas, busca aproximada com distância de Levenshtein (tolera erro de digitação), relevância **ponderada pelo número/modelo** ("ryzen 9" traz Ryzen 9, não Ryzen 7), Mercado Livre com estratégia de múltiplos endpoints. A **base de referência foi ampliada de ~24 para ~110 modelos** (GPUs, CPUs, RAM, SSD/HD, placas-mãe, fontes, coolers, gabinetes e periféricos), cada um listado nas 6 lojas com variação de preço realista — retornando muitos resultados por busca (até 40). Validação de link mantida.
- **Cadastro explícito** — `src/app/login/page.tsx` ganhou validações claras (formato de e-mail, senha forte, confirmação de senha, nome obrigatório) e textos que deixam o fluxo de "Criar conta" evidente.
- **Comunicação externa** — `/api/alert` usa Resend para envio real de e-mail; sem `RESEND_API_KEY` opera em modo preview transparente (mostra o e-mail que seria enviado), documentado abaixo.
- **Estados de UI** — mensagem honesta de "nenhum resultado" e aviso transparente quando a base curada complementa as fontes ao vivo.
- **Identidade visual Vyntrix reforçada** — `MatrixRain` (chuva de código verde sutil ao fundo, ~11% de opacidade) e `Brandmark`/`SerpentGlyph` (serpente neon + wordmark VYNTRIX em SVG **original**, com glow). Arte autoral inspirada na referência, não cópia. Tudo respeita a acessibilidade: a chuva desliga automaticamente em "alto contraste", "reduzir movimento" e `prefers-reduced-motion`, reagindo em tempo real à barra de acessibilidade.

---

## ▸ Atendimento aos requisitos do desafio

| Requisito | Status | Onde |
|---|---|---|
| Aplicação WEB (HTML/CSS/JS) | ✅ | Next.js + React + Tailwind |
| Responsividade | ✅ | `tailwind`, layout mobile-first |
| UX Design | ✅ | design system Vyntrix portado |
| Linguagem de domínio | ✅ | TypeScript (front) + Node serverless (back) |
| Login | ✅ | `/login` · Supabase Auth |
| Dashboard | ✅ | `/dashboard` · KPIs + resultados |
| Cadastro | ✅ | `/login` aba CADASTRAR · validação + `profiles` |
| Comunicação externa | ✅ | `/api/alert` · Resend (e-mail) |
| Acessibilidade | ✅ | `AccessibilityBar` + CSS a11y |
| Código no GitHub | ✅ | instruções acima |
| Banco de dados remoto | ✅ | Supabase PostgreSQL · `supabase/schema.sql` |
| Publicação no Vercel | ✅ | `vercel.json` + instruções |

---

## ▸ Estrutura

```
priceradar-web/
├── supabase/schema.sql          # banco remoto (tabelas + RLS)
├── vercel.json                  # config de deploy
├── src/
│   ├── app/
│   │   ├── login/page.tsx       # login + cadastro
│   │   ├── dashboard/page.tsx   # app principal
│   │   └── api/
│   │       ├── search/route.ts  # scrapers + IA (serverless)
│   │       └── alert/route.ts   # e-mail (comunicação externa)
│   ├── lib/
│   │   ├── scrapers.ts          # portado de app/scrapers.py
│   │   ├── predictor.ts         # portado de PricePredictor
│   │   ├── categories.ts        # 24 categorias
│   │   └── supabase/            # clients de auth/db
│   └── components/
│       └── AccessibilityBar.tsx
```

```
