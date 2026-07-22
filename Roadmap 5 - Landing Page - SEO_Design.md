Roadmap de SEO para CalangoBot — Landing Page

> **📅 Última auditoria:** 2026-07-22 | **Status geral:** ~85% concluído
>
> 🔴 **Pendências críticas:** robots.txt, Google Analytics 4, Search Console
> 🟡 **Pendências médias:** Converter PNG→WebP, fallbackSrc em imagens, medir PageSpeed
> 🟢 **Pendências baixas:** Seção Integrações (F5.E)

## Visão geral das fases

| Fase | Duração | Foco | Resultado esperado | Status |
|------|---------|------|-------------------|--------|
| 1. Fundação Técnica | Semana 1 | Fazer o Google ler a página | Indexação correta | ✅ 100% |
| 2. Camada Semântica | Semana 1 | Fazer o Google entender a página | Rich snippets e posição zero | ✅ 100% |
| 3. Conteúdo Estratégico | Semana 2-3 | Fazer o Google ranquear a página | Palavras-chave nos top 10 | ✅ 90% |
| 4. Performance | Semana 2 | Fazer o Google preferir a página | Core Web Vitals no verde | ⚠️ 50% |
| 5. Infraestrutura | Semana 2 | Servir tudo corretamente | Entrega confiável ao crawler | ✅ 100% |
| 6. Monitoramento | Contínuo | Medir e corrigir | Melhoria contínua | ❌ 0% |
Fase 1 — Fundação Técnica
Objetivo: O Google recebe HTML com conteúdo visível, não uma casca vazia.

Decisão arquitetural importante
Você vai manter React puro (CRA) com pré-renderização apenas da landing page. As rotas internas (/login, /dashboard) continuam como SPA normal. Isso é suficiente para SEO e evita migrar para Next.js desnecessariamente.

Dependências para instalar
text
react-helmet-async   → Meta tags dinâmicas no <head>
react-snap           → Gera HTML estático da landing page no build
O que configurar no package.json
Adicionar script postbuild que executa react-snap após o build normal.

Configurar reactSnap.include para processar apenas a raiz /.

Configurar reactSnap.exclude para ignorar /login, /dashboard, /chat/*.

Adicionar puppeteerArgs: ["--no-sandbox"] para compatibilidade com ambientes CI/CD e servidores Linux.

O que mudar na estrutura do projeto
Envolver o <App /> com <HelmetProvider> no arquivo de entrada (index.js).

No componente LandingPage, importar <Helmet> e usá-lo como primeiro filho do container principal.

Metadados que a Landing Page PRECISA ter
Meta tag	Conteúdo sugerido
<title>	"CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h"
<meta description>	Máximo 160 caracteres. Deve conter: o que é, para quem serve, principal benefício. Ex: "Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h para pequenos negócios."
<meta keywords>	5 a 8 palavras-chave separadas por vírgula. Foco em: chatbot, CRM, agendamento automático, WhatsApp, IA, pequenas empresas.
og:title	Igual ao <title>, mas pode ser mais comercial
og:description	Versão mais curta, pensada para compartilhamento em redes sociais
og:image	URL absoluta para uma imagem 1200x630px. Crie uma imagem de capa do CalangoBot.
og:url	URL canônica: https://bot.calangoapp.com.br
canonical	Mesma URL, evita conteúdo duplicado
twitter:card	summary_large_image para aparecer com imagem grande no Twitter
Fase 2 — Camada Semântica (Schema.org)
Objetivo: Habilitar rich snippets e melhorar CTR na SERP.

Tipos de schema para implementar
Você vai adicionar dois blocos JSON-LD no <head>:

Schema principal: SoftwareApplication
Tipo: SoftwareApplication

Propriedades importantes:

name: Nome do produto

applicationCategory: BusinessApplication

operatingSystem: Web

description: Igual à meta description

offers com AggregateOffer: preço mínimo (0 para plano grátis), máximo (297 para empresarial), moeda (BRL)

Se tiver avaliações: aggregateRating com ratingValue e reviewCount

Schema secundário: FAQPage
Será adicionado dinamicamente na seção de FAQ (Fase 3).

Cada pergunta usa Question com name e acceptedAnswer com text.

Onde colocar
O schema SoftwareApplication vai em uma tag <script type="application/ld+json"> diretamente no public/index.html (é estático, não muda).

O schema FAQPage será gerado dinamicamente pelo React na seção de FAQ, usando atributos itemScope e itemProp ou inserindo um script JSON-LD via dangerouslySetInnerHTML.

Ferramenta de validação
Google Rich Results Test: https://search.google.com/test/rich-results

Schema Markup Validator: https://validator.schema.org

Fase 3 — Conteúdo Estratégico
Objetivo: Ranquear para palavras-chave de cauda longa com alta intenção de compra.

Palavras-chave primárias (foco da landing page)
"chatbot com ia para whatsapp"

"crm com agendamento automático"

"robô de atendimento 24 horas"

"automatizar atendimento no whatsapp"

Palavras-chave secundárias (para seções novas)
"como funciona chatbot para empresa"

"chatbot para barbearia agendamento"

"robô que envia catálogo no whatsapp"

"sistema de agendamento automático preço"

Novas seções para adicionar (em ordem de importância)
#	Seção	Posição sugerida	Palavra-chave alvo
1	FAQ (Perguntas Frequentes)	Antes do Footer	Várias de cauda longa. Use perguntas reais de clientes.
2	Como Funciona	Após o Hero	"como funciona chatbot para empresa"
3	Para Quem é	Após Features	Nichos: barbearia, clínica, imobiliária, loja
4	Tabela de Planos Detalhada	Substituir cards atuais ou complementar	"CRM com chatbot preço", "plano gratuito chatbot"
5	Integrações	Após Preços	"integração whatsapp business api", "google agenda chatbot"
Diretrizes de conteúdo para cada seção
FAQ:

Mínimo 5 perguntas, máximo 10.

Perguntas devem começar com "Como", "O que", "Quanto", "Preciso".

Respostas curtas (2-3 frases), diretas, sem marketing.

Cada pergunta deve ser um <h3> com a resposta em <p> logo abaixo.

Implementar microdata Question e Answer em cada bloco.

Como Funciona:

3 passos numerados visualmente (1, 2, 3 em círculos).

Cada passo com título (verbo de ação) + descrição curta.

Tom: didático, mostrando que é simples, não técnico.

Para Quem é:

4 a 6 segmentos com ícone (emoji ou react-icons) + nome do nicho + benefício específico.

Ex: "Barbearias e Salões — Agendamento automático e envio de fotos de cortes."

Isso cria páginas de entrada para buscas como "chatbot para barbearia".

Tabela de Planos:

Comparação lado a lado com ✅ e ❌ (não apenas lista do plano).

Destaque visual no plano mais vendido.

Incluir CTA diferente por plano.

Schema AggregateOffer referenciando esta tabela.

Hierarquia de headings (CRÍTICO para SEO)
text
<h1> → "Evolua seus atendimentos com Inteligência Artificial" (já existe)
  <h2> → "Tudo que você precisa para automatizar" (já existe)
  <h2> → "Como o CalangoBot Funciona" (nova seção)
  <h2> → "Para Quem é o CalangoBot" (nova seção)
  <h2> → "Conheça a Plataforma por Dentro" (já existe)
  <h2> → "O que nossos clientes dizem" (já existe)
  <h2> → "Planos Simples e Transparentes" (já existe)
  <h2> → "Perguntas Frequentes" (nova seção)
    <h3> → Cada pergunta do FAQ
Regras:

Apenas UM <h1> por página.

<h2> para cada seção principal.

<h3> para subelementos (perguntas do FAQ, títulos de features).

Não pular níveis (não ter h2 seguido de h4).

Fase 4 — Performance (Core Web Vitals)
Objetivo: Nota verde no Google PageSpeed Insights.

Métricas que importam
Métrica	O que mede	Meta
LCP (Largest Contentful Paint)	Tempo até o maior elemento visível carregar	< 2.5s
FID (First Input Delay)	Tempo até a página responder ao primeiro clique	< 100ms
CLS (Cumulative Layout Shift)	Estabilidade visual durante o carregamento	< 0.1
Ações específicas no CalangoBot
Imagens:

Converter todas as imagens da galeria (Dashboard, Gestão de Produtos, Agenda, Configuração) para WebP. Ferramenta: cwebp (CLI) ou Squoosh (web).

Definir width e height explícitos em todas as <Image> para evitar layout shift.

Adicionar loading="lazy" em imagens abaixo da dobra.

Criar uma imagem de fallback (placeholder cinza) para quando a imagem real não carregar.

JavaScript:

O Chakra UI é pesado. Verificar se está importando apenas os componentes usados (tree shaking). Se não estiver, configurar no package.json ou usar imports diretos como @chakra-ui/react/Button.

Aplicar React.lazy e <Suspense> nas seções abaixo da dobra (FAQ, Depoimentos, Galeria). A Hero e Navbar carregam imediatamente; o resto pode ser lazy.

CSS:

Evitar animações que disparam repaint (como box-shadow em hover contínuo). Preferir transform e opacity.

O Chakra UI gera CSS-in-JS. Em produção, verificar se o @emotion/react está configurado para extrair CSS crítico.

Ferramentas para medir
Google PageSpeed Insights: https://pagespeed.web.dev

Lighthouse (já vem no Chrome DevTools)

Web Vitals Chrome Extension

Fase 5 — Infraestrutura de Entrega
Objetivo: Servir o HTML pré-renderizado de forma confiável.

Estrutura de arquivos após build
text
build/
  index.html          ← HTML pré-renderizado da landing page (react-snap)
  landing.html        ← Cópia de segurança (opcional)
  asset-manifest.json
  static/
    js/               ← Bundles JavaScript (SPA para rotas internas)
    css/              ← Estilos
    media/            ← Imagens otimizadas
Configuração do servidor (Fedora Server com Nginx)
Regras essenciais:

Para a rota /, servir o index.html estático (já contém a landing page renderizada).

Para qualquer outra rota (/login, /dashboard), servir o mesmo index.html e deixar o React Router resolver no cliente.

Ativar compressão gzip para HTML, CSS e JS.

Configurar cache agressivo para assets com hash (1 ano), e sem cache para index.html.

Headers HTTP importantes:

text
Content-Type: text/html; charset=UTF-8
Cache-Control: no-cache (para index.html)
Cache-Control: public, max-age=31536000, immutable (para assets com hash)
Content-Encoding: gzip
Arquivos obrigatórios na raiz pública
text
public/
  robots.txt          ← Permitir tudo, apontar sitemap
  sitemap.xml         ← Listar URL raiz como prioridade 1.0
  og-image.png        ← 1200x630px para compartilhamento social
  favicon.ico         ← Ícone do site
Conteúdo do robots.txt:

text
User-agent: *
Allow: /
Sitemap: https://bot.calangoapp.com.br/sitemap.xml
Conteúdo do sitemap.xml:

Listar apenas a URL raiz.

changefreq: weekly.

priority: 1.0.

Se tiver blog ou páginas extras no futuro, adicionar aqui.

Fase 6 — Monitoramento Contínuo
Objetivo: Saber se está funcionando e corrigir problemas.

Ferramentas obrigatórias para cadastrar
Ferramenta	URL	O que fazer
Google Search Console	search.google.com/search-console	Adicionar propriedade bot.calangoapp.com.br, verificar domínio (DNS ou HTML tag), enviar sitemap
Google Analytics 4	analytics.google.com	Criar stream para web, adicionar tag no <head> via react-helmet-async
Bing Webmaster Tools	www.bing.com/webmasters	Importar do Search Console (opcional mas recomendado)
O que verificar semanalmente no Search Console
Cobertura do índice: A URL / está indexada? Aparece como "Enviada e indexada"?

Rich results: O schema SoftwareApplication e FAQPage estão sendo detectados?

Consultas de pesquisa: Quais palavras-chave estão trazendo impressões? Priorize as que estão na posição 4-10 (fáceis de subir).

Core Web Vitals: Aparece como "Aprovado" ou "Precisa de melhorias"?

Testes manuais para fazer após cada deploy
Acessar https://bot.calangoapp.com.br e clicar com botão direito → "Exibir código fonte". O HTML deve conter os textos da landing page (não apenas <div id="root"></div>).

Rodar o Rich Results Test do Google com a URL pública.

Rodar o PageSpeed Insights (mobile e desktop).

Buscar site:bot.calangoapp.com.br no Google para confirmar indexação.

Resumo de dependências e ferramentas
Para instalar no projeto
text
react-helmet-async      → Meta tags dinâmicas
react-snap              → Pré-renderização estática
Ferramentas externas (web)
text
Google Search Console   → Monitoramento de indexação
Google Analytics 4      → Métricas de tráfego
PageSpeed Insights      → Performance
Rich Results Test       → Validação de schema
Squoosh / cwebp         → Conversão de imagens para WebP
No servidor
text
Nginx                   → Servir build com regras de cache
Certbot                 → HTTPS via Let's Encrypt (se ainda não tiver)
Extensões de navegador úteis
text
SEO Meta in 1 Click     → Ver meta tags rapidamente
Web Vitals              → Medir Core Web Vitals em tempo real
Lighthouse              → Auditoria completa (já vem no Chrome)
Ordem de execução recomendada
Instalar dependências (react-helmet-async, react-snap)

Configurar pré-renderização (package.json, postbuild)

Adicionar HelmetProvider e meta tags na LandingPage

Criar schema SoftwareApplication no index.html

Rodar build e testar localmente (ver código fonte)

Configurar Nginx para servir corretamente

Cadastrar no Search Console e enviar sitemap

Criar imagem OG (1200x630px)

Adicionar seções de conteúdo (FAQ, Como Funciona, Para Quem)

Implementar schema FAQPage dinâmico

Otimizar imagens (converter para WebP, lazy loading)

Medir performance e ajustar

Monitorar Search Console e iterar