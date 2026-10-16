import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Flex, Heading, Text, Button, VStack,
  useColorModeValue, Card, CardBody, Avatar, Divider, Alert, AlertIcon, Spinner, Center
} from '@chakra-ui/react';
import { FaShieldAlt } from 'react-icons/fa';
import { authAPI } from '../services/api';

// URL do Squamata-Login (Identity Provider / SSO).
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';
const APP_SLUG = 'calango-bot';

// Guardamos o token do convite para ser aceito após o login SSO (o IdP não
// propaga parâmetros extras de volta, então persistimos localmente).
const PENDING_INVITE_KEY = 'pending_invite_token';

const InvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const bg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');

  const [isLoading, setIsLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await authAPI.getInvite(token);
        setInvite(response.data.invite);
        // Persiste o convite para ser aceito no retorno do SSO.
        localStorage.setItem(PENDING_INVITE_KEY, token);
      } catch (err) {
        setError(err.response?.data?.message || 'Convite inválido ou expirado.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  // Redireciona ao portal central (Squamata-Login). O convite será aceito
  // automaticamente no AuthCallback após o retorno.
  const handleAccept = () => {
    window.location.href = `${LOGIN_URL}/login?appSlug=${APP_SLUG}&tenantId=default`;
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
          <VStack spacing={6}>

            <VStack spacing={2} textAlign="center">
              <Avatar size="xl" name={invite.businessId?.businessName} src={invite.businessId?.avatarUrl} mb={2} />
              <Heading size="lg">Você foi convidado!</Heading>
              <Text color="gray.500">
                Para fazer parte da equipe de <strong>{invite.businessId?.businessName}</strong> como{' '}
                {invite.role === 'admin' ? 'Administrador' : 'Operador'}.
              </Text>
            </VStack>

            <Divider />

            <Alert status="info" borderRadius="md">
              <AlertIcon />
              Faça login com sua conta central para aceitar este convite.
            </Alert>

            <Button
              colorScheme="brand"
              size="lg"
              w="full"
              leftIcon={<FaShieldAlt />}
              onClick={handleAccept}
            >
              Entrar e Aceitar Convite
            </Button>

            <Text fontSize="xs" color="gray.400" textAlign="center">
              Autenticação gerenciada pelo Squamata Identity.
            </Text>

          </VStack>
        </CardBody>
      </Card>
    </Flex>
  );
};

export default InvitePage;
