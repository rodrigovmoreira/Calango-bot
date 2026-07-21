import {
  Box, Container, Heading, Table, Thead, Tbody, Tr, Th, Td, Text, Button,
  VStack, Badge, useColorModeValue,
} from '@chakra-ui/react';
import { CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';

const plans = [
  {
    name: 'Grátis',
    price: 'Grátis',
    cta: 'Começar Grátis',
    ctaVariant: 'outline',
    highlight: false,
    features: {
      'Atendimentos/mês': '100',
      'Agendamento automático': true,
      'Catálogo de produtos': '5 produtos',
      'Múltiplos atendentes': false,
      'Relatórios': false,
      'API de integração': false,
      'Pixel do Facebook': false,
      'Suporte': 'Email',
    },
  },
  {
    name: 'Profissional',
    price: 'R$97/mês',
    cta: 'Testar 7 dias',
    ctaVariant: 'solid',
    highlight: true,
    features: {
      'Atendimentos/mês': '1.000',
      'Agendamento automático': true,
      'Catálogo de produtos': '50 produtos',
      'Múltiplos atendentes': '3 atendentes',
      'Relatórios': true,
      'API de integração': false,
      'Pixel do Facebook': true,
      'Suporte': 'Chat',
    },
  },
  {
    name: 'Empresarial',
    price: 'R$297/mês',
    cta: 'Falar com Vendas',
    ctaVariant: 'outline',
    highlight: false,
    features: {
      'Atendimentos/mês': 'Ilimitado',
      'Agendamento automático': true,
      'Catálogo de produtos': 'Ilimitado',
      'Múltiplos atendentes': '10+ atendentes',
      'Relatórios': true,
      'API de integração': true,
      'Pixel do Facebook': true,
      'Suporte': 'Dedicado',
    },
  },
];

const featureLabels = [
  'Atendimentos/mês',
  'Agendamento automático',
  'Catálogo de produtos',
  'Múltiplos atendentes',
  'Relatórios',
  'API de integração',
  'Pixel do Facebook',
  'Suporte',
];

const PricingTable = () => {
  const navigate = useNavigate();
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const highlightBg = useColorModeValue('brand.50', 'rgba(87, 138, 92, 0.15)');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const renderCell = (value) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckIcon color="green.500" boxSize={4} />
      ) : (
        <CloseIcon color="red.300" boxSize={3} />
      );
    }
    return <Text fontSize="sm">{value}</Text>;
  };

  return (
    <Box py={20} bg={useColorModeValue('white', 'gray.800')}>
      <Container maxW="container.lg">
        <VStack spacing={4} mb={12} textAlign="center">
          <Heading as="h2">Compare Nossos Planos</Heading>
          <Text color="gray.500" fontSize="lg" maxW="600px">
            Escolha o plano ideal para o tamanho do seu negócio. Cancele quando quiser.
          </Text>
        </VStack>

        {/* Tabela responsiva */}
        <Box overflowX="auto" borderRadius="xl" border="1px solid" borderColor={borderColor}>
          <Table variant="simple" size="lg">
            <Thead>
              <Tr bg={headerBg}>
                <Th fontSize="sm" fontWeight="bold" color="gray.500">
                  Funcionalidade
                </Th>
                {plans.map((plan) => (
                  <Th
                    key={plan.name}
                    textAlign="center"
                    bg={plan.highlight ? highlightBg : undefined}
                  >
                    <VStack spacing={1}>
                      {plan.highlight && (
                        <Badge colorScheme="green" variant="solid" fontSize="xs" mb={1}>
                          MAIS POPULAR
                        </Badge>
                      )}
                      <Heading as="h3" size="sm">
                        {plan.name}
                      </Heading>
                      <Heading size="lg" color="brand.500">
                        {plan.price}
                      </Heading>
                    </VStack>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {featureLabels.map((label) => (
                <Tr key={label}>
                  <Td fontWeight="medium" fontSize="sm">
                    {label}
                  </Td>
                  {plans.map((plan) => (
                    <Td
                      key={`${plan.name}-${label}`}
                      textAlign="center"
                      bg={plan.highlight ? highlightBg : undefined}
                    >
                      {renderCell(plan.features[label])}
                    </Td>
                  ))}
                </Tr>
              ))}

              {/* Linha de preço */}
              <Tr>
                <Td fontWeight="bold" fontSize="sm">
                  Preço
                </Td>
                {plans.map((plan) => (
                  <Td
                    key={`${plan.name}-price`}
                    textAlign="center"
                    bg={plan.highlight ? highlightBg : undefined}
                  >
                    <Text fontWeight="bold" fontSize="lg" color="brand.500">
                      {plan.price}
                    </Text>
                  </Td>
                ))}
              </Tr>

              {/* Linha de CTA */}
              <Tr>
                <Td></Td>
                {plans.map((plan) => (
                  <Td
                    key={`${plan.name}-cta`}
                    textAlign="center"
                    pb={6}
                    bg={plan.highlight ? highlightBg : undefined}
                  >
                    <Button
                      colorScheme="brand"
                      variant={plan.ctaVariant}
                      size="sm"
                      width="100%"
                      onClick={() => navigate('/login')}
                    >
                      {plan.cta}
                    </Button>
                  </Td>
                ))}
              </Tr>
            </Tbody>
          </Table>
        </Box>
      </Container>
    </Box>
  );
};

export default PricingTable;
