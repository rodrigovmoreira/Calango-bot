import React from 'react';
import { Box, Container, Heading, Text, VStack, UnorderedList, ListItem, Divider, useColorModeValue } from '@chakra-ui/react';

const PrivacyPolicy = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.700', 'gray.300');
  const headingColor = useColorModeValue('teal.600', 'teal.300');

  return (
    <Box bg={useColorModeValue('gray.50', 'gray.900')} minH="100vh" py={12}>
      <Container maxW="container.md" bg={bgColor} p={8} borderRadius="lg" boxShadow="md">
        <VStack align="start" spacing={6}>
          <Box w="100%">
            <Heading as="h1" size="xl" color={headingColor} mb={2}>
              Política de Privacidade e Proteção de Dados
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </Text>
            <Divider mt={4} />
          </Box>

          <Text color={textColor} textAlign="justify">
            A sua privacidade é fundamental para nós do <strong>Calango Bot</strong>. Esta Política de Privacidade explica como coletamos, usamos, protegemos e tratamos os seus dados pessoais, em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong> do Brasil.
          </Text>

          <Box w="100%">
            <Heading as="h2" size="md" color={headingColor} mb={3}>
              1. Quais dados coletamos?
            </Heading>
            <Text color={textColor} mb={2}>
              Através dos nossos formulários de contato (incluindo os formulários de Lead Ads da Meta/Facebook/Instagram), coletamos apenas as informações fornecidas voluntariamente por você:
            </Text>
            <UnorderedList color={textColor} pl={5}>
              <ListItem>Nome completo</ListItem>
              <ListItem>Número de telefone / WhatsApp</ListItem>
              <ListItem>Endereço de e-mail</ListItem>
            </UnorderedList>
          </Box>

          <Box w="100%">
            <Heading as="h2" size="md" color={headingColor} mb={3}>
              2. Como usamos os seus dados?
            </Heading>
            <Text color={textColor} mb={2}>
              Os dados coletados têm uma finalidade estritamente comercial e de atendimento ágil. Utilizamos suas informações exclusivamente para:
            </Text>
            <UnorderedList color={textColor} pl={5}>
              <ListItem>Entrar em contato via WhatsApp, ligação ou e-mail para responder à sua solicitação e iniciar o atendimento.</ListItem>
              <ListItem>Apresentar propostas comerciais, orçamentos ou informações dos nossos serviços.</ListItem>
            </UnorderedList>
          </Box>

          <Box w="100%">
            <Heading as="h2" size="md" color={headingColor} mb={3}>
              3. Compartilhamento de Dados
            </Heading>
            <Text color={textColor} textAlign="justify">
              Nós valorizamos a sua confiança. <strong>Não vendemos, alugamos ou compartilhamos</strong> seus dados pessoais com terceiros para fins de marketing. Seus dados são processados apenas pelo nosso sistema interno (CRM) e acessados estritamente por nossa equipe autorizada.
            </Text>
          </Box>

          <Box w="100%">
            <Heading as="h2" size="md" color={headingColor} mb={3}>
              4. Segurança das Informações
            </Heading>
            <Text color={textColor} textAlign="justify">
              Adotamos as melhores práticas técnicas e administrativas em nossos servidores (armazenados em banco de dados seguro) para proteger seus dados pessoais contra acessos não autorizados, perdas ou alterações.
            </Text>
          </Box>

          <Box w="100%">
            <Heading as="h2" size="md" color={headingColor} mb={3}>
              5. Os seus direitos (LGPD)
            </Heading>
            <Text color={textColor} mb={2}>
              Como titular dos dados, você tem o direito de, a qualquer momento e mediante requisição:
            </Text>
            <UnorderedList color={textColor} pl={5}>
              <ListItem>Acessar os seus dados.</ListItem>
              <ListItem>Corrigir dados incompletos ou desatualizados.</ListItem>
              <ListItem>Solicitar a eliminação dos seus dados da nossa base de contatos.</ListItem>
              <ListItem>Revogar o seu consentimento.</ListItem>
            </UnorderedList>
          </Box>

          <Divider />

          <Text fontSize="sm" color="gray.500" w="100%" textAlign="center">
            Este documento foi criado para garantir a transparência e a segurança no tratamento dos seus dados. Para exercer seus direitos, entre em contato através de nossos canais oficiais.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default PrivacyPolicy;