# 🦎 CalangoBot — Roadmap de SEO & Landing Page

> **Plano de execução organizado em fases independentes, testáveis e sequenciais.**
>
> Cada fase tem: objetivo claro, tarefas detalhadas, e um checkpoint de validação.
> Ao final de cada fase, você pode testar e verificar o resultado antes de avançar.

---

## 📋 Visão Geral das Fases

| Fase | Nome | Tempo Estimado | Complexidade | Depende de |
|------|------|---------------|-------------|------------|
| **F0** | Pré-requisitos & Setup | 30 min | 🟢 Baixa | — |
| **F1** | Fundação Técnica — Meta Tags & Helmet | 1-2 h | 🟢 Baixa | F0 |
| **F2** | Schema.org — Dados Estruturados | 1 h | 🟡 Média | F1 |
| **F3** | Arquivos Públicos — robots.txt, sitemap, OG Image | 1 h | 🟢 Baixa | F0 |
| **F4** | Pré-renderização — react-snap | 2-3 h | 🟡 Média | F1 |
| **F5** | Conteúdo Estratégico — Novas Seções | 3-4 h | 🔴 Alta | F1 |
| **F6** | Performance — Imagens & Core Web Vitals | 2-3 h | 🟡 Média | F5 |
| **F7** | Infraestrutura — Nginx & Deploy | 1-2 h | 🟡 Média | F4, F5 |
| **F8** | Monitoramento — Search Console & Analytics | 30 min | 🟢 Baixa | F7 |
| **F9** | Iteração & Ajustes | Contínuo | 🟡 Média | F8 |

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

## 🔧 FASE 0 — Pré-requisitos & Setup

> **Objetivo:** Instalar dependências e preparar o ambiente antes de qualquer mudança de código.

### Tarefas

- [ ] **F0.1** — Instalar `react-helmet-async`
  ```bash
  cd frontend && npm install react-helmet-async
  ```

- [ ] **F0.2** — Instalar `react-snap` como devDependency
  ```bash
  cd frontend && npm install --save-dev react-snap
  ```

- [ ] **F0.3** — Adicionar script `postbuild` no `package.json`
  ```json
  "scripts": {
    "postbuild": "react-snap"
  }
  ```

- [ ] **F0.4** — Adicionar configuração do `react-snap` no `package.json`
  ```json
  "reactSnap": {
    "include": ["/"],
    "exclude": ["/login", "/dashboard", "/chat/*", "/google-callback", "/invite/*", "/funnel", "/politica-de-privacidade"],
    "puppeteerArgs": ["--no-sandbox", "--disable-setuid-sandbox"]
  }
  ```

- [ ] **F0.5** — Criar a imagem OG (`public/og-image.png`)
  - Dimensões: **1200×630px**
  - Conteúdo sugerido: Logo do CalangoBot + "CRM com Chatbot IA e Agendamento Automático 24h" + cor de fundo da marca
  - Ferramenta: Figma, Canva ou Squoosh

- [ ] **F0.6** — Criar `public/robots.txt`
  ```
  User-agent: *
  Allow: /
  Sitemap: https://bot.calangoapp.com.br/sitemap.xml
  ```

- [ ] **F0.7** — Criar `public/sitemap.xml`
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://bot.calangoapp.com.br/</loc>
      <changefreq>weekly</changefreq>
      <priority>1.0</priority>
    </url>
  </urlset>
  ```

- [ ] **F0.8** — Corrigir `public/index.html`
  - `lang="en"` → `lang="pt-BR"`
  - `<title>` → `CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h`
  - Adicionar `<link rel="canonical" href="https://bot.calangoapp.com.br/" />`

### ✅ Checkpoint F0

| Teste | Como validar |
|-------|-------------|
| Dependências instaladas | `npm ls react-helmet-async react-snap` |
| Scripts adicionados | Ver `package.json` — `postbuild` e `reactSnap` |
| Arquivos criados | `ls public/robots.txt public/sitemap.xml public/og-image.png` |
| Build não quebra | `npm run build` (sem `postbuild` ainda) |

---

## 🏗️ FASE 1 — Fundação Técnica: Meta Tags & Helmet

> **Objetivo:** Adicionar meta tags completas (SEO + Social) e garantir que `<head>` tenha todo conteúdo necessário para Google e redes sociais.

### Tarefas

- [ ] **F1.1** — Envolver `<App />` com `<HelmetProvider>` em `src/index.js`
  ```jsx
  import { HelmetProvider } from 'react-helmet-async';
  // ...
  <HelmetProvider>
    <App />
  </HelmetProvider>
  ```

- [ ] **F1.2** — Adicionar bloco `<Helmet>` no componente `LandingPage.jsx` como primeiro filho do container principal

- [ ] **F1.3** — Incluir TODAS as meta tags listadas abaixo no `<Helmet>`

  | Meta Tag | Conteúdo |
  |----------|----------|
  | `<title>` | `CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h` |
  | `<meta name="description">` | `Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h para pequenos negócios. Comece grátis.` |
  | `<meta name="keywords">` | `chatbot, CRM, agendamento automático, WhatsApp, IA, inteligência artificial, atendimento 24h, pequenas empresas` |
  | `<meta name="robots">` | `index, follow` |
  | `<meta name="author">` | `CalangoApp` |
  | `<link rel="canonical">` | `https://bot.calangoapp.com.br/` |
  | `og:title` | `CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h` |
  | `og:description` | `Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h.` |
  | `og:image` | `https://bot.calangoapp.com.br/og-image.png` |
  | `og:url` | `https://bot.calangoapp.com.br/` |
  | `og:type` | `website` |
  | `og:locale` | `pt_BR` |
  | `og:site_name` | `CalangoBot` |
  | `twitter:card` | `summary_large_image` |
  | `twitter:title` | `CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h` |
  | `twitter:description` | `Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h.` |
  | `twitter:image` | `https://bot.calangoapp.com.br/og-image.png` |

- [ ] **F1.4** — Corrigir heading hierarchy existente na LandingPage
  - Garantir que existe apenas **UM** `<h1>`
  - Todas as seções principais usam `<h2>`
  - Subelementos (títulos de features, depoimentos) usam `<h3>`

- [ ] **F1.5** — Corrigir `public/index.html` (fallback para crawlers que não executam JS)
  - Atualizar `<title>` para o mesmo título otimizado
  - Atualizar `<meta name="description">` para a descrição otimizada
  - Adicionar `<meta name="keywords">`

### ✅ Checkpoint F1

| Teste | Como validar |
|-------|-------------|
| Meta tags no HTML fonte | `npm run build && serve -s build`, depois **Ctrl+U** (ver código fonte). Deve mostrar as tags no `<head>` |
| Heading hierarchy | Inspecionar com DevTools: apenas 1 `<h1>`, `<h2>` para cada seção |
| Open Graph | Usar [opengraph.xyz](https://opengraph.xyz) ou Facebook Sharing Debugger |
| Twitter Card | Usar [Twitter Card Validator](https://cards-dev.twitter.com/validator) |
| Canonical | `<link rel="canonical">` aponta para URL correta |

---

## 🧩 FASE 2 — Schema.org: Dados Estruturados

> **Objetivo:** Adicionar JSON-LD para `SoftwareApplication` (estático) e preparar base para `FAQPage` (dinâmico na Fase 5).

### Tarefas

- [ ] **F2.1** — Adicionar schema `SoftwareApplication` em `<script type="application/ld+json">` no `public/index.html`

  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "CalangoBot",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "CRM com chatbot IA para WhatsApp. Agendamento automático, catálogo visual e respostas 24h para pequenos negócios.",
    "url": "https://bot.calangoapp.com.br",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "BRL",
      "lowPrice": "0",
      "highPrice": "297",
      "offerCount": "3"
    }
  }
  ```

- [ ] **F2.2** — Preparar estrutura para schema `FAQPage` no `LandingPage.jsx`
  - Criar uma função utilitária `generateFAQSchema(questions)` que retorna JSON-LD string
  - Será usada na Fase 5 quando a seção FAQ for implementada

  ```js
  const generateFAQSchema = (faqList) => {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqList.map(q => ({
        "@type": "Question",
        "name": q.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": q.answer
        }
      }))
    });
  };
  ```

- [ ] **F2.3** — Inserir schema FAQPage via `<Helmet>` quando a lista de FAQ estiver disponível
  ```jsx
  {faqData.length > 0 && (
    <Helmet>
      <script type="application/ld+json">
        {generateFAQSchema(faqData)}
      </script>
    </Helmet>
  )}
  ```

### ✅ Checkpoint F2

| Teste | Como validar |
|-------|-------------|
| Schema SoftwareApplication | [Google Rich Results Test](https://search.google.com/test/rich-results) — inserir URL pública |
| Schema válido | [Schema Markup Validator](https://validator.schema.org) |
| FAQPage (após F5) | Mesmo Rich Results Test deve detectar ambos os schemas |

---

## 📁 FASE 3 — Arquivos Públicos & Build

> **Objetivo:** Garantir que todos os arquivos estáticos públicos estejam corretos e que o build seja funcional.

### Tarefas

- [ ] **F3.1** — Verificar/criar `public/favicon.ico` (já existe ✅)
- [ ] **F3.2** — Atualizar `public/manifest.json` com nome e cores da marca
  ```json
  {
    "short_name": "CalangoBot",
    "name": "CalangoBot — CRM com Chatbot IA",
    "icons": [...],
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#1A202C",
    "background_color": "#FFFFFF"
  }
  ```

- [ ] **F3.3** — Atualizar `public/index.html` com as meta tags de fallback completas
  - `<meta name="theme-color">` com a cor da marca
  - `<meta name="viewport">` já existe ✅

- [ ] **F3.4** — Executar build e verificar estrutura de saída
  ```bash
  npm run build
  ```
  Estrutura esperada em `build/`:
  ```
  build/
    index.html          ← HTML pré-renderizado (após react-snap)
    robots.txt
    sitemap.xml
    og-image.png
    favicon.ico
    manifest.json
    asset-manifest.json
    static/
      js/
      css/
      media/
  ```

### ✅ Checkpoint F3

| Teste | Como validar |
|-------|-------------|
| `robots.txt` acessível | `curl https://bot.calangoapp.com.br/robots.txt` |
| `sitemap.xml` acessível | `curl https://bot.calangoapp.com.br/sitemap.xml` |
| Build finalizado sem erros | `npm run build` retorna código 0 |

---

## ⚡ FASE 4 — Pré-renderização com react-snap

> **Objetivo:** O HTML servido na `/` contém o conteúdo real da landing page, não apenas `<div id="root"></div>` vazio. Isso é **crítico** para SEO.

### Tarefas

- [ ] **F4.1** — Verificar configuração do `reactSnap` no `package.json` (criada na F0)
- [ ] **F4.2** — Garantir que o `postbuild` executa `react-snap`
- [ ] **F4.3** — Executar build completo
  ```bash
  npm run build
  ```
  O `react-snap` irá:
  1. Iniciar um servidor local com os arquivos do build
  2. Navegar para `/` com Puppeteer
  3. Salvar o HTML renderizado em `build/index.html`

- [ ] **F4.4** — Verificar que o HTML pré-renderizado contém conteúdo
  ```bash
  cat build/index.html | grep "Evolua seus atendimentos"
  ```
  Deve retornar o texto do `<h1>`, não apenas `<div id="root"></div>`.

- [ ] **F4.5** — Testar localmente com `serve`
  ```bash
  npx serve -s build
  ```
  Acessar `http://localhost:3000` → Ctrl+U → Deve mostrar HTML completo.

> ⚠️ **Possíveis problemas:** Se `react-snap` falhar com componentes que usam `window` ou `localStorage`, adicionar guards:
> ```js
> if (typeof window !== 'undefined') { /* código */ }
> ```

### ✅ Checkpoint F4

| Teste | Como validar |
|-------|-------------|
| HTML fonte contém conteúdo | `curl http://localhost:3000` — grep pelo `<h1>` |
| Rotas internas continuam SPA | Navegar para `/login` — deve carregar o app React normalmente |
| Sem erros no console | F12 → Console ao acessar `/` |
| `reactSnap` não processou rotas excluídas | Verificar que não há `login/index.html` dentro de `build/` |

---

## 📝 FASE 5 — Conteúdo Estratégico: Novas Seções

> **Objetivo:** Adicionar seções de conteúdo que ranqueiam para palavras-chave de cauda longa com alta intenção de compra.

### Palavras-chave Alvo

| Tipo | Palavra-chave | Volume estimado | Seção |
|------|--------------|----------------|-------|
| 🔴 Primária | chatbot com ia para whatsapp | Alto | Hero + Features |
| 🔴 Primária | crm com agendamento automático | Médio | Hero + Preços |
| 🟡 Secundária | como funciona chatbot para empresa | Médio | Como Funciona |
| 🟡 Secundária | chatbot para barbearia agendamento | Baixo | Para Quem é |
| 🟡 Secundária | robô que envia catálogo no whatsapp | Baixo | Para Quem é |
| 🟡 Secundária | sistema de agendamento automático preço | Médio | Tabela de Planos |
| 🟢 Long tail | perguntas frequentes chatbot crm | Baixo | FAQ |

---

### F5.A — Seção "Como Funciona"

> **Posição:** Logo após o Hero (antes das Features)  
> **Palavra-chave:** "como funciona chatbot para empresa"

- [ ] **F5.A1** — Criar componente `HowItWorks` com 3 passos numerados visualmente

  ```
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │      1      │    │      2      │    │      3      │
  │  Conecte    │ →  │  Configure  │ →  │  Automatize │
  │ seu WhatsApp│    │ seu chatbot │    │ e economize │
  └─────────────┘    └─────────────┘    └─────────────┘
  ```

  Cada passo: número em círculo + ícone + título (verbo) + descrição curta (1-2 frases).

- [ ] **F5.A2** — Heading: `<h2>` "Como o CalangoBot Funciona"
- [ ] **F5.A3** — Tom: didático, mostrando simplicidade (não técnico)

### F5.B — Seção "Para Quem é"

> **Posição:** Após Features  
> **Palavra-chave:** "chatbot para barbearia", "chatbot para clínica", "chatbot para loja"

- [ ] **F5.B1** — Criar componente `TargetAudience` com 4-6 cards de nicho

  | Nicho | Ícone | Benefício Específico |
  |-------|-------|---------------------|
  | Barbearias e Salões | ✂️ | Agendamento automático e envio de fotos de cortes |
  | Clínicas e Consultórios | 🏥 | Confirmação de consultas e lembretes automáticos |
  | Imobiliárias | 🏠 | Catálogo de imóveis e agendamento de visitas |
  | Lojas e E-commerce | 🛍️ | Vitrine de produtos e carrinho via WhatsApp |
  | Restaurantes | 🍽️ | Cardápio digital e pedidos automatizados |
  | Prestadores de Serviço | 🔧 | Orçamentos automáticos e agendamento 24h |

- [ ] **F5.B2** — Heading: `<h2>` "Para Quem é o CalangoBot"
- [ ] **F5.B3** — Cada card: ícone (emoji ou `react-icons`) + nome do nicho (`<h3>`) + benefício (`<p>`)

### F5.C — Seção "Tabela de Planos Detalhada"

> **Posição:** Substituir ou complementar os Pricing Cards atuais  
> **Palavra-chave:** "CRM com chatbot preço", "plano gratuito chatbot"

- [ ] **F5.C1** — Criar componente `PricingTable` com comparação lado a lado

  | Funcionalidade | Grátis | Profissional | Empresarial |
  |---------------|--------|-------------|-------------|
  | Atendimentos/mês | 100 | 1.000 | Ilimitado |
  | Agendamento automático | ✅ | ✅ | ✅ |
  | Catálogo de produtos | ✅ | ✅ | ✅ |
  | Múltiplos atendentes | ❌ | ✅ (3) | ✅ (10+) |
  | Relatórios | ❌ | ✅ | ✅ |
  | API de integração | ❌ | ❌ | ✅ |
  | Pixel do Facebook | ❌ | ✅ | ✅ |
  | Suporte | Email | Chat | Dedicado |
  | **Preço** | **Grátis** | **R$97/mês** | **R$297/mês** |
  | **CTA** | Começar Grátis | Testar 7 dias | Falar com Vendas |

- [ ] **F5.C2** — Heading: `<h2>` "Compare Nossos Planos"
- [ ] **F5.C3** — Destaque visual no plano mais vendido (Profissional) com badge "Mais Popular"
- [ ] **F5.C4** — CTA diferente por plano
- [ ] **F5.C5** — Remover os Pricing Cards antigos OU mantê-los acima da tabela como resumo

### F5.D — Seção "FAQ — Perguntas Frequentes"

> **Posição:** Antes do Footer  
> **Palavra-chave:** Várias de cauda longa

- [ ] **F5.D1** — Criar componente `FAQ` com 8-10 perguntas

  | # | Pergunta | Palavra-chave alvo |
  |---|----------|-------------------|
  | 1 | Como funciona o chatbot com IA para WhatsApp? | chatbot com ia para whatsapp |
  | 2 | Preciso saber programar para usar o CalangoBot? | chatbot fácil de usar |
  | 3 | Quanto custa um sistema de agendamento automático? | sistema de agendamento automático preço |
  | 4 | O CalangoBot funciona 24 horas por dia? | robô de atendimento 24 horas |
  | 5 | Consigo enviar catálogo de produtos pelo WhatsApp? | robô que envia catálogo no whatsapp |
  | 6 | Como funciona o agendamento para barbearia? | chatbot para barbearia agendamento |
  | 7 | O plano grátis tem quais funcionalidades? | plano gratuito chatbot crm |
  | 8 | É seguro? Meus dados ficam protegidos? | chatbot whatsapp seguro |
  | 9 | Como instalar o CalangoBot no meu WhatsApp? | como instalar chatbot no whatsapp |
  | 10 | Posso cancelar a qualquer momento? | chatbot com plano mensal |

- [ ] **F5.D2** — Heading: `<h2>` "Perguntas Frequentes"
- [ ] **F5.D3** — Cada pergunta: `<h3>` com accordion (Chakra UI `Accordion`)
- [ ] **F5.D4** — Respostas: 2-3 frases, diretas, sem marketing, tom informativo
- [ ] **F5.D5** — Implementar schema `FAQPage` dinâmico (estrutura criada na F2)
- [ ] **F5.D6** — Cada pergunta/resposta deve ter microdata:
  ```jsx
  <AccordionItem itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
    <AccordionButton>
      <Heading as="h3" itemProp="name">{question}</Heading>
    </AccordionButton>
    <AccordionPanel itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
      <Text itemProp="text">{answer}</Text>
    </AccordionPanel>
  </AccordionItem>
  ```

### F5.E — Seção "Integrações" (Opcional — Média prioridade)

> **Posição:** Após Preços/Tabela  
> **Palavra-chave:** "integração whatsapp business api", "google agenda chatbot"

- [ ] **F5.E1** — Listar 4-6 integrações com ícones:
  - WhatsApp Business API
  - Google Agenda
  - Google Meets
  - Facebook/Instagram
  - Calendly (se relevante)
  - Webhook/API própria

### ✅ Checkpoint F5

| Teste | Como validar |
|-------|-------------|
| Novas seções visíveis | Navegar pela landing page completa |
| Heading hierarchy correta | Inspecionar: h1 → h2s → h3s sem pular níveis |
| Schema FAQPage detectado | [Rich Results Test](https://search.google.com/test/rich-results) |
| Accordion funcional | Clicar nas perguntas, respostas expandem/recolhem |
| Responsivo no mobile | Testar em 375px, 768px e 1024px |
| Texto visível no código fonte | Ctrl+U → buscar texto das novas seções |

---

## 🚀 FASE 6 — Performance: Imagens & Core Web Vitals

> **Objetivo:** Nota verde no Google PageSpeed Insights (LCP < 2.5s, CLS < 0.1).

### Tarefas

- [ ] **F6.1** — Converter imagens PNG para WebP
  - Screenshots da galeria (Dashboard, Gestão de Produtos, Agenda, Configuração)
  - Ferramenta: `cwebp` (CLI) ou [Squoosh](https://squoosh.app)

  ```bash
  # Exemplo com cwebp
  cwebp input.png -o output.webp -q 80
  ```

- [ ] **F6.2** — Adicionar `width` e `height` explícitos em TODAS as imagens
  ```jsx
  <Image src="..." width={600} height={400} alt="..." />
  ```
  Isso **elimina** Cumulative Layout Shift (CLS).

- [ ] **F6.3** — Adicionar `loading="lazy"` em imagens abaixo da dobra
  ```jsx
  <Image src="..." loading="lazy" alt="..." />
  ```
  Aplica-se a: Galeria, Depoimentos, Parceiros.  
  **NÃO** aplicar no Hero (imagem acima da dobra).

- [ ] **F6.4** — Adicionar `placeholder` para imagens que podem falhar
  ```jsx
  <Image src="..." fallbackSrc="/placeholder.png" alt="..." />
  ```

- [ ] **F6.5** — Verificar tree shaking do Chakra UI
  - Confirmar que imports são de `@chakra-ui/react` (já suporta tree shaking desde v2)
  - Se necessário, usar imports diretos: `import Button from '@chakra-ui/react/Button'`

- [ ] **F6.6** — Aplicar `React.lazy` + `<Suspense>` nas seções abaixo da dobra
  ```jsx
  const FAQ = React.lazy(() => import('./components/FAQ'));
  const Testimonials = React.lazy(() => import('./components/Testimonials'));
  const Gallery = React.lazy(() => import('./components/Gallery'));
  ```
  Hero e Navbar carregam imediatamente. O resto é lazy.

- [ ] **F6.7** — Substituir animações de `box-shadow` por `transform` e `opacity`
  - Cards com hover: usar `transform: scale(1.02)` em vez de `box-shadow` expansivo

- [ ] **F6.8** — Medir antes e depois

  | Antes (linha base) | Depois (após otimizações) |
  |---|---|
  | PageSpeed Insights Mobile | PageSpeed Insights Mobile |
  | PageSpeed Insights Desktop | PageSpeed Insights Desktop |
  | Lighthouse (Chrome DevTools) | Lighthouse (Chrome DevTools) |

### ✅ Checkpoint F6

| Métrica | Meta | Como medir |
|---------|------|-----------|
| LCP | < 2.5s | PageSpeed Insights ou Lighthouse |
| CLS | < 0.1 | PageSpeed Insights ou Lighthouse |
| FID/TBT | < 100ms | PageSpeed Insights ou Lighthouse |
| Performance Score | ≥ 90 (verde) | PageSpeed Insights |

---

## 🖥️ FASE 7 — Infraestrutura: Nginx & Deploy

> **Objetivo:** Servir o HTML pré-renderizado corretamente com cache otimizado e HTTPS.

### Tarefas

- [ ] **F7.1** — Configurar Nginx para servir `build/` com regras de cache

  ```nginx
  server {
      listen 443 ssl http2;
      server_name bot.calangoapp.com.br;

      root /caminho/para/calango-bot/frontend/build;
      index index.html;

      # Gzip compression
      gzip on;
      gzip_types text/html text/css application/javascript application/json image/svg+xml;
      gzip_min_length 256;

      # Landing page - NO cache (sempre entrega o HTML mais recente)
      location = / {
          add_header Cache-Control "no-cache, must-revalidate";
          try_files /index.html =404;
      }

      # Assets com hash de conteúdo - cache agressivo (1 ano)
      location /static/ {
          add_header Cache-Control "public, max-age=31536000, immutable";
      }

      # Arquivos públicos - cache curto
      location ~ ^/(robots.txt|sitemap.xml|og-image.png|favicon.ico) {
          add_header Cache-Control "public, max-age=3600";
      }

      # SPA fallback - todas as outras rotas servem index.html
      location / {
          add_header Cache-Control "no-cache, must-revalidate";
          try_files $uri /index.html;
      }

      # Security headers
      add_header X-Content-Type-Options "nosniff";
      add_header X-Frame-Options "DENY";
      add_header X-XSS-Protection "1; mode=block";
  }
  ```

- [ ] **F7.2** — Verificar HTTPS com Certbot (Let's Encrypt)
  ```bash
  sudo certbot --nginx -d bot.calangoapp.com.br
  ```

- [ ] **F7.3** — Configurar redirecionamento HTTP → HTTPS
  ```nginx
  server {
      listen 80;
      server_name bot.calangoapp.com.br;
      return 301 https://$host$request_uri;
  }
  ```

- [ ] **F7.4** — Deploy: copiar `build/` para o servidor e reiniciar Nginx
  ```bash
  scp -r build/* user@servidor:/caminho/para/frontend/build/
  ssh user@servidor "sudo systemctl reload nginx"
  ```

- [ ] **F7.5** — Testar headers HTTP
  ```bash
  curl -I https://bot.calangoapp.com.br/
  curl -I https://bot.calangoapp.com.br/static/js/main.abc123.js
  ```

### ✅ Checkpoint F7

| Teste | Como validar |
|-------|-------------|
| HTML fonte tem conteúdo | `curl https://bot.calangoapp.com.br/` — grep pelo h1 |
| Cache-Control em `/` | `curl -I https://bot.calangoapp.com.br/` → `no-cache` |
| Cache-Control em assets | `curl -I https://bot.calangoapp.com.br/static/js/...` → `max-age=31536000` |
| HTTPS funcionando | Acessar no navegador → cadeado verde |
| robots.txt acessível | `curl https://bot.calangoapp.com.br/robots.txt` |
| SPA funciona | Navegar para `/login` → carrega o app React |

---

## 📊 FASE 8 — Monitoramento: Search Console & Analytics

> **Objetivo:** Saber se está funcionando e ter dados para iterar.

### Tarefas

- [ ] **F8.1** — Cadastrar propriedade no **Google Search Console**
  - URL: [search.google.com/search-console](https://search.google.com/search-console)
  - Adicionar `bot.calangoapp.com.br`
  - Verificar domínio (DNS TXT record ou HTML tag no `<head>`)
  - Enviar `sitemap.xml`

- [ ] **F8.2** — Criar stream no **Google Analytics 4**
  - URL: [analytics.google.com](https://analytics.google.com)
  - Criar propriedade Web
  - Adicionar tag GA4 no `<Helmet>` da LandingPage:
    ```jsx
    <Helmet>
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
      <script>
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX');`}
      </script>
    </Helmet>
    ```

- [ ] **F8.3** — (Opcional) Cadastrar no **Bing Webmaster Tools**
  - URL: [bing.com/webmasters](https://www.bing.com/webmasters)
  - Importar do Google Search Console

- [ ] **F8.4** — Criar checklist de verificação semanal

  | O que verificar | Onde | Frequência |
  |----------------|------|-----------|
  | URL `/` indexada? | Search Console → Cobertura | Semanal |
  | Rich results detectados? | Search Console → Melhorias | Semanal |
  | Palavras-chave em posição 4-10 | Search Console → Desempenho | Semanal |
  | Core Web Vitals "Aprovado"? | Search Console → Experiência | Semanal |
  | Tráfego orgânico | GA4 → Aquisição → Tráfego orgânico | Semanal |

### ✅ Checkpoint F8

| Teste | Como validar |
|-------|-------------|
| Search Console verificado | Dashboard mostra "Propriedade verificada" |
| Sitemap enviado | Search Console → Sitemaps → "Sucesso" |
| GA4 recebendo dados | Relatório "Tempo real" mostra visitantes |
| Indexação confirmada | `site:bot.calangoapp.com.br` no Google |

---

## 🔄 FASE 9 — Iteração & Ajustes Contínuos

> **Objetivo:** Usar dados do Search Console e Analytics para melhorar continuamente.

### Rituais

- [ ] **F9.1** — **Semanal:** Revisar Search Console
  - Quais queries estão trazendo impressões?
  - Quais estão na posição 4-10? (fáceis de subir com ajustes de conteúdo)
  - Algum erro de rastreamento?

- [ ] **F9.2** — **Quinzenal:** Revisar Core Web Vitals
  - LCP ainda está < 2.5s?
  - CLS está zerado?
  - Se algo degradou, investigar e corrigir

- [ ] **F9.3** — **Mensal:** Atualizar conteúdo
  - FAQ: adicionar novas perguntas baseadas em dúvidas reais de clientes
  - Depoimentos: rotacionar ou adicionar novos
  - Palavras-chave: identificar novas oportunidades no Search Console

- [ ] **F9.4** — **Sob demanda:** Testes manuais pós-deploy
  ```bash
  # 1. Ver código fonte
  curl https://bot.calangoapp.com.br/ | grep "Evolua seus atendimentos"

  # 2. Validar schema
  # Usar: https://search.google.com/test/rich-results

  # 3. Medir performance
  # Usar: https://pagespeed.web.dev

  # 4. Confirmar indexação
  # Buscar no Google: site:bot.calangoapp.com.br
  ```

---

## 📋 Resumo de Tarefas por Fase (Checklist Executiva)

### F0 — Setup (30 min)
- [ ] `npm install react-helmet-async react-snap --save-dev`
- [ ] `postbuild` + `reactSnap` config no `package.json`
- [ ] `robots.txt` + `sitemap.xml` em `public/`
- [ ] Imagem OG 1200×630px em `public/`
- [ ] Corrigir `lang="pt-BR"` e canonical em `public/index.html`

### F1 — Meta Tags (1-2 h)
- [ ] `<HelmetProvider>` no `index.js`
- [ ] `<Helmet>` completo na `LandingPage.jsx`
- [ ] Corrigir heading hierarchy
- [ ] Atualizar fallback em `public/index.html`

### F2 — Schema.org (1 h)
- [ ] `SoftwareApplication` JSON-LD no `public/index.html`
- [ ] `generateFAQSchema()` utilitário no `LandingPage.jsx`
- [ ] Inserção dinâmica via `<Helmet>`

### F3 — Arquivos Públicos (30 min)
- [ ] Atualizar `manifest.json`
- [ ] Rodar `npm run build` e verificar estrutura

### F4 — Pré-renderização (2-3 h)
- [ ] Rodar build completo com `react-snap`
- [ ] Verificar HTML fonte contém conteúdo real
- [ ] Testar localmente com `serve`

### F5 — Conteúdo (3-4 h)
- [ ] Seção "Como Funciona" (3 passos)
- [ ] Seção "Para Quem é" (4-6 nichos)
- [ ] Seção "Tabela de Planos" (comparação lado a lado)
- [ ] Seção "FAQ" (8-10 perguntas com schema)
- [ ] (Opcional) Seção "Integrações"

### F6 — Performance (2-3 h)
- [ ] Converter imagens para WebP
- [ ] `width`/`height` explícitos em todas as imagens
- [ ] `loading="lazy"` abaixo da dobra
- [ ] `React.lazy` + `<Suspense>` nas seções abaixo da dobra
- [ ] Medir PageSpeed antes/depois

### F7 — Infraestrutura (1-2 h)
- [ ] Configurar Nginx com regras de cache
- [ ] Verificar HTTPS com Certbot
- [ ] Deploy da build para o servidor
- [ ] Testar headers HTTP

### F8 — Monitoramento (30 min)
- [ ] Cadastrar Google Search Console
- [ ] Configurar Google Analytics 4
- [ ] Enviar sitemap
- [ ] Confirmar indexação

### F9 — Iteração (Contínuo)
- [ ] Revisão semanal do Search Console
- [ ] Ajustes quinzenais de Core Web Vitals
- [ ] Atualização mensal de conteúdo

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
