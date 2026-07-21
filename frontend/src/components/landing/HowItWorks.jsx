import {
  Box, Container, Heading, VStack, Text, Icon, useColorModeValue, Flex,
} from '@chakra-ui/react';
import { FaWhatsapp, FaCog, FaRocket } from 'react-icons/fa';

const steps = [
  {
    number: 1,
    icon: FaWhatsapp,
    title: 'Conecte seu WhatsApp',
    description: 'Em menos de 2 minutos, você conecta o número do seu negócio. Sem precisar instalar nada complicado — é só escanear um QR Code e pronto.',
  },
  {
    number: 2,
    icon: FaCog,
    title: 'Configure seu chatbot',
    description: 'Cadastre seus produtos, defina preços e horários disponíveis. A IA aprende sobre o seu negócio e já começa a atender automaticamente.',
  },
  {
    number: 3,
    icon: FaRocket,
    title: 'Automatize e economize',
    description: 'O CalangoBot atende seus clientes 24h, agenda compromissos e envia catálogos enquanto você cuida do que realmente importa.',
  },
];

const HowItWorks = () => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box py={20}>
      <Container maxW="container.xl">
        <VStack spacing={4} mb={16} textAlign="center">
          <Heading as="h2">Como o CalangoBot Funciona</Heading>
          <Text color="gray.500" fontSize="lg" maxW="600px">
            Três passos simples para transformar seu atendimento no WhatsApp
          </Text>
        </VStack>

        <Flex
          direction={{ base: 'column', md: 'row' }}
          align="stretch"
          justify="center"
          gap={6}
        >
          {steps.map((step, index) => (
            <Box
              key={step.number}
              flex={1}
              bg={cardBg}
              p={8}
              borderRadius="xl"
              boxShadow="lg"
              border="1px solid"
              borderColor={borderColor}
              position="relative"
              textAlign="center"
              maxW={{ base: '100%', md: '350px' }}
            >
              {/* Número em círculo */}
              <Box
                w="50px"
                h="50px"
                borderRadius="full"
                bg="brand.500"
                color="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="bold"
                fontSize="xl"
                mx="auto"
                mb={4}
              >
                {step.number}
              </Box>

              <Icon as={step.icon} w={10} h={10} color="brand.500" mb={4} />

              <Heading as="h3" size="md" mb={3}>
                {step.title}
              </Heading>
              <Text color="gray.500" fontSize="sm">
                {step.description}
              </Text>

              {/* Seta entre steps (mobile: para baixo, desktop: para direita) */}
              {index < steps.length - 1 && (
                <Text
                  display={{ base: 'block', md: 'none' }}
                  color="brand.500"
                  fontSize="2xl"
                  mt={4}
                  textAlign="center"
                >
                  ↓
                </Text>
              )}
            </Box>
          ))}
        </Flex>
      </Container>
    </Box>
  );
};

export default HowItWorks;
