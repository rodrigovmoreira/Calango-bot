import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(([from, to]) => {
    content = content.replaceAll(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/services/wwebjsService.js', [
  ['const sendWWebJSMessage = async (userId, to, message)', 'const sendWWebJSMessage = async (businessId, to, message)'],
  ['const client = sessions.get(userId.toString());', 'const client = sessions.get(businessId.toString());'],
  ['⚠️ Envio falhou: User ${userId} não tem sessão ativa.', '⚠️ Envio falhou: Negócio ${businessId} não tem sessão ativa.'],
  ['⚠️ Envio falhou: WhatsApp do User ${userId} ainda não está pronto.', '⚠️ Envio falhou: WhatsApp do Negócio ${businessId} ainda não está pronto.'],

  // also getClientSession needs update? let's check
]);
