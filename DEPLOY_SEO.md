# CalangoBot — Guia de Deploy

## Pré-requisitos no Servidor (Fedora)
```bash
# Instalar Nginx
sudo dnf install nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Instalar Certbot (HTTPS)
sudo dnf install certbot python3-certbot-nginx
```

## Deploy

### 1. Build local
```bash
cd c:\Calango-bot\frontend
npm run build
```

> ⚠️ Se o `postbuild` (react-snap) falhar localmente no Windows, execute o build sem ele:
> ```bash
> npm run build
> ```
> O react-snap será executado no servidor ou via CI/CD.

### 2. Copiar arquivos para o servidor
```bash
scp -r build/* usuario@servidor:/caminho/para/calango-bot/frontend/build/
scp nginx-calangobot.conf usuario@servidor:/etc/nginx/conf.d/calangobot.conf
```

### 3. Configurar HTTPS
```bash
ssh usuario@servidor
sudo certbot --nginx -d bot.calangoapp.com.br
sudo systemctl reload nginx
```

### 4. Verificar deploy
```bash
# Ver código fonte (deve conter conteúdo, não apenas <div id="root">)
curl https://bot.calangoapp.com.br/ | grep "Evolua seus atendimentos"

# Verificar headers HTTP
curl -I https://bot.calangoapp.com.br/
curl -I https://bot.calangoapp.com.br/static/js/main.*.js

# Verificar robots.txt
curl https://bot.calangoapp.com.br/robots.txt

# Verificar sitemap
curl https://bot.calangoapp.com.br/sitemap.xml
```

---

## Monitoramento Pós-Deploy

### Google Search Console
1. Acesse: https://search.google.com/search-console
2. Adicione propriedade: `bot.calangoapp.com.br`
3. Verifique domínio (DNS TXT ou tag HTML)
4. Envie sitemap: `https://bot.calangoapp.com.br/sitemap.xml`

### Google Analytics 4
1. Acesse: https://analytics.google.com
2. Crie propriedade Web
3. Adicione o script GA4 no `<Helmet>` da LandingPage.jsx
4. Substitua `G-XXXXXXXXXX` pelo seu ID real

### Checklist Semanal
| Verificação | Ferramenta | Ação |
|-------------|-----------|------|
| URL `/` indexada? | Search Console → Cobertura | Confirmar "Enviada e indexada" |
| Rich results detectados? | Search Console → Melhorias | Verificar FAQPage e SoftwareApplication |
| Palavras-chave (pos. 4-10) | Search Console → Desempenho | Priorizar ajustes de conteúdo |
| Core Web Vitals | Search Console → Experiência | Meta: "Aprovado" em todas as métricas |
| Tráfego orgânico | GA4 → Aquisição | Verificar crescimento |

### Testes Manuais
```bash
# Validar schema
# Use: https://search.google.com/test/rich-results

# Medir performance
# Use: https://pagespeed.web.dev

# Confirmar indexação
# Busque no Google: site:bot.calangoapp.com.br
```
