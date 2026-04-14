# Migração para Squamata Upload - Resumo de Mudanças

## ✅ Mudanças Concluídas

### Backend
1. **businessRoutes.js**
   - ✅ Removidas rotas antigas: `/api/business/upload-image` e `/api/business/delete-image`
   - ✅ Removidos imports: `upload`, `bucket`, `sharp`, `uuid`, `deleteFromFirebase`
   - ✅ Adicionada nova rota: `POST /api/business/request-upload-url` (proxeia para Squamata Upload)
   - ✅ Mantida integração com `deleteFromFirebase` para limpeza de imagens ao atualizar catálogo

2. **firebaseHelper.js**
   - ✅ Refeito para ter inicialização própria do Firebase Admin
   - ✅ Removida dependência de `upload.js`
   - ✅ Função `deleteFromFirebase` segue funcionando normalmente

### Frontend
1. **api.js** (`frontend/src/services/api.js`)
   - ✅ Adicionado novo método: `requestUploadUrl(fileName, contentType)`
   - ✅ `uploadImage()` reformulado para usar novo fluxo
   - ✅ `deleteImage()` mantido para compatibilidade

2. **uploadHelper.js** (novo arquivo)
   - ✅ `uploadFileToFirebase(file, type)` - Upload de arquivo único
   - ✅ `uploadMultipleFiles(files, type)` - Upload de múltiplos arquivos
   - ✅ Integração com Squamata Upload para gerar URLs assinadas

3. **CatalogTab.jsx** (`frontend/src/components/dashboard-tabs/CatalogTab.jsx`)
   - ✅ Adicionado import: `uploadMultipleFiles`
   - ✅ Refatorada `handleImageUpload()` para novo fluxo

4. **Dashboard.jsx** (`frontend/src/pages/Dashboard.jsx`)
   - ✅ Adicionado import: `uploadFileToFirebase`
   - ✅ Refatorada `handleAvatarChange()` para novo fluxo

## ⚙️ Configuração Necessária

### Variáveis de Ambiente

**Backend (.env):**
```env
# URLs e credenciais do Squamata Upload
SQUAMATA_API_URL=http://localhost:3005        # URL do serviço Squamata Upload
SQUAMATA_API_KEY=seu-secret-key-aqui           # Token de autenticação

# Firebase (mantém igual)
FIREBASE_CREDENTIALS={"type":"service_account",...}  # ou arquivo em config/firebase-credentials.json
FIREBASE_BUCKET_URL=seu-bucket.appspot.com
```

**Frontend (.env.local ou .env):**
```env
REACT_APP_API_URL=http://localhost:3001        # URL do backend Calango Bot
REACT_APP_FIREBASE_BUCKET=seu-bucket.appspot.com
```

## 🗑️ Arquivos a Deletar

Os seguintes arquivos podem ser deletados pois não são mais necessários:

```
backend/config/upload.js          # Multer config - não mais usado
```

## 📋 Novo Fluxo de Upload

```
Cliente
  ↓
uploadFileToFirebase(file, type)  [uploadHelper.js]
  ↓
businessAPI.requestUploadUrl()    [Backend]
  ↓
Squamata Upload /generate-upload-url
  ↓
Retorna: { uploadUrl, filePath }
  ↓
Cliente faz PUT para Firebase com uploadUrl
  ↓
Retorna: https://storage.googleapis.com/bucket/filePath
```

## ✨ Benefícios da Migração

1. **Redução de código**: Servidor não processa imagens mais (Sharp removido)
2. **Upload direto**: Cliente faz upload direto para Firebase (mais rápido)
3. **Escalabilidade**: Squamata Upload pode ser escalado independentemente
4. **Segurança**: URLs assinadas com expiração (5 minutos)
5. **Flexibilidade**: Processamento de imagens pode ser movido para Squamata quando necessário

## 🔧 Testes Recomendados

1. Fazer upload de produto no CatalogTab
2. Fazer upload de avatar no Dashboard
3. Editar e remover produtos (verifica limpeza de imagens)
4. Verificar respostas de erro quando Squamata estiver offline

## 📝 Próximos Passos (Opcional)

1. Mover processamento de imagem (Sharp) para Squamata Upload
2. Implementar delete de imagens via Squamata (em vez de backend)
3. Adicionar suporte para outros tipos de arquivo
4. Implementar retry logic para uploads falhados
