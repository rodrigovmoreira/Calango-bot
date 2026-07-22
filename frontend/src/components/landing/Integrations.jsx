import {
  Box, Container, Heading, SimpleGrid, VStack, Text, Icon, useColorModeValue,
} from '@chakra-ui/react';
import {
  FaWhatsapp, FaGoogle, FaFacebook, FaCalendarAlt, FaLink, FaVideo,
} from 'react-icons/fa';

const integrations = [
  {
    icon: FaWhatsapp,
    name: 'WhatsApp Business API',
    description: 'Integração oficial com a API do WhatsApp. Envie e receba mensagens, imagens e catálogos diretamente.',
  },
  {
    icon: FaGoogle,
    name: 'Google Agenda',
    description: 'Sincronize seus agendamentos com o Google Calendar. Clientes veem horários disponíveis em tempo real.',
  },
  {
    icon: FaVideo,
    name: 'Google Meet',
    description: 'Gere links de videochamada automaticamente nos agendamentos. Perfeito para consultas e reuniões online.',
  },
  {
    icon: FaFacebook,
    name: 'Facebook & Instagram',
    description: 'Conecte suas redes sociais e capture leads. Pixel do Facebook incluso para remarketing.',
  },
  {
    icon: FaCalendarAlt,
    name: 'Calendly',
    description: 'Compatível com fluxos do Calendly. Clientes agendam sem sair do WhatsApp.',
  },
  {
    icon: FaLink,
    name: 'Webhook & API Própria',
    description: 'Integração via webhooks para disparar ações no seu sistema. Conecte ERPs, CRMs e ferramentas personalizadas.',
  },
];

const Integrations = () => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const cardHoverBg = useColorModeValue('gray.50', 'gray.600');

  return (
    <Box py={20} bg={useColorModeValue('gray.50', 'gray.800')}>
      <Container maxW="container.xl">
        <VStack spacing={4} mb={16} textAlign="center">
          <Heading as="h2">Integrações Poderosas</Heading>
          <Text color="gray.500" fontSize="lg" maxW="600px">
            Conecte o CalangoBot com as ferramentas que você já usa no dia a dia
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={8}>
          {integrations.map((item) => (
            <VStack
              key={item.name}
              bg={cardBg}
              p={6}
              borderRadius="xl"
              boxShadow="md"
              align="center"
              textAlign="center"
              spacing={3}
              transition="all 0.2s"
              _hover={{ bg: cardHoverBg, transform: 'translateY(-4px)' }}
            >
              <Icon as={item.icon} w={8} h={8} color="brand.500" />
              <Heading as="h3" size="sm" fontWeight="bold">
                {item.name}
              </Heading>
              <Text color="gray.500" fontSize="sm">
                {item.description}
              </Text>
            </VStack>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default Integrations;
