# Roteiro de Testes
*(Adicione novos itens de cada aba conforme necessidade)*

## Testes Essenciais
**Abas:**

### 1. Visão Geral
(Sem necessidade de testes atualmente)

---

### 2. Conexão e Negócio
- [ ] **2.1** - Ligue o robô e leia o qr-code
- [ ] **2.2** - Cadastre as informações da empresa e horário de funcionamento.
- [ ] **2.3** - Cadastre as redes sociais e site

---

### 3. Aba Inteligência e Nicho
- [ ] **3.1** - Verifique o nome e o tom de voz
- [ ] **3.2** - Verifique o conteúdo do cérebro (instruções principais). Tente não colar um texto longo e genérico.
- [ ] **3.3** - Verifique o conteúdo da visão. Faça uma instrução de como o robô lida com a leitura de imagens.
- [ ] **3.5** - Verifique as regras de engajamento para responder os usuários de acordo com as limitações impostas pela Blacklist/Whitelist.
- [ ] **3.4** - Recuperação de inatividade. Verifique se usando uma instrução como prompt o robô vai criar uma resposta com IA ou mandar uma mensagem fixa.

---

### 4. Respostas Rápidas
- [ ] **4.1** - Cadastre respostas rápidas e teste os modelos possíveis (resposta fixa ou com IA).
- [ ] **4.2** - Crie um diálogo que usa palavras-chave das repostas automática para validar se está usando as respostas gravadas.

---

### 5. Catálogo
- [ ] **5.1** - Cadastre produtos, adicione imagens, descrição, preço, palavras-chave. 
- [ ] **5.2** - Crie um diálogo solicitando produtos/serviços que estão cadastrados para validar se as respostas são coerentes e está usando os itens cadastrados

---

### 6. Campanhas
- [ ] **6.1** - Crie várias campanhas, cada uma com particularidades para testar as situações.
- [ ] **6.2** - Use os agendamentos de campanhas para testar a recorrência de envios
- [ ] **6.3** - Crie campanhas com diferentes etiquetas para atingir públicos diferentes.

---

### 7. Chat Ao vivo
- [ ] **7.1** - Clique no botão de sincronizar e faça a sincronização de etiquetas e contatos.
- [ ] **7.2** - Clique no botão de gerenciamento de etiquetas para testar a edição delas.
- [ ] **7.3** - Valide se as etiquetas somem, mudam, sobrepõe quando sincroniza novamente.
- [ ] **7.4** - Importe os contatos (a importação de contatos está limitada aos 15 contatos mais recentes).
- [ ] **7.5** - Faça uma conversa pelo chat e anote os pontos de melhorias que são essenciais para usabilidade.
- [ ] **7.6** - Inclua etiquetas aos contatos de acordo com as regras que julgar necessárias.
- [ ] **7.7** - Teste de novos contatos. Verifique se eles já aparecem com alguma etiqueta de novo cliente ou etapa do funil.

---

### 8. Agendamentos
- [ ] **8.1** - Valide em uma conversa onde foi solicitado agendamento, se ele é registrado na agenda corretamente 
- [ ] **8.2** - Crie agendamentos manuais e entre numa conversa solicitando agendamento no horário que já está em uso

---

### 9. Funil de Vendas
- [ ] **9.1** - Crie colunas de etiquetas principais, para incluir a etapa de conversa com os clientes.
- [ ] **9.2** - Use o botão do cérebro para criar os prompts de comportamento do robô em cada etapa. Teste contatos que estão em cada etapa de execução.

---

# Teste Prático (Test-Drive)
*(Simulação de uma jornada real de atendimento)*

### Fase 1: Quebra-Gelo e Identificação
- [ ] **1.1** - Envie "Oi" de um número de teste sem histórico de conversas.
- [ ] **1.2** - Verifique se o bot espera o buffer (~5s), exibe o status "Digitando..." e envia a saudação perguntando seu nome.
- [ ] **1.3** - Responda com seu nome (ex: "Me chamo João") e verifique se o bot confirma e passa a utilizá-lo na conversa.

---

### Fase 2: Pesquisa e Catálogo
- [ ] **2.1** - Envie duas mensagens rápidas seguidas: "Eu queria saber..." e "Quanto custa o serviço principal?".
- [ ] **2.2** - Verifique se o bot agrupa as mensagens e usa a ferramenta de catálogo para retornar o preço correto e as imagens do produto.

---

### Fase 3: Agendamento Preciso
- [ ] **3.1** - Peça um agendamento usando data relativa (ex: "Quero agendar para a próxima sexta à tarde"). 
- [ ] **3.2** - Verifique se a IA reconhece o dia correto da semana e oferece os horários disponíveis.
- [ ] **3.3** - Confirme o horário (ex: "Pode ser às 14h") e verifique na agenda se o horário de término foi calculado com a duração correta do serviço.

---

### Fase 4: Recuperação e Handover (Atendimento Humano)
- [ ] **4.1** - Mova o contato no Funil de Vendas para uma etapa que possua *Follow-up* configurado.
- [ ] **4.2** - Pare de enviar mensagens no celular de teste e aguarde o tempo estipulado.
- [ ] **4.3** - Verifique se o bot chamou o cliente de volta com uma nova mensagem natural gerada pela IA baseada no contexto.
- [ ] **4.4** - Na tela de Chat ao Vivo, envie uma mensagem manual como atendente.
- [ ] **4.5** - Verifique se o modo *Handover* foi ativado (o bot deve ficar silenciado e o relógio de inatividade deve parar).