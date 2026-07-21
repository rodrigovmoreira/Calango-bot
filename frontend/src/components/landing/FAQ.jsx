import {
  Box, Container, Heading, VStack, Text,
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
  useColorModeValue,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';

const faqData = [
  {
    question: 'Como funciona o chatbot com IA para WhatsApp?',
    answer: 'O CalangoBot se conecta ao WhatsApp do seu negócio e usa inteligência artificial para entender e responder seus clientes automaticamente. Ele reconhece o contexto da conversa, entende perguntas comuns e pode agendar compromissos, enviar fotos de produtos e até fechar vendas — tudo sem intervenção humana.',
  },
  {
    question: 'Preciso saber programar para usar o CalangoBot?',
    answer: 'Não. O CalangoBot foi feito para ser simples. Você configura tudo pelo painel web: cadastra produtos, define horários e personaliza as respostas. Nenhum conhecimento técnico é necessário.',
  },
  {
    question: 'Quanto custa um sistema de agendamento automático?',
    answer: 'O CalangoBot tem um plano gratuito com funcionalidades essenciais. O plano Profissional sai por R$97/mês e inclui agendamento 100% automático, catálogo com 50 produtos e suporte por chat. O plano Empresarial custa R$297/mês com recursos ilimitados.',
  },
  {
    question: 'O CalangoBot funciona 24 horas por dia?',
    answer: 'Sim. O robô fica online 24 horas por dia, 7 dias por semana. Ele responde instantaneamente mesmo de madrugada, fins de semana e feriados — sua loja nunca fecha.',
  },
  {
    question: 'Consigo enviar catálogo de produtos pelo WhatsApp?',
    answer: 'Sim. Você cadastra seus produtos com fotos, preços e descrições no painel do CalangoBot. Quando um cliente pergunta sobre um produto, o robô envia a foto e as informações automaticamente na conversa.',
  },
  {
    question: 'Como funciona o agendamento para barbearia?',
    answer: 'O cliente envia uma mensagem perguntando por horários. O CalangoBot mostra os horários disponíveis da sua agenda, o cliente escolhe e a reserva é confirmada na hora. Você e o cliente recebem a confirmação automaticamente.',
  },
  {
    question: 'O plano grátis tem quais funcionalidades?',
    answer: 'O plano Grátis inclui: 100 atendimentos por mês, agendamento automático, catálogo com até 5 produtos, e suporte por email. É ideal para testar a plataforma e ver os resultados antes de assinar.',
  },
  {
    question: 'É seguro? Meus dados e os dos meus clientes ficam protegidos?',
    answer: 'Sim. Utilizamos criptografia de ponta a ponta e seguimos a LGPD. Seus dados e os dos seus clientes são armazenados de forma segura e nunca são compartilhados com terceiros.',
  },
  {
    question: 'Como instalar o CalangoBot no meu WhatsApp?',
    answer: 'Depois de criar sua conta, você acessa o painel e escaneia um QR Code com o WhatsApp do seu celular. Em menos de 2 minutos seu chatbot estará online e pronto para atender.',
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Sim. Não há fidelidade ou multa. Você pode cancelar seu plano a qualquer momento direto pelo painel, sem burocracia. Se cancelar, você mantém o acesso até o final do período já pago.',
  },
];

const generateFAQSchema = (faqList) => {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqList.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  });
};

const FAQ = () => {
  const bg = useColorModeValue('gray.50', 'gray.800');

  return (
    <Box py={20} bg={bg}>
      <Helmet>
        <script type="application/ld+json">
          {generateFAQSchema(faqData)}
        </script>
      </Helmet>

      <Container maxW="container.md">
        <VStack spacing={4} mb={12} textAlign="center">
          <Heading as="h2">Perguntas Frequentes</Heading>
          <Text color="gray.500" fontSize="lg">
            Tire suas dúvidas sobre o CalangoBot
          </Text>
        </VStack>

        <Accordion allowToggle defaultIndex={[0]}>
          {faqData.map((faq, index) => (
            <AccordionItem
              key={index}
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <AccordionButton py={5}>
                <Box flex="1" textAlign="left">
                  <Heading as="h3" size="sm" itemProp="name">
                    {faq.question}
                  </Heading>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel
                pb={5}
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <Text color="gray.600" itemProp="text">
                  {faq.answer}
                </Text>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Box>
  );
};

export default FAQ;
