import React, { useState } from 'react';
import {
  Box,  Container,  Tabs,  TabList,  TabPanels,  Tab,  TabPanel,  FormControl,  FormLabel,  Input,
  InputGroup,  InputRightElement,  IconButton,  Button,  Text, useToast,  VStack,  Heading,  Card,
  CardBody,  Alert,  AlertIcon,  useColorModeValue,  Flex,  Image
} from '@chakra-ui/react';
import { authAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { FcGoogle } from 'react-icons/fc';
import ColorModeToggle from '../components/ColorModeToggle';

const Login = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { dispatch } = useApp();
  const toast = useToast();

  const cardBg = useColorModeValue('white', 'gray.800');
  const headingColor = useColorModeValue('brand.600', 'brand.200');
  const rightPanelBg = useColorModeValue('gray.50', 'gray.900');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  const handleAuthSuccess = (response) => {
    const { token, user } = response.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    dispatch({ type: 'SET_USER', payload: user });
    
    toast({
      title: 'Sucesso!',
      description: `Bem-vindo, ${user.name}!`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    
    window.location.href = '/dashboard';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      const response = await authAPI.login(data);
      handleAuthSuccess(response);
    } catch (error) {
      console.error("Erro Login:", error);
      const msg = error.response?.data?.message || 'Erro de conexão com o servidor';
      setError(msg);
      
      toast({
        title: 'Erro no Login',
        description: msg,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const name = formData.get('name');

    // Strict Email Validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um endereço de email válido.');
      setLoading(false);
      return;
    }

    // Password Match Validation
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    const data = {
      name,
      email,
      password
    };

    try {
      const response = await authAPI.register(data);
      handleAuthSuccess(response);
    } catch (error) {
      setError(error.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
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

      {/* Right Panel - Login Form */}
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
              {/* Mobile Logo (visible only on base) */}
              <Box display={{ base: 'block', md: 'none' }} mb={4}></Box>

              <Card w="full" borderRadius="xl" boxShadow="xl" bg={cardBg}>
                <CardBody p={8}>
                    <VStack spacing={6}>
                        <Heading size="lg" color={headingColor} textAlign="center">
                            Bem-vindo
                        </Heading>
                        
                        {error && (
                            <Alert status="error" borderRadius="md">
                            <AlertIcon />
                            {error}
                            </Alert>
                        )}

                        <Tabs
                            index={activeTab}
                            onChange={setActiveTab}
                            variant="enclosed-colored"
                            colorScheme="brand"
                            width="100%"
                        >
                            <TabList>
                            <Tab flex={1} fontWeight="semibold">Login</Tab>
                            <Tab flex={1} fontWeight="semibold">Cadastro</Tab>
                            </TabList>

                            <TabPanels>
                                {/* Login Tab */}
                                <TabPanel px={0}>
                                    <VStack spacing={4}>
                                    <Button
                                        w="full"
                                        variant="outline"
                                        leftIcon={<FcGoogle />}
                                        onClick={() => window.location.href = `${API_URL}/api/auth/google`}
                                    >
                                        Continuar com Google
                                    </Button>

                                    <Text fontSize="sm" color="gray.500">ou</Text>

                                    <form onSubmit={handleLogin} style={{ width: '100%' }}>
                                        <VStack spacing={4}>
                                        <FormControl isRequired>
                                            <FormLabel>Email</FormLabel>
                                            <Input
                                            name="email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            size="lg"
                                            />
                                        </FormControl>

                                        <FormControl isRequired>
                                            <FormLabel>Senha</FormLabel>
                                            <InputGroup size="lg">
                                            <Input
                                                name="password"
                                                type={showLoginPassword ? 'text' : 'password'}
                                                placeholder="Sua senha"
                                            />
                                            <InputRightElement width="4.5rem">
                                                <IconButton
                                                h="1.75rem"
                                                size="sm"
                                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                                icon={showLoginPassword ? <ViewOffIcon /> : <ViewIcon />}
                                                aria-label={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
                                                variant="ghost"
                                                />
                                            </InputRightElement>
                                            </InputGroup>
                                        </FormControl>

                                        <Button
                                            type="submit"
                                            colorScheme="brand"
                                            size="lg"
                                            width="100%"
                                            isLoading={loading}
                                            loadingText="Entrando..."
                                        >
                                            Entrar
                                        </Button>
                                        </VStack>
                                    </form>
                                    </VStack>
                                </TabPanel>

                                {/* Register Tab */}
                                <TabPanel px={0}>
                                    <VStack spacing={4}>
                                    <Button
                                        w="full"
                                        variant="outline"
                                        leftIcon={<FcGoogle />}
                                        onClick={() => window.location.href = `${API_URL}/api/auth/google`}
                                    >
                                        Continuar com Google
                                    </Button>

                                    <Text fontSize="sm" color="gray.500">ou</Text>

                                    <form onSubmit={handleRegister} style={{ width: '100%' }}>
                                        <VStack spacing={4}>
                                        <FormControl isRequired>
                                            <FormLabel>Nome completo</FormLabel>
                                            <Input
                                            name="name"
                                            type="text"
                                            placeholder="Seu nome completo"
                                            size="lg"
                                            />
                                        </FormControl>

                                        <FormControl isRequired>
                                            <FormLabel>Email</FormLabel>
                                            <Input
                                            name="email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            size="lg"
                                            />
                                        </FormControl>

                                        <FormControl isRequired>
                                            <FormLabel>Senha</FormLabel>
                                            <InputGroup size="lg">
                                            <Input
                                                name="password"
                                                type={showRegisterPassword ? 'text' : 'password'}
                                                placeholder="Mínimo 6 caracteres"
                                            />
                                            <InputRightElement width="4.5rem">
                                                <IconButton
                                                h="1.75rem"
                                                size="sm"
                                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                                icon={showRegisterPassword ? <ViewOffIcon /> : <ViewIcon />}
                                                aria-label={showRegisterPassword ? 'Ocultar senha' : 'Exibir senha'}
                                                variant="ghost"
                                                />
                                            </InputRightElement>
                                            </InputGroup>
                                        </FormControl>

                                        <FormControl isRequired>
                                            <FormLabel>Confirmar Senha</FormLabel>
                                            <InputGroup size="lg">
                                            <Input
                                                name="confirmPassword"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="Confirme sua senha"
                                            />
                                            <InputRightElement width="4.5rem">
                                                <IconButton
                                                h="1.75rem"
                                                size="sm"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                icon={showConfirmPassword ? <ViewOffIcon /> : <ViewIcon />}
                                                aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                                                variant="ghost"
                                                />
                                            </InputRightElement>
                                            </InputGroup>
                                        </FormControl>

                                        <Button
                                            type="submit"
                                            colorScheme="brand"
                                            size="lg"
                                            width="100%"
                                            isLoading={loading}
                                            loadingText="Cadastrando..."
                                        >
                                            Criar Conta
                                        </Button>
                                        </VStack>
                                    </form>
                                    </VStack>
                                </TabPanel>
                            </TabPanels>
                        </Tabs>

                        <Text fontSize="sm" color={useColorModeValue("gray.600", "gray.300")} textAlign="center">
                            Sistema de atendimento automatizado
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