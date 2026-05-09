import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Flex, Heading, Text, Button, VStack,
  useToast, useColorModeValue, FormControl, FormLabel, Input,
  Spinner, Center, Card, CardBody, Avatar, Divider, Alert, AlertIcon
} from '@chakra-ui/react';
import { authAPI } from '../services/api';
import { useApp } from '../context/AppContext';

const InvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { dispatch } = useApp();

  const bg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');

  const [isLoading, setIsLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');

  // Form State
  const [isLoginMode, setIsLoginMode] = useState(false); // To handle users that already have an account
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await authAPI.getInvite(token);
        setInvite(response.data.invite);
      } catch (err) {
        setError(err.response?.data?.message || 'Convite inválido ou expirado.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLoginMode) {
        // Handle Login with invite token
        const { data } = await authAPI.login({ email, password, inviteToken: token });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        dispatch({ type: 'SET_USER', payload: data.user });

        toast({ title: 'Login e Convite aceitos!', status: 'success' });
        navigate('/dashboard');
      } else {
        // Handle Register with invite token
        const { data } = await authAPI.register({ name, email, password, inviteToken: token });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        dispatch({ type: 'SET_USER', payload: data.user });

        toast({ title: 'Conta criada e Convite aceito!', status: 'success' });
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.response?.data?.code === 'EMAIL_EXISTS_INVITE') {
        setIsLoginMode(true);
        toast({ title: 'Email já existe', description: 'Por favor, faça login para aceitar o convite.', status: 'info' });
      } else {
        toast({ title: 'Erro', description: err.response?.data?.message || 'Erro ao processar convite.', status: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Center h="100vh" bg={bg}>
        <Spinner size="xl" color="brand.500" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh" bg={bg}>
        <Card p={8} maxW="md" w="full" bg={cardBg} shadow="lg" borderRadius="xl" textAlign="center">
          <Heading size="md" color="red.500" mb={4}>Ops!</Heading>
          <Text mb={6}>{error}</Text>
          <Button colorScheme="brand" onClick={() => navigate('/login')}>Ir para Login</Button>
        </Card>
      </Center>
    );
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg={bg} p={4}>
      <Card maxW="md" w="full" bg={cardBg} shadow="xl" borderRadius="2xl">
        <CardBody p={8}>
          <VStack spacing={6} as="form" onSubmit={handleSubmit}>

            <VStack spacing={2} textAlign="center">
              <Avatar size="xl" name={invite.businessId?.businessName} src={invite.businessId?.avatarUrl} mb={2} />
              <Heading size="lg">Você foi convidado!</Heading>
              <Text color="gray.500">
                Para fazer parte da equipe de <strong>{invite.businessId?.businessName}</strong> como {invite.role === 'admin' ? 'Administrador' : 'Operador'}.
              </Text>
            </VStack>

            <Divider />

            {isLoginMode && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                Faça login para aceitar este convite.
              </Alert>
            )}

            {!isLoginMode && (
              <FormControl isRequired>
                <FormLabel>Nome Completo</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </FormControl>
            )}

            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Senha</FormLabel>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" minLength={6} />
            </FormControl>

            <Button
              type="submit"
              colorScheme="brand"
              size="lg"
              w="full"
              isLoading={isSubmitting}
            >
              {isLoginMode ? 'Entrar e Aceitar Convite' : 'Criar Conta e Aceitar Convite'}
            </Button>

            <Text fontSize="sm" color="gray.500">
              {isLoginMode ? "Não tem uma conta? " : "Já tem uma conta? "}
              <Button variant="link" colorScheme="brand" onClick={() => setIsLoginMode(!isLoginMode)}>
                {isLoginMode ? "Criar conta" : "Fazer Login"}
              </Button>
            </Text>

          </VStack>
        </CardBody>
      </Card>
    </Flex>
  );
};

export default InvitePage;