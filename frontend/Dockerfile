# STAGE 1: Builder
FROM node:20-alpine AS builder

# --- INÍCIO DA CORREÇÃO DO PUPPETEER/REACT-SNAP ---
# Instala o Chromium nativo do Alpine e suas dependências gráficas
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Informa ao Puppeteer para usar o Chromium recém-instalado e pular o download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# --- FIM DA CORREÇÃO ---

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Variáveis do CRA (Create React App)
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

ARG REACT_APP_WS_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

ARG REACT_APP_FIREBASE_BUCKET
ENV REACT_APP_FIREBASE_BUCKET=$REACT_APP_FIREBASE_BUCKET

ARG REACT_APP_SQUAMATA_UPLOAD_API_URL
ENV REACT_APP_SQUAMATA_UPLOAD_API_URL=$REACT_APP_SQUAMATA_UPLOAD_API_URL

ARG REACT_APP_SQUAMATA_UPLOAD_API_KEY
ENV REACT_APP_SQUAMATA_UPLOAD_API_KEY=$REACT_APP_SQUAMATA_UPLOAD_API_KEY

RUN npm run build

# STAGE 2: Runtime
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve

# Copia a pasta "build" (Padrão do react-scripts)
COPY --from=builder /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]