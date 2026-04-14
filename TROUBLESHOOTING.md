# 🐛 Troubleshooting - Problemas Comuns e Soluções

## 1. "401 Acesso não autorizado" ao gerar URL

### Sintomas
```
POST /api/business/request-upload-url
Response: 401 - Acesso não autorizado
```

### Causas Possíveis

#### A) SQUAMATA_API_KEY não configurada
```bash
# Windows
set SQUAMATA_API_KEY=seu-token-aqui

# Linux/Mac
export SQUAMATA_API_KEY=seu-token-aqui
```

**Verificar:**
```bash
# Verificar se variável está configurada
echo $SQUAMATA_API_KEY

# Se vazio, adicionar ao .env:
cat >> .env << 'EOF'
SQUAMATA_API_KEY=seu-token-aqui
EOF
```

#### B) Squamata recebendo token incorreto
**Solução:** Verificar se está sendo enviado sem espaços/caracteres extras
```javascript
// Em businessRoutes.js, linha ~280
console.log('Token enviado:', squamataKey); // DEBUG
```

#### C) Squamata offline
```bash
# Verificar se está rodando
curl http://localhost:3005

# Se erro, iniciar o serviço:
cd ../Squamata-upload
npm start
```

---

## 2. "404 Resource Not Found" após upload

### Sintomas
```
Upload parece estar entrando no loop infinito
ou retorna URL que não existe
```

### Causas Possíveis

#### A) Firebase bucket não configurado corretamente
**Verificar em frontend:**
```javascript
// Arquivo: uploadHelper.js, linha ~45
const firebaseBucket = process.env.REACT_APP_FIREBASE_BUCKET;
console.log('Bucket:', firebaseBucket);
```

**Se vazio:**
```bash
# Adicionar ao .env.local:
echo "REACT_APP_FIREBASE_BUCKET=seu-bucket.appspot.com" >> .env.local
```

#### B) URL assinada expirou (>5 minutos)
**Solução:** Gerar nova URL
```javascript
// Retry automático (verifique uploadHelper.js)
// Se não houver, adicionar:
if (uploadResponse.status === 403) {
  // URL expirou, tentar novamente
  retryUploadWithNewUrl(file);
}
```

#### C) CORS bloqueando requisição
**Verificar headers:**
```
🔍 DevTools → Network → PUT request
Status: 403 Forbidden
Error: Access to XMLHttpRequest blocked by CORS
```

**Solução:**
- Firebase Storage permite PUT com URL assinada (sem CORS)
- Verificar se fetch está usando credenciais incorretas

---

## 3. "Arquivo muito grande" ou timeout de upload

### Sintomas
```
Erro: "413 Payload Too Large"
ou
Erro: "504 Gateway Timeout"
```

### Causas Possíveis

#### A) Arquivo excede limite de 10MB
**Solução em uploadHelper.js:**
```javascript
if (file.size > 10 * 1024 * 1024) {
  throw new Error('Arquivo maior que 10MB');
}
```

**Adicionar compressão (opcional):**
```javascript
// Usar ImageMagick.js ou TinyJPG API para comprimir
// antes de enviar para Firebase
```

#### B) Timeout de rede
**Solução:** Aumentar timeout do fetch
```javascript
// uploadHelper.js, adicionar:
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000); // 60s

const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  signal: controller.signal,
  // ...
});

clearTimeout(timeout);
```

#### C) Conexão internet instável
**Solução:** Implementar retry com backoff exponencial
```javascript
async function uploadWithRetry(file, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadFileToFirebase(file, 'products');
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

---

## 4. "ECONNREFUSED" ao chamar Squamata

### Sintomas
```
Error: connect ECONNREFUSED 127.0.0.1:3005
```

### Causas Possíveis

#### A) Squamata Upload não está rodando
```bash
# Verificar status
curl http://localhost:3005

# Se erro, iniciar:
cd c:\Squamata-upload
npm start
```

#### B) URL incorreta em SQUAMATA_API_URL
**Verificar:**
```bash
# Windows
echo %SQUAMATA_API_URL%

# Linux/Mac
echo $SQUAMATA_API_URL

# Deve ser algo como: http://localhost:3005
```

#### C) Firewall bloqueando porta
```bash
# Windows - testar porta 3005
netstat -ano | findstr :3005

# Linux - testar
lsof -i :3005
```

---

## 5. "Nenhuma imagem enviada" ou campo vazio

### Sintomas
```
- Input file não salva valor
- Componente mostra lista vazia
```

### Causas Possíveis

#### A) Input file não foi resetado
**Solução em React:**
```javascript
const fileInputRef = useRef(null);

const handleImageUpload = async (e) => {
  // ... upload code ...
  
  // Resetar input para permitir reuploading do mesmo arquivo
  if (fileInputRef.current) {
    fileInputRef.current.value = '';
  }
};

return <input ref={fileInputRef} type="file" ... />;
```

#### B) Erro silencioso em uploadHelper.js
**Debug:**
```javascript
async function uploadFileToFirebase(file, type = 'product') {
  console.log('Iniciando upload:', { fileName: file.name, type });
  
  try {
    // ...
    console.log('✅ Uploadado com sucesso');
    return result;
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    throw error; // Não engolir erro
  }
}
```

#### C) Promise.all silenciando erro
**Verificar em CatalogTab.jsx:**
```javascript
// Ruim:
const results = await Promise.all(uploadPromises); // Se uma falhar, tudo falha silenciosamente

// Melhor:
const results = await Promise.allSettled(uploadPromises);
const failures = results.filter(r => r.status === 'rejected');
if (failures.length > 0) {
  console.error('Alguns uploads falharam:', failures);
}
```

---

## 6. "CORS error" ao fazer PUT no Firebase

### Sintomas
```
Access to XMLHttpRequest at '...' blocked by CORS policy
```

### Nota Importante
Firebase Storage URLs assinadas não precisam de CORS porque:
- URL é específica para o cliente
- Assinatura valida a origem implicitamente
- Sem credenciais no request

### Causas Reais (não CORS)

#### A) Content-Type não corresponde ao da URL
**Verificar em uploadHelper.js:**
```javascript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type || 'image/jpeg' // DEVE CORRESPONDER
  },
  body: file
});
```

A URL assinada foi gerada com contentType específico.
Se enviar tipo diferente, Firebase rejeita.

#### B) Método HTTP incorreto
```javascript
// ❌ Errado:
await fetch(uploadUrl, { method: 'POST', ... });

// ✅ Correto:
await fetch(uploadUrl, { method: 'PUT', ... });
```

---

## 7. "Imagem não aparece após upload bem-sucedido"

### Sintomas
```
- Upload retorna URL (200 OK)
- Imagem 404 quando tenta acessar
- DevTools mostra 403 Forbidden
```

### Causas Possíveis

#### A) Arquivo não foi realmente gravado
**Solução:** Adicionar confirmação
```javascript
// Após upload bem-sucedido fazer GET da URL
const confirmUpload = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
};

// No uploadHelper:
const confirmResponse = await confirmUpload(finalUrl);
if (!confirmResponse) {
  throw new Error('Arquivo foi gravado mas não está acessível');
}
```

#### B) Permissão de acesso público não foi setada
**Solução:**
```javascript
// Squamata deveria settar makePublic()
// Se não estiver, adicionar em Squamata Upload:
await bucket.file(filePath).makePublic();
```

#### C) Caching (imagem antiga em cache)
```javascript
// Forçar reload sem cache:
const imageUrl = `${url}?t=${Date.now()}`;

// Ou usar no HTML:
<img src={imageUrl} cache-control="no-cache" />
```

---

## 8. Erros Comuns do Firebase Admin

### Erro: "Cannot find module 'firebase-admin'"
```bash
cd backend
npm install firebase-admin
```

### Erro: "FIREBASE_CREDENTIALS invalid JSON"
```bash
# Verificar arquivo:
cat backend/config/firebase-credentials.json

# Ou variável de ambiente:
echo $FIREBASE_CREDENTIALS | jq . # Deve ser JSON válido
```

### Erro: "storageBucket is required"
```javascript
// Em businessRoutes.js ou firebaseHelper.js:
// Verificar que está passando storageBucket corretamente:
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_BUCKET_URL // Não null!
});
```

---

## 9. Imagens Órfãs (armazenadas mas não referenciadas)

### Sintomas
```
- Storage grows indefinitely
- Imagens não aparecem em nenhum produto
```

### Solução
Implementar cleanup job:

```javascript
// backend/scripts/cleanupOrphanedImages.js
const admin = require('firebase-admin');

async function cleanupOrphanedImages() {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'uploads/' });
  
  // Buscar todas as imagens em produtos
  const config = await BusinessConfig.findOne();
  const usedImages = new Set();
  
  config.products.forEach(p => {
    if (p.imageUrls) {
      p.imageUrls.forEach(url => usedImages.add(url));
    }
  });
  
  // Deletar órfãs
  const orphans = files.filter(f => !usedImages.has(f.publicUrl()));
  
  for (const file of orphans) {
    await file.delete();
    console.log(`Deleted: ${file.name}`);
  }
}

// Agendar para rodar diariamente:
// 0 2 * * * node backend/scripts/cleanupOrphanedImages.js
```

---

## 10. Debugging Passo-a-Passo

### Ativar Logs Completos

**Frontend (uploadHelper.js):**
```javascript
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[uploadHelper]', ...args);
}
```

**Backend (businessRoutes.js):**
```javascript
const DEBUG = true;

router.post('/request-upload-url', authenticateToken, async (req, res) => {
  if (DEBUG) console.log('[request-upload-url]', {
    body: req.body,
    user: req.user.userId,
    squamataUrl: process.env.SQUAMATA_API_URL
  });
  // ...
});
```

**Flow completo (com logs):**
```
Cliente: uploadFileToFirebase()
  ↓ [log] Iniciando upload
Backend: /request-upload-url  
  ↓ [log] Requisição recebida
Squamata: /generate-upload-url
  ↓ [log] URL gerada
Cliente: fetch(uploadUrl, PUT)
  ↓ [log] Upload ao Firebase iniciado
Firebase: Gravação
  ↓ [log] Upload completo
Cliente: Retornar imageUrl
```

---

## Checklist de Debugging

Quando algo não funciona:

- [ ] Console do navegador tem erros?
- [ ] Console do servidor tem erros?
- [ ] Variáveis de ambiente configuradas?
- [ ] Squamata Upload está rodando?
- [ ] Firebase credentials são válidas?
- [ ] Token de autenticação válido?
- [ ] Arquivo está dentro do tamanho limite?
- [ ] Content-Type é image/*?
- [ ] URL assinada não expirou?
- [ ] Firewall não está bloqueando?

Se ainda não funcionar:
1. Ativar DEBUG = true
2. Reproduzir erro
3. Coletar logs completos
4. Verificar status do Squamata: curl http://localhost:3005
5. Verificar Firebase Console
