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
- **Design System (Chakra UI):**
  - **NUNCA use CSS puro ou styled-components.** Todo o estilo deve ser feito via Props do Chakra UI (ex: `bg`, `p`, `m`, `borderRadius`).
  - **Dark Mode First:** Todo componente deve ser desenhado pensando nos dois temas. Use SEMPRE o hook `useColorModeValue(lightColor, darkColor)` para definir cores de fundo, bordas e textos (ex: `const cardBg = useColorModeValue('white', 'gray.800')`).
  - As cores primárias devem sempre referenciar a paleta `brand` (ex: `brand.500`) definida no `theme.js`.
  - **Otimização e Performance:**
  - O `Dashboard.jsx` utiliza `Suspense` e `React.lazy`. Se você criar uma nova Aba (Tab), ela DEVE ser importada usando `lazy(() => import('...'))` para não inchar o bundle principal.
  - Componentes de carregamento devem utilizar o `<SmartLoader />` para manter a identidade visual do sistema, em vez de spinners genéricos soltos na tela.

- **Upload de Imagens e Arquivos:**
  - NUNCA crie rotas ou lógicas usando `FormData` enviando arquivos brutos para os controllers do Node.js.
  - Para qualquer upload no frontend, importe e utilize estritamente a função `uploadMultipleFiles` ou `uploadFileToFirebase` do arquivo `src/utils/uploadHelper.js`. Essa função já resolve a autenticação no Squamata e gera as URLs públicas.

- **Comunicação em Tempo Real (Socket.io):**
  - Eventos de status do WhatsApp são geridos no `AppContext.js`. Não recrie conexões de Socket espalhadas por componentes, a menos que seja um ambiente isolado do dashboard, como o `PublicChat.jsx`.
  
- **Autenticação e Interceptors:**
  - Não é necessário gerenciar os Headers de `Authorization` manualmente dentro dos componentes. O arquivo `services/api.js` já possui *interceptors* do Axios que injetam o Bearer Token em todas as requisições e redirecionam o usuário para `/login` em caso de erro `401 Unauthorized`.

- **Manipulação de Estado e API:**
  - Consuma a API exclusivamente através do serviço centralizado `businessAPI` (localizado em `src/services/api.js`).
  - Toda mutação (PUT/PATCH/DELETE) que atualize os dados em tela deve ser seguida por um recarregamento da lista correspondente (ex: `fetchAppointments()`) APENAS em caso de sucesso.

- **Tratamento de Conflito (Optimistic Concurrency - Erro 409):**
  - Todo bloco `catch` em requisições de atualização (PUT/PATCH) deve obrigatoriamente checar `error.response?.status === 409`.
  - Se for 409, exiba um Toast com a mensagem: "Conflito de Versão. Este item foi modificado por outro usuário. Recarregue a página...". **NUNCA force `window.location.reload()` ou zere o estado do componente de forma automática**, permitindo que o usuário copie seus dados antes de perder a tela.

## 3. Fluxo de Trabalho (Workflow para IAs)
- **Passos de Bebê:** Não modifique 15 arquivos de uma vez. Faça uma alteração, valide a arquitetura, implemente o backend, depois o frontend, e gere o PR.
- **Retrocompatibilidade:** Se for criar um campo novo no banco (ex: `phoneNumber`), não apague o campo antigo (`phone`) a menos que uma rotina de migração explícita tenha sido criada. Não quebre a produção existente.

## 4. Permissões e Rotas
- Proteja sempre rotas de gerenciamento estrutural usando o middleware `requireAdmin`.
- As buscas (`findOne`, `find`) nos controllers devem SEMPRE ser filtradas por `businessId` (usando o `activeBusinessId` do usuário logado) para garantir que um inquilino (Tenant) nunca vaze dados de outro inquilino.