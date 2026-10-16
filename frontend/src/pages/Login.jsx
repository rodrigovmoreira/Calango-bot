import React from 'react';
import {
  Box, Container, Button, Text, VStack, Heading, Card, CardBody,
  useColorModeValue, Flex, Image
} from '@chakra-ui/react';
import { FaShieldAlt } from 'react-icons/fa';
import ColorModeToggle from '../components/ColorModeToggle';

// URL do Squamata-Login (Identity Provider / SSO).
// ATENÇÃO: usa a porta HOST do Squamata-Login Frontend (5174), não a do backend.
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';

// Slug desta aplicação no ecossistema (usado para o Squamata rotear o retorno).
const APP_SLUG = 'calango-bot';

const Login = () => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const headingColor = useColorModeValue('brand.600', 'brand.200');
  const rightPanelBg = useColorModeValue('gray.50', 'gray.900');

  // Redireciona o usuário ao portal central de autenticação (Squamata-Login).
  const handleSSOLogin = () => {
    window.location.href = `${LOGIN_URL}/login?appSlug=${APP_SLUG}&tenantId=default`;
  };

  return (
    <Flex minH="100vh" direction={{ base: 'column', md: 'row' }}>
      {/* Left Panel - Brand */}
      <Flex
        flex={1}
        bgGradient="linear(to-br, green.500 48%, purple.500)"
        justify="center"
        align="center"
        direction="column"
        p={8}
        color="white"
      >
        <VStack spacing={6}>
          <Image src="/Gemini_Generated_Image_467xu7467xu7467x.svg" alt="Calango Bot Logo" boxSize="150px" />
          <Heading size="2xl" fontWeight="bold">Calango Bot</Heading>
          <Text fontSize="xl" opacity={0.9}>Automação Inteligente Para seu Chat</Text>
        </VStack>
      </Flex>

      {/* Right Panel - SSO Login */}
      <Flex
        flex={1}
        bg={rightPanelBg}
        justify="center"
        align="center"
        position="relative"
        p={4}
      >
        <ColorModeToggle position="absolute" top={4} right={4} />

        <Container maxW="md">
          <VStack spacing={8} w="full">
            <Card w="full" borderRadius="xl" boxShadow="xl" bg={cardBg}>
              <CardBody p={10}>
                <VStack spacing={6}>
                  <Box bg="brand.500" p={5} borderRadius="full">
                    <FaShieldAlt size={44} color="white" />
                  </Box>

                  <Heading size="lg" color={headingColor} textAlign="center">
                    Bem-vindo
                  </Heading>

                  <Text color="gray.500" textAlign="center" fontSize="md">
                    Autenticação centralizada da Calango, Inc.
                  </Text>

                  <Button
                    size="lg"
                    colorScheme="brand"
                    w="full"
                    onClick={handleSSOLogin}
                    leftIcon={<FaShieldAlt />}
                  >
                    Entrar com a Conta Central
                  </Button>

                  <Text fontSize="xs" color="gray.400" textAlign="center">
                    Autenticação gerenciada pelo Squamata Identity.
                    <br />
                    Use suas credenciais centralizadas da Calango, Inc.
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </Container>
      </Flex>
    </Flex>
  );
};

export default Login;
