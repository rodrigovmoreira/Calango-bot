# 📜 Diretrizes de Desenvolvimento e Código Limpo (Guidelines)

Todo desenvolvedor (humano ou IA) que contribuir para o Calango Bot deve seguir ESTRITAMENTE as regras abaixo para garantir um código limpo, consistente, legível e seguro.

## 1. Segurança e Integridade de Dados (Optimistic Concurrency)
- **A Regra de Ouro do Banco:** Nunca sobrescreva dados cegamente. 
- Todos os Schemas principais possuem `{ optimisticConcurrency: true }` e o campo `__v` ativado.
- **Backend (PUT/PATCH):**
  - Sempre exija o `__v` no payload de atualização.
  - USE SEMPRE o operador `$set` para atualizar *apenas* os campos enviados no `req.body`.
  - Se for usar `findOneAndUpdate`, o Mongoose não incrementa a versão automaticamente. Você deve injetar `$inc: { __v: 1 }` e validar manualmente retornando erro HTTP `409 Conflict` em caso de colisão.
- **Frontend (Payload Inteligente):**
  - Nunca envie o objeto inteiro no formulário de edição. Calcule o "diff" (o que mudou desde que o modal abriu) e envie apenas os campos alterados junto com o `__v`.
  - **Interceptação 409:** O erro `409 Conflict` NÃO deve forçar um *auto-refresh* imediato na tela. Exiba um Toast de erro (exigindo que o usuário recarregue) para evitar que o usuário perca o que acabou de digitar.

## 2. Qualidade e Padrões de Código
- **Backend:**
  - Evite "Fat Controllers". Lógica de negócios pesada deve residir em `/services`. Os Controllers devem apenas receber a requisição, chamar o serviço e retornar a resposta formatada.
  - Utilize blocos `try/catch` sempre. Retorne erros no formato JSON: `res.status(XXX).json({ message: 'Error description', error: e.message })`.
- **Frontend:**
  - Use e abuse do ecossistema do **Chakra UI** para componentes. Não crie CSS customizado desnecessário.
  - Utilize hooks customizados para abstrair chamadas de API repetitivas, mantendo os componentes limpos.

## 3. Fluxo de Trabalho (Workflow para IAs)
- **Passos de Bebê:** Não modifique 15 arquivos de uma vez. Faça uma alteração, valide a arquitetura, implemente o backend, depois o frontend, e gere o PR.
- **Retrocompatibilidade:** Se for criar um campo novo no banco (ex: `phoneNumber`), não apague o campo antigo (`phone`) a menos que uma rotina de migração explícita tenha sido criada. Não quebre a produção existente.

## 4. Permissões e Rotas
- Proteja sempre rotas de gerenciamento estrutural usando o middleware `requireAdmin`.
- As buscas (`findOne`, `find`) nos controllers devem SEMPRE ser filtradas por `businessId` (usando o `activeBusinessId` do usuário logado) para garantir que um inquilino (Tenant) nunca vaze dados de outro inquilino.