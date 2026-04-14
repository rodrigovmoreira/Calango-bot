# 🚀 ATIVAR UPLOAD AGORA

## ⏱️ Isso vai levar 2 minutos

---

## 1️⃣ Verificar Arquivo `.env` do Frontend

Abra: `c:\Calango-bot\.env`

Deve conter:
```env
REACT_APP_FIREBASE_BUCKET=calango-chatbot.firebasestorage.app
REACT_APP_API_URL=http://localhost:3001
```

✅ Se tem essas linhas, vá para **Passo 2**
❌ Se não tem, adicione agora e salve o arquivo

---

## 2️⃣ Verificar Backend

Abra: `c:\Calango-bot\backend\.env`

Deve conter:
```env
SQUAMATA_API_URL=http://localhost:3005
SQUAMATA_API_KEY=seu-token-aqui
FIREBASE_BUCKET_URL=calango-chatbot.firebasestorage.app
```

⚠️ Se **não tiver**, adicione e salve!

---

## 3️⃣ REINICIAR FRONTEND (OBRIGATÓRIO!)

Abra um terminal na pasta `c:\Calango-bot\frontend` e execute:

```bash
# Para o servidor atual (Ctrl + C)
^C

# Reinicia
npm start
```

**AGUARDE** até aparecer:
```
webpack compiled successfully
```

Isso significa que o `.env` foi lido e as variáveis estão carregadas! ✅

---

## 4️⃣ Testar Upload

1. Abra: `http://localhost:3000` (ou aonde o frontend está rodando)
2. Vá para: **Dashboard → Catálogo → Novo Produto**
3. Escolha **uma imagem** no campo de upload
4. Clique em **"Salvar Produto"**

**Abra o DevTools (F12)** e procure por logs com `[uploadHelper]`:

✅ Se vir:
```
[uploadHelper] ✅ Iniciando upload...
[uploadHelper] ✅ URL assinada obtida
[uploadHelper] ✅ Upload anunciado em Firebase
[uploadHelper] ✅ Imagem salva com sucesso
```

**PRONTO! O upload está funcionando!** 🎉

---

## ❌ Se der erro?

### Erro 1: `REACT_APP_FIREBASE_BUCKET undefined`
- **Causa**: Frontend não foi reiniciado
- **Solução**: `npm start` novamente na pasta frontend

### Erro 2: `SQUAMATA_API_URL não está configurado`
- **Causa**: Backend não tem `.env` configurado
- **Solução**: Adicione variáveis no `backend\.env` e reinicie backend

### Erro 3: `403 Forbidden` do Firebase
- **Causa**: Content-Type incorreto ou bucket errado
- **Solução**: Verifique se `REACT_APP_FIREBASE_BUCKET` é exatamente `calango-chatbot.firebasestorage.app`

### Erro 4: Imagem não aparece no Firebase
- **Causa**: Squamata não retornou URL válida
- **Solução**: Verifique `SQUAMATA_API_URL` e `SQUAMATA_API_KEY`

---

## 🔍 Verificição Rápida

Execute isto no console (F12) do navegador:

```javascript
// Deve mostrar o bucket
console.log('Bucket:', process.env.REACT_APP_FIREBASE_BUCKET);

// Deve mostrar URL da API
console.log('API:', process.env.REACT_APP_API_URL);
```

Se ambos mostrarem valores (não undefined), o frontend está pronto! ✅

---

## 📋 Checklist

- [ ] Adicionei `REACT_APP_FIREBASE_BUCKET` no `.env`?
- [ ] Adicionei `SQUAMATA_API_URL` no `backend/.env`?
- [ ] Adicionei `SQUAMATA_API_KEY` no `backend/.env`?
- [ ] Reiniciei o frontend (`npm start`)?
- [ ] Vejo `webpack compiled successfully`?
- [ ] Testei upload de imagem?
- [ ] Vejo logs `[uploadHelper]` no console?

Se marcou tudo ✅, **o upload deve estar funcionando!**

---

## 🎯 O que mudou

Você migrou de upload interno (Multer) para **Squamata Upload Service**:

```
ANTES:
Frontend → Backend (Multer) → Sharp → Firebase

AGORA:
Frontend → Squamata (gera URL) → Frontend → Firebase (upload direto)
```

Por isso precisa configurar Squamata!

---

## 📞 Próximos Passos

Quando upload estiver 100% funcionando:

```bash
# 1. Deletar código antigo (upload.js)
node delete-upload-js.js

# 2. Fazer commit
git add .
git commit -m "chore: Remove old Multer upload code"

# 3. Deploy em produção
# (com as mesmas variáveis de ambiente)
```

---

**Dúvida?** Consulte:
- [`.env-CONFIG.md`](.env-CONFIG.md) - Guia completo de variáveis
- [`verify-env-setup.js`](verify-env-setup.js) - Script de verificação
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) - Guia de erros
