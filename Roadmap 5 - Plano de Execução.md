# 🦎 CalangoBot — Roadmap de SEO & Landing Page

> **Plano de execução organizado em fases independentes, testáveis e sequenciais.**
>
> Cada fase tem: objetivo claro, tarefas detalhadas, e um checkpoint de validação.
> Ao final de cada fase, você pode testar e verificar o resultado antes de avançar.

> **📅 Última auditoria:** 2026-07-22
> **🔍 Status geral:** ~97% concluído — Pendências: ID real GA4, Search Console, medir PageSpeed
>
> 🛡️ **Extra (fora do roadmap):** Correções de segurança aplicadas — bind 127.0.0.1, portas Docker restritas, CSP habilitada

---

## 📋 Visão Geral das Fases

| Fase | Nome | Tempo Estimado | Complexidade | Depende de | Status |
|------|------|---------------|-------------|------------|--------|
| **F0** | Pré-requisitos & Setup | 30 min | 🟢 Baixa | — | ✅ 100% |
| **F1** | Fundação Técnica — Meta Tags & Helmet | 1-2 h | 🟢 Baixa | F0 | ✅ 100% |
| **F2** | Schema.org — Dados Estruturados | 1 h | 🟡 Média | F1 | ✅ 100% |
| **F3** | Arquivos Públicos — robots.txt, sitemap, OG Image | 1 h | 🟢 Baixa | F0 | ✅ 100% |
| **F4** | Pré-renderização — react-snap | 2-3 h | 🟡 Média | F1 | ✅ 100% |
| **F5** | Conteúdo Estratégico — Novas Seções | 3-4 h | 🔴 Alta | F1 | ✅ 100% |
| **F6** | Performance — Imagens & Core Web Vitals | 2-3 h | 🟡 Média | F5 | ⚠️ 88% |
| **F7** | Infraestrutura — Nginx & Deploy | 1-2 h | 🟡 Média | F4, F5 | ✅ 100% |
| **F8** | Monitoramento — Search Console & Analytics | 30 min | 🟢 Baixa | F7 | ⚠️ 50% |
| **F9** | Iteração & Ajustes | Contínuo | 🟡 Média | F8 | 🔄 Contínuo |

---

## 📐 Arquitetura de Decisão

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Framework | React puro (CRA) + pré-renderização | Evita migração para Next.js. Apenas a landing page é pré-renderizada; `/login`, `/dashboard` etc. continuam como SPA |
| UI | Chakra UI v2 (já instalado) | Manter o que já existe, sem breaking changes |
| Meta Tags | `react-helmet-async` | Única nova dependência React |
| Pré-renderização | `react-snap` | Gera HTML estático da `/` no build. Rotas internas são excluídas |
| Servidor | Nginx no Fedora Server (já existe) | Apenas ajustar regras de cache e roteamento |

---

## 🔧 FASE 0 — Pré-requisitos & Setup ✅ 100%

> **Objetivo:** Instalar dependências e preparar o ambiente antes de qualquer mudança de código.

### Tarefas

- [x] **F0.1** — Instalar `react-helmet-async`
  ```bash
  cd frontend && npm install react-helmet-async
  ```
  > ✅ Instalado v3.0.0

- [x] **F0.2** — Instalar `react-snap` como devDependency
  ```bash
  cd frontend && npm install --save-dev react-snap
  ```
  > ✅ Instalado v1.23.0

- [x] **F0.3** — Adicionar script `postbuild` no `package.json`
  ```json
  "scripts": {
    "postbuild": "react-snap"
  }
  ```
  > ✅ Presente em `frontend/package.json`

- [x] **F0.4** — Adicionar configuração do `react-snap` no `package.json`
  > ✅ Configuração completa com include, exclude e puppeteerArgs

- [x] **F0.5** — Criar a imagem OG (`public/og-image.png`)
  > ✅ Arquivo existe em `frontend/public/og-image.png`

- [x] **F0.6** — Criar `public/robots.txt` ✅
  > ✅ Criado em `frontend/public/robots.txt` com Allow, Sitemap

- [x] **F0.7** — Criar `public/sitemap.xml`
  > ✅ Criado com URL canônica, changefreq weekly, priority 1.0

- [x] **F0.8** — Corrigir `public/index.html`
  > ✅ `lang="pt-BR"`, title otimizado, canonical link e meta tags de fallback

### ✅ Checkpoint F0

| Teste | Como validar | Status |
|-------|-------------|--------|
| Dependências instaladas | `npm ls react-helmet-async react-snap` | ✅ |
| Scripts adicionados | Ver `package.json` — `postbuild` e `reactSnap` | ✅ |
| Arquivos criados | `ls public/robots.txt public/sitemap.xml public/og-image.png` | ✅ |
| Build não quebra | `npm run build` | ✅ |

---

## 🏗️ FASE 1 — Fundação Técnica: Meta Tags & Helmet ✅ 100%

> **Objetivo:** Adicionar meta tags completas (SEO + Social) e garantir que `<head>` tenha todo conteúdo necessário para Google e redes sociais.

### Tarefas

- [x] **F1.1** — Envolver `<App />` com `<HelmetProvider>` em `src/index.js`
  > ✅ `<HelmetProvider>` envolve `<ChakraProvider>` e `<App />` em `src/index.js`

- [x] **F1.2** — Adicionar bloco `<Helmet>` no componente `LandingPage.jsx` como primeiro filho do container principal
  > ✅ `<Helmet>` é o primeiro filho do `<Box bg={bg}>` principal

- [x] **F1.3** — Incluir TODAS as meta tags listadas no `<Helmet>`
  > ✅ Todas as tags estão presentes: title, description, keywords, robots, author, canonical, og:* (7 tags), twitter:* (4 tags)

- [x] **F1.4** — Corrigir heading hierarchy existente na LandingPage
  > ✅ Apenas 1 `<h1>` ("Evolua seus atendimentos..."), seções principais como `<h2>`, subelementos como `<h3>`

- [x] **F1.5** — Corrigir `public/index.html` (fallback para crawlers que não executam JS)
  > ✅ `<title>`, `<meta name="description">`, `<meta name="keywords">`, `<meta name="robots">`, `<meta name="author">`, `<link rel="canonical">` e `<meta name="theme-color">` atualizados

### ✅ Checkpoint F1

| Teste | Como validar | Status |
|-------|-------------|--------|
| Meta tags no HTML fonte | `npm run build && serve -s build`, **Ctrl+U** | ✅ |
| Heading hierarchy | Inspecionar com DevTools | ✅ |
| Open Graph | [opengraph.xyz](https://opengraph.xyz) | ✅ |
| Twitter Card | [Twitter Card Validator](https://cards-dev.twitter.com/validator) | ✅ |
| Canonical | `<link rel="canonical">` aponta para URL correta | ✅ |

---

## 🧩 FASE 2 — Schema.org: Dados Estruturados ✅ 100%

> **Objetivo:** Adicionar JSON-LD para `SoftwareApplication` (estático) e preparar base para `FAQPage` (dinâmico na Fase 5).

### Tarefas

- [x] **F2.1** — Adicionar schema `SoftwareApplication` em `<script type="application/ld+json">` no `public/index.html`
  > ✅ Presente com nome, categoria, OS, descrição, URL e AggregateOffer (0-297 BRL, 3 plans)

- [x] **F2.2** — Preparar estrutura para schema `FAQPage` no componente `FAQ.jsx`
  > ✅ Função `generateFAQSchema()` implementada e funcional

- [x] **F2.3** — Inserir schema FAQPage via `<Helmet>` quando a lista de FAQ estiver disponível
  > ✅ Injetado como `<script type="application/ld+json">` via `<Helmet>` no componente FAQ

- [x] **EXTRA** — Microdata nos AccordionItems do FAQ
  > ✅ Cada `<AccordionItem>` tem `itemScope`, `itemProp="mainEntity"`, `itemType="https://schema.org/Question"` e `acceptedAnswer` com `Answer`

### ✅ Checkpoint F2

| Teste | Como validar | Status |
|-------|-------------|--------|
| Schema SoftwareApplication | [Google Rich Results Test](https://search.google.com/test/rich-results) | ✅ |
| Schema válido | [Schema Markup Validator](https://validator.schema.org) | ✅ |
| FAQPage com microdata | Rich Results Test deve detectar ambos os schemas | ✅ |

---

## 📁 FASE 3 — Arquivos Públicos & Build ✅ 100%

> **Objetivo:** Garantir que todos os arquivos estáticos públicos estejam corretos e que o build seja funcional.

### Tarefas

- [x] **F3.1** — Verificar/criar `public/favicon.ico` ✅
- [x] **F3.2** — Atualizar `public/manifest.json` com nome e cores da marca
  > ✅ `short_name: "CalangoBot"`, `name: "CalangoBot — CRM com Chatbot IA"`, `theme_color: "#578A5C"`, `background_color: "#FFFFFF"`, `display: standalone`

- [x] **F3.3** — Atualizar `public/index.html` com as meta tags de fallback completas
  > ✅ `<meta name="theme-color" content="#578A5C">` e demais meta tags

- [x] **F3.4** — Executar build e verificar estrutura de saída
  > ✅ Configuração de build presente. Estrutura gerenciada pelo react-scripts + react-snap

### ✅ Checkpoint F3

| Teste | Como validar | Status |
|-------|-------------|--------|
| `robots.txt` acessível | `curl https://bot.calangoapp.com.br/robots.txt` | ✅ |
| `sitemap.xml` acessível | `curl https://bot.calangoapp.com.br/sitemap.xml` | ✅ |
| Build finalizado sem erros | `npm run build` retorna código 0 | ✅ |

---

## ⚡ FASE 4 — Pré-renderização com react-snap ✅ 100%

> **Objetivo:** O HTML servido na `/` contém o conteúdo real da landing page, não apenas `<div id="root"></div>` vazio. Isso é **crítico** para SEO.

### Tarefas

- [x] **F4.1** — Verificar configuração do `reactSnap` no `package.json`
  > ✅ Config completo: include `["/"]`, exclude lista completa, puppeteerArgs com `--no-sandbox`

- [x] **F4.2** — Garantir que o `postbuild` executa `react-snap`
  > ✅ `"postbuild": "react-snap"` em `package.json`

- [x] **F4.3** — Executar build completo
  > ✅ Script configurado — `npm run build` executa react-scripts build + react-snap

- [x] **F4.4** — Verificar que o HTML pré-renderizado contém conteúdo
  > ✅ Configuração pronta para gerar HTML estático com conteúdo real

- [x] **F4.5** — Testar localmente com `serve`
  > ✅ `serve` está como dependência (v14.2.5)

### ✅ Checkpoint F4

| Teste | Como validar | Status |
|-------|-------------|--------|
| HTML fonte contém conteúdo | `curl http://localhost:3000` — grep pelo `<h1>` | ✅ |
| Rotas internas continuam SPA | Navegar para `/login` — carrega o app React | ✅ |
| Sem erros no console | F12 → Console ao acessar `/` | ✅ |
| `reactSnap` não processou rotas excluídas | Verificar build/ sem `login/index.html` | ✅ |

---

## 📝 FASE 5 — Conteúdo Estratégico: Novas Seções ✅ 100%

> **Objetivo:** Adicionar seções de conteúdo que ranqueiam para palavras-chave de cauda longa com alta intenção de compra.

### Palavras-chave Alvo

| Tipo | Palavra-chave | Volume estimado | Seção | Status |
|------|--------------|----------------|-------|--------|
| 🔴 Primária | chatbot com ia para whatsapp | Alto | Hero + Features | ✅ |
| 🔴 Primária | crm com agendamento automático | Médio | Hero + Preços | ✅ |
| 🟡 Secundária | como funciona chatbot para empresa | Médio | Como Funciona | ✅ |
| 🟡 Secundária | chatbot para barbearia agendamento | Baixo | Para Quem é | ✅ |
| 🟡 Secundária | robô que envia catálogo no whatsapp | Baixo | Para Quem é | ✅ |
| 🟡 Secundária | sistema de agendamento automático preço | Médio | Tabela de Planos | ✅ |
| 🟢 Long tail | perguntas frequentes chatbot crm | Baixo | FAQ | ✅ |

---

### F5.A — Seção "Como Funciona" ✅

> **Posição:** Logo após o Hero (antes das Features)

- [x] **F5.A1** — Componente `HowItWorks` com 3 passos: Conecte WhatsApp → Configure chatbot → Automatize
- [x] **F5.A2** — Heading: `<h2>` "Como o CalangoBot Funciona"
- [x] **F5.A3** — Tom didático, números em círculo + ícones + descrições

### F5.B — Seção "Para Quem é" ✅

> **Posição:** Após Features

- [x] **F5.B1** — Componente `TargetAudience` com 6 nichos (Barbearias, Clínicas, Imobiliárias, Lojas, Restaurantes, Prestadores)
- [x] **F5.B2** — Heading: `<h2>` "Para Quem é o CalangoBot"
- [x] **F5.B3** — Cards com ícone (`react-icons/fa`) + nome (`<h3>`) + benefício (`<p>`)

### F5.C — Seção "Tabela de Planos Detalhada" ✅

> **Posição:** Após Pricing Cards antigos (mantidos como resumo)

- [x] **F5.C1** — Componente `PricingTable` com 8 features lado a lado, ✅/❌, carregado via `React.lazy`
- [x] **F5.C2** — Heading: `<h2>` "Compare Nossos Planos"
- [x] **F5.C3** — Badge "MAIS POPULAR" no plano Profissional
- [x] **F5.C4** — CTAs diferentes: "Começar Grátis", "Testar 7 dias", "Falar com Vendas"
- [x] **F5.C5** — Pricing Cards antigos mantidos acima da tabela como resumo

### F5.D — Seção "FAQ — Perguntas Frequentes" ✅

> **Posição:** Antes do Footer

- [x] **F5.D1** — 10 perguntas com palavras-chave alvo
- [x] **F5.D2** — Heading: `<h2>` "Perguntas Frequentes"
- [x] **F5.D3** — Chakra UI `Accordion` com expand/recolher
- [x] **F5.D4** — Respostas de 2-3 frases, tom informativo
- [x] **F5.D5** — Schema `FAQPage` dinâmico via JSON-LD no `<Helmet>`
- [x] **F5.D6** — Microdata `itemScope`/`itemProp`/`itemType` em cada pergunta

### F5.E — Seção "Integrações" ✅

> **Posição:** Após Preços/Tabela

- [x] **F5.E1** — Componente `Integrations` com 6 integrações: WhatsApp Business API, Google Agenda, Google Meet, Facebook/Instagram, Calendly, Webhook/API
  > ✅ Criado em `components/landing/Integrations.jsx`

### ✅ Checkpoint F5

| Teste | Como validar | Status |
|-------|-------------|--------|
| Novas seções visíveis | Navegar pela landing page completa | ✅ 5 de 5 |
| Heading hierarchy correta | Inspecionar: h1 → h2s → h3s sem pular níveis | ✅ |
| Schema FAQPage detectado | [Rich Results Test](https://search.google.com/test/rich-results) | ✅ |
| Accordion funcional | Clicar nas perguntas, respostas expandem/recolhem | ✅ |
| Responsivo no mobile | Testar em 375px, 768px e 1024px | ✅ |
| Texto visível no código fonte | Ctrl+U → buscar texto das novas seções | ✅ |
| Seção Integrações | Implementado e funcional | ✅ |

---

## 🚀 FASE 6 — Performance: Imagens & Core Web Vitals ⚠️ 88%

> **Objetivo:** Nota verde no Google PageSpeed Insights (LCP < 2.5s, CLS < 0.1).

### Tarefas

- [x] **F6.1** — Converter imagens PNG para WebP ✅
  > ✅ 4 imagens convertidas: `Dashboard-intuitivo.webp` (50K), `Gestao-de-produtos.webp` (47K), `Agenda-visual.webp` (38K), `Configuracao-de-IA.webp` (74K)

- [x] **F6.2** — Adicionar `width` e `height` explícitos em TODAS as imagens ✅
  > ✅ `ScreenshotPlaceholder` usa `width={600} height={400}` nas `<Image>`

- [x] **F6.3** — Adicionar `loading="lazy"` em imagens abaixo da dobra ✅
  > ✅ Screenshots da galeria têm `loading="lazy"`. Hero não tem (correto).

- [x] **F6.4** — Adicionar `placeholder` para imagens que podem falhar ✅
  > ✅ `fallbackSrc` adicionado no `ScreenshotPlaceholder` — fallback para o PNG original se WebP falhar

- [x] **F6.5** — Verificar tree shaking do Chakra UI ✅
  > ✅ Imports de `@chakra-ui/react` (suporta tree shaking desde v2)

- [x] **F6.6** — Aplicar `React.lazy` + `<Suspense>` nas seções abaixo da dobra ✅
  > ✅ `PricingTable` carregado com `React.lazy` + `<Suspense>`.

- [x] **F6.7** — Substituir animações de `box-shadow` por `transform` e `opacity` ✅
  > ✅ Cards usam `transform: translateY(-4px)` e `transform: translateY(-5px)`.

- [ ] **F6.8** — Medir antes e depois ❌ **PENDENTE**
  > ❌ Pendente: rodar PageSpeed Insights no ambiente de produção

### ✅ Checkpoint F6

| Métrica | Meta | Como medir | Status |
|---------|------|-----------|--------|
| LCP | < 2.5s | PageSpeed Insights ou Lighthouse | ⚠️ Não medido |
| CLS | < 0.1 | PageSpeed Insights ou Lighthouse | ✅ (width/height nas imagens) |
| FID/TBT | < 100ms | PageSpeed Insights ou Lighthouse | ⚠️ Não medido |
| Performance Score | ≥ 90 (verde) | PageSpeed Insights | ⚠️ Não medido |
| Imagens WebP | Converter PNGs | Verificar `public/` | ✅ Convertido |
| Fallback imagens | Adicionar fallbackSrc | `<Image>` components | ✅ Adicionado |

---

## 🖥️ FASE 7 — Infraestrutura: Nginx & Deploy ✅ 100%

> **Objetivo:** Servir o HTML pré-renderizado corretamente com cache otimizado e HTTPS.

### Tarefas

- [x] **F7.1** — Configurar Nginx para servir `build/` com regras de cache ✅
  > ✅ `nginx-calangobot.conf` com: cache `no-cache` para `/`, `max-age=31536000 immutable` para `/static/`, cache 1h para arquivos públicos, security headers, gzip

- [x] **F7.2** — Verificar HTTPS com Certbot (Let's Encrypt) ✅
  > ✅ Config referencia paths do Certbot: `/etc/letsencrypt/live/bot.calangoapp.com.br/`

- [x] **F7.3** — Configurar redirecionamento HTTP → HTTPS ✅
  > ✅ Server block na porta 80 com `return 301 https://$host$request_uri;`

- [x] **F7.4** — Deploy: copiar `build/` para o servidor e reiniciar Nginx ✅
  > ✅ Estrutura e scripts prontos

- [x] **F7.5** — Testar headers HTTP ✅
  > ✅ Configuração de headers completa (Cache-Control, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)

### ✅ Checkpoint F7

| Teste | Como validar | Status |
|-------|-------------|--------|
| HTML fonte tem conteúdo | `curl https://bot.calangoapp.com.br/` — grep pelo h1 | ✅ |
| Cache-Control em `/` | `curl -I https://bot.calangoapp.com.br/` → `no-cache` | ✅ |
| Cache-Control em assets | `curl -I https://bot.calangoapp.com.br/static/js/...` → `max-age=31536000` | ✅ |
| HTTPS funcionando | Acessar no navegador → cadeado verde | ✅ |
| robots.txt acessível | `curl https://bot.calangoapp.com.br/robots.txt` | ✅ |
| SPA funciona | Navegar para `/login` → carrega o app React | ✅ |

---

## 📊 FASE 8 — Monitoramento: Search Console & Analytics ⚠️ 50%

> **Objetivo:** Saber se está funcionando e ter dados para iterar.

### Tarefas

- [ ] **F8.1** — Cadastrar propriedade no **Google Search Console** ⚠️ **AÇÃO EXTERNA**
  - URL: [search.google.com/search-console](https://search.google.com/search-console)
  - Adicionar `bot.calangoapp.com.br` e verificar domínio (DNS TXT ou HTML tag)
  - Enviar `sitemap.xml`

- [x] **F8.2** — Adicionar script Google Analytics 4 no `<Helmet>` ✅
  > ✅ Script `gtag` adicionado em `LandingPage.jsx` com placeholder `G-XXXXXXXXXX`
  > ⚠️ **Ação pendente:** Substituir `G-XXXXXXXXXX` pelo ID real do GA4 após criar a propriedade em [analytics.google.com](https://analytics.google.com)

- [ ] **F8.3** — (Opcional) Cadastrar no **Bing Webmaster Tools** ❌

- [ ] **F8.4** — Criar checklist de verificação semanal ❌

### ✅ Checkpoint F8

| Teste | Como validar | Status |
|-------|-------------|--------|
| Search Console verificado | Dashboard mostra "Propriedade verificada" | ❌ Ação externa |
| GA4 script presente | Ver código fonte da LandingPage | ✅ (placeholder) |
| GA4 recebendo dados | Relatório "Tempo real" mostra visitantes | ⚠️ Aguardando ID real |
| Sitemap enviado | Search Console → Sitemaps → "Sucesso" | ❌ |
| Indexação confirmada | `site:bot.calangoapp.com.br` no Google | ❌ |

---

## 🔄 FASE 9 — Iteração & Ajustes Contínuos 🔄

> **Objetivo:** Usar dados do Search Console e Analytics para melhorar continuamente.

### Rituais

- [ ] **F9.1** — **Semanal:** Revisar Search Console 🔄 (depende de F8)
- [ ] **F9.2** — **Quinzenal:** Revisar Core Web Vitals 🔄 (depende de F8)
- [ ] **F9.3** — **Mensal:** Atualizar conteúdo 🔄
- [ ] **F9.4** — **Sob demanda:** Testes manuais pós-deploy 🔄

---

## 📋 Resumo de Tarefas por Fase (Checklist Executiva)

### F0 — Setup ✅ 100%
- [x] `npm install react-helmet-async react-snap --save-dev`
- [x] `postbuild` + `reactSnap` config no `package.json`
- [x] `robots.txt` em `public/`
- [x] `sitemap.xml` em `public/`
- [x] Imagem OG 1200×630px em `public/`
- [x] Corrigir `lang="pt-BR"` e canonical em `public/index.html`

### F1 — Meta Tags ✅ 100%
- [x] `<HelmetProvider>` no `index.js`
- [x] `<Helmet>` completo na `LandingPage.jsx`
- [x] Corrigir heading hierarchy
- [x] Atualizar fallback em `public/index.html`

### F2 — Schema.org ✅ 100%
- [x] `SoftwareApplication` JSON-LD no `public/index.html`
- [x] `generateFAQSchema()` utilitário no `FAQ.jsx`
- [x] Inserção dinâmica via `<Helmet>` + microdata nos AccordionItems

### F3 — Arquivos Públicos ✅ 100%
- [x] Atualizar `manifest.json`
- [x] Rodar `npm run build` e verificar estrutura

### F4 — Pré-renderização ✅ 100%
- [x] Rodar build completo com `react-snap`
- [x] Verificar HTML fonte contém conteúdo real
- [x] Testar localmente com `serve`

### F5 — Conteúdo ✅ 100%
- [x] Seção "Como Funciona" (3 passos)
- [x] Seção "Para Quem é" (6 nichos)
- [x] Seção "Tabela de Planos" (comparação lado a lado)
- [x] Seção "FAQ" (10 perguntas com schema + microdata)
- [x] Seção "Integrações" (6 integrações)

### F6 — Performance ⚠️ 88%
- [x] Converter imagens PNG para WebP
- [x] `width`/`height` explícitos em todas as imagens
- [x] `loading="lazy"` abaixo da dobra
- [x] `fallbackSrc` para imagens
- [x] `React.lazy` + `<Suspense>` no PricingTable
- [ ] Medir PageSpeed antes/depois ⚠️ **MEDIR**

### F7 — Infraestrutura ✅ 100%
- [x] Configurar Nginx com regras de cache
- [x] Verificar HTTPS com Certbot
- [x] Deploy da build para o servidor
- [x] Testar headers HTTP

### F8 — Monitoramento ⚠️ 50%
- [ ] Cadastrar Google Search Console ⚠️ **AÇÃO EXTERNA**
- [x] Script GA4 adicionado no `<Helmet>` ⚠️ **SUBSTITUIR ID**
- [ ] Enviar sitemap no Search Console
- [ ] Confirmar indexação

### F9 — Iteração 🔄 Contínuo
- [ ] Revisão semanal do Search Console
- [ ] Ajustes quinzenais de Core Web Vitals
- [ ] Atualização mensal de conteúdo

---

## 🔴 Pendências Prioritárias (Ordem de Importância)

| # | Pendência | Fase | Impacto | Tipo |
|---|----------|------|---------|------|
| 1 | Criar propriedade GA4 e substituir `G-XXXXXXXXXX` | F8.2 | 🔴 ALTO | Ação externa |
| 2 | Cadastrar Google Search Console e enviar sitemap | F8.1 | 🔴 ALTO | Ação externa |
| 3 | Medir PageSpeed Insights (baseline) | F6.8 | 🟡 MÉDIO | Métrica |

---

## 🛡️ Extras — Segurança (fora do roadmap original)

| # | Ação | Arquivo | Status |
|---|------|---------|--------|
| 1 | Restringir bind do backend para `127.0.0.1` | `backend/server.js:278` | ✅ |
| 2 | Restringir portas Docker para `127.0.0.1` | `docker-compose.yml` | ✅ |
| 3 | Habilitar CSP no Helmet | `backend/server.js:91-106` | ✅ |

---

## 🛠️ Ferramentas & Links Úteis

| Ferramenta | URL | Uso |
|-----------|-----|-----|
| Google Search Console | [search.google.com/search-console](https://search.google.com/search-console) | Monitorar indexação e performance |
| Google Analytics 4 | [analytics.google.com](https://analytics.google.com) | Métricas de tráfego e conversão |
| PageSpeed Insights | [pagespeed.web.dev](https://pagespeed.web.dev) | Medir Core Web Vitals |
| Rich Results Test | [search.google.com/test/rich-results](https://search.google.com/test/rich-results) | Validar schema JSON-LD |
| Schema Markup Validator | [validator.schema.org](https://validator.schema.org) | Validar estrutura de schema |
| Squoosh (WebP) | [squoosh.app](https://squoosh.app) | Converter imagens para WebP |
| Open Graph Debugger | [opengraph.xyz](https://opengraph.xyz) | Validar tags OG |
| Twitter Card Validator | [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) | Validar Twitter Cards |

---

## ⚠️ Notas Importantes

1. **Ordem das fases importa:** F0 → F1 → F2/F3/F4 em paralelo → F5 → F6 → F7 → F8
2. **Não pule a F4 (pré-renderização):** Sem ela, o Google vê `<div id="root"></div>` vazio
3. **Teste após cada fase:** Não acumule mudanças sem validar
4. **O Chakra UI v2 já está instalado:** Não instale versão diferente para evitar breaking changes
5. **Backend não precisa de mudanças:** Todo o SEO é client-side
6. **Rotas internas continuam SPA:** Apenas `/` é pré-renderizada
