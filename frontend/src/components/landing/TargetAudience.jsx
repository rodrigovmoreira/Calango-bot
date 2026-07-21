import {
  Box, Container, Heading, SimpleGrid, VStack, Text, Icon, useColorModeValue,
} from '@chakra-ui/react';
import { FaCut, FaClinicMedical, FaHome, FaShoppingBag, FaUtensils, FaTools } from 'react-icons/fa';

const niches = [
  {
    icon: FaCut,
    name: 'Barbearias e Salões',
    benefit: 'Agendamento automático e envio de fotos de cortes.',
  },
  {
    icon: FaClinicMedical,
    name: 'Clínicas e Consultórios',
    benefit: 'Confirmação de consultas e lembretes automáticos para reduzir faltas.',
  },
  {
    icon: FaHome,
    name: 'Imobiliárias',
    benefit: 'Catálogo de imóveis e agendamento de visitas sem perder nenhum lead.',
  },
  {
    icon: FaShoppingBag,
    name: 'Lojas e E-commerce',
    benefit: 'Vitrine de produtos e carrinho de compras direto pelo WhatsApp.',
  },
  {
    icon: FaUtensils,
    name: 'Restaurantes',
    benefit: 'Cardápio digital e pedidos automatizados 24 horas por dia.',
  },
  {
    icon: FaTools,
    name: 'Prestadores de Serviço',
    benefit: 'Orçamentos automáticos e agendamento para qualquer tipo de serviço.',
  },
];

const TargetAudience = () => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const cardHoverBg = useColorModeValue('gray.50', 'gray.600');

  return (
    <Box py={20} bg={useColorModeValue('gray.50', 'gray.800')}>
      <Container maxW="container.xl">
        <VStack spacing={4} mb={16} textAlign="center">
          <Heading as="h2">Para Quem é o CalangoBot</Heading>
          <Text color="gray.500" fontSize="lg" maxW="600px">
            Feito para pequenos e médios negócios que querem vender mais sem aumentar a equipe
          </Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={8}>
          {niches.map((niche) => (
            <VStack
              key={niche.name}
              bg={cardBg}
              p={6}
              borderRadius="xl"
              boxShadow="md"
              align="center"
              textAlign="center"
              spacing={3}
              transition="all 0.2s"
              _hover={{ bg: cardHoverBg, transform: 'translateY(-4px)', boxShadow: 'lg' }}
            >
              <Icon as={niche.icon} w={8} h={8} color="brand.500" />
              <Heading as="h3" size="sm" fontWeight="bold">
                {niche.name}
              </Heading>
              <Text color="gray.500" fontSize="sm">
                {niche.benefit}
              </Text>
            </VStack>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default TargetAudience;
