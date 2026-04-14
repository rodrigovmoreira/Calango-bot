# 🚀 GUIA RÁPIDO - Como Usar o Upload Squamata

**Para**: Novos desenvolvedores | **Tempo**: 5 minutos

---

## ⚡ Tl;DR (Super Rápido)

```javascript
// Apenas importe e use:
import { uploadMultipleFiles } from './utils/uploadHelper';

const urls = await uploadMultipleFiles(fileArray, 'products');
// urls = ['https://storage.googleapis.com/...?alt=media', ...]
```

**Pronto!** A imagem está no Firebase e a URL é pública. ✅

---

## 📋 Arquitetura em 30 Segundos

```
User seleciona arquivo
    ↓
Frontend chama uploadMultipleFiles()
    ↓
uploadHelper.js pede URL ao backend
    ↓
Backend faz proxy para Squamata Upload
    ↓
Squamata retorna URL assinada (para PUT)
    ↓
Frontend faz PUT direto no Firebase
    ↓
Frontend constrói URL pública (para GET)
    ↓
Imagem está pronta para usar! ✅
```

**2 requisições HTTP. Fim.**

---

## 🛠️ Setup Inicial (Primeira Vez)

### 1. Variáveis de Ambiente

Arquivo: `c:\Calango-bot\.env`

```env
# Backend
SQUAMATA_API_URL=http://localhost:3005
SQUAMATA_API_KEY=GfSLsZV8RFzVlPnJF5J8Ru1eUmi8Bs9DnNklmNSv6t73wJCtBsGcTpCsHPgKIq5s
FIREBASE_BUCKET_URL=calango-chatbot.firebasestorage.app

# Frontend (em .env na raiz)
REACT_APP_FIREBASE_BUCKET=calango-chatbot.firebasestorage.app
REACT_APP_API_URL=http://localhost:3001
```

### 2. Validar Setup

```bash
cd c:\Calango-bot
node verify-env-setup.js
# Deve mostrar: ✅ tudo configurado
```

### 3. Iniciar Servidores

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd frontend && npm start
```

---

## 💻 Usar em um Componente

### Exemplo 1: Upload Único

```jsx
import { uploadFileToFirebase } from '../utils/uploadHelper';

export function MyComponent() {
  const handleUpload = async (file) => {
    try {
      const { imageUrl } = await uploadFileToFirebase(file, 'products');
      console.log('URL para salvar no DB:', imageUrl);
      // Salva imageUrl no banco
    } catch (error) {
      console.error('Erro:', error.message);
    }
  };

  return (
    <input 
      type="file" 
      onChange={(e) => handleUpload(e.target.files[0])} 
    />
  );
}
```

### Exemplo 2: Upload Múltiplo

```jsx
import { uploadMultipleFiles } from '../utils/uploadHelper';

export function MyComponent() {
  const handleMultipleUpload = async (files) => {
    try {
      const urls = await uploadMultipleFiles(files, 'products');
      console.log('URLs:', urls); // Array de URLs públicas
      // Salva URLs no banco
    } catch (error) {
      console.error('Erro:', error.message);
    }
  };

  return (
    <input 
      type="file" 
      multiple
      onChange={(e) => handleMultipleUpload(e.target.files)} 
    />
  );
}
```

---

## 📚 Documentação Essencial

| Documento | Quando Usar |
|-----------|-----------|
| 📖 `ATIVACAO_UPLOAD_AGORA.md` | Primeira vez ativando o upload |
| 📖 `EXEMPLO_SIMPLIFICADO.js` | Precisa ver exemplo de código |
| 🐛 `TROUBLESHOOTING.md` | Algo não está funcionando |
| 🔧 `MIGRACAO_SQUAMATA_UPLOAD.md` | Entender como foi migrado do Multer |
| 🏗️ `ARCHITECTURE.md` | Entender arquitetura geral |

---

## ❓ Problemas Comuns

### ❌ "REACT_APP_FIREBASE_BUCKET undefined"

**Solução**: Reinicie o frontend
```bash
# Terminal onde roda npm start
# Pressione Ctrl+C
# Depois: npm start
```

### ❌ "Backend não retornou downloadUrl"

**Solução**: Verifique variáveis
```bash
node verify-env-setup.js
# Certifique-se que SQUAMATA_API_KEY está configurado
```

### ❌ Imagem não aparece no preview

**Solução**: Verifique console (F12)
- A URL está sendo gerada? (Procure por "Upload realizado")
- A imagem carrega? (Abra a URL em aba nova)

### ❌ "Erro 403 Forbidden"

**Solução**: Problema de assinatura (rara)
```
Se acontecer, reinicie backend:
cd c:\Calango-bot
npm run dev
```

---

## ✅ Checklist de Desenvolvimento

Antes de commitar código com upload:

- [ ] Testei upload com arquivo pequeno? (< 1 MB)
- [ ] Testei upload com arquivo grande? (> 5 MB)
- [ ] Imagem aparece no preview?
- [ ] Quando salvo produto, URL é persistida?
- [ ] Quando recarrego página, imagem continua?
- [ ] Console não mostra erros?

---

## 🔍 Debugging

### Ver todos os logs do upload

Abra DevTools (F12) → Console e procure por:
```
[uploadHelper] ✅ Upload realizado
```

Se vir este log, upload está ok! ✅

### Ver requisições HTTP

DevTools → Network → Procure por:
- `request-upload-url` (backend chamando Squamata)
- `storage.googleapis.com` (PUT no Firebase)

---

## 🎯 Fluxo de Trabalho Típico

```javascript
// 1. Importar
import { uploadMultipleFiles } from './utils/uploadHelper';

// 2. Fazer upload (em um handler)
const imageUrls = await uploadMultipleFiles(files, 'products');

// 3. Atualizar estado local
setProduct(prev => ({
  ...prev,
  imageUrls: [...prev.imageUrls, ...imageUrls]
}));

// 4. Ao salvar produto, incluir imageUrls
await api.post('/api/products', {
  name,
  description,
  imageUrls,  // URLs públicas do Firebase
  ...
});
```

**Simples assim!** ✅

---

## 🚀 Performance

```
Upload de 1 imagem:    ~500ms
Upload de 3 imagens:   ~1.5s (paralelo)
Upload de 10 imagens:  ~4s (paralelo)

Rede paralela FTW!
```

Os uploads são feitos em paralelo (Promise.all).

---

## 📞 Suporte

Qualquer dúvida? Consulte:
1. `TROUBLESHOOTING.md` - Problemas específicos
2. Console (F12) - Logs e erros
3. Código em `uploadHelper.js` - Está bem documentado!

---

## ✨ Resumo

- ✅ Upload é **simples**: 2 funções, 1 linha de import
- ✅ **Rápido**: Requisições paralelas
- ✅ **Seguro**: Squamata assina URLs, Firebase valida
- ✅ **Escalável**: Pode fazer upload de múltiplos arquivos
- ✅ **Mantível**: Código é limpo e autodocumentado

**Você está pronto para usar!** 🎉
