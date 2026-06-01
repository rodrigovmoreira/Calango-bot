import express from 'express';

const router = express.Router();

// 1. Rota de VERIFICAÇÃO (GET) - A Meta bate aqui quando você clica em "Verificar e Salvar"
router.get('/webhook', (req, res) => {
  // Parâmetros que a Meta envia na URL
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    // Valida se a intenção é assinar e se a senha é exatamente a que criamos no .env
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      console.log('✅ Webhook da Meta verificado com sucesso!');
      // É obrigatório devolver apenas o "challenge" e o status 200
      res.status(200).send(challenge);
    } else {
      console.error('❌ Falha na verificação da Meta: Token incorreto.');
      res.sendStatus(403);
    }
  } else {
    res.status(400).send('Faltam parâmetros de verificação.');
  }
});

// 2. Rota de RECEBIMENTO (POST) - A Meta vai mandar os dados do Lead Ads para cá
router.post('/webhook', (req, res) => {
  const body = req.body;

  // Verifica se o evento veio de uma Página do Facebook/Instagram
  if (body.object === 'page') {
    // ⚠️ REGRA DE OURO DA META: Devolver status 200 IMEDIATAMENTE antes de processar
    // Se não fizermos isso rápido, a Meta acha que deu erro e tenta reenviar o mesmo dado.
    res.status(200).send('EVENT_RECEIVED');

    // Aqui vamos inserir a lógica de buscar os dados do lead e salvar no MongoDB depois!
    console.log('📥 Notificação de Lead recebida:', JSON.stringify(body, null, 2));
    
  } else {
    res.sendStatus(404);
  }
});

export default router;