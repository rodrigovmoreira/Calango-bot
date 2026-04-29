# backend/Dockerfile

# Usa uma imagem Node.js que já tem o Chrome instalado (poupa muita dor de cabeça)
FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Define variáveis de ambiente para produção
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências como root (necessário na imagem do puppeteer)
USER root
RUN npm install
# Volta para o usuário padrão de segurança
USER pptruser

# Copia o resto do código do backend
COPY . .

# Expõe a porta que seu servidor usa (3001)
EXPOSE 3001

# Comando para iniciar
CMD ["npm", "start"]