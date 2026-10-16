import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Flex, Spinner, Text, VStack } from '@chakra-ui/react';

// URL do Squamata-Login (Identity Provider / SSO).
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || 'http://localhost:5174';

// Slug desta aplicação no ecossistema.
const APP_SLUG = 'calango-bot';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  // Ref para segurar o impacto do React Strict Mode (evita processar o token 2x).
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Se já processou nesta montagem, aborta para não gerar loop.
    if (hasProcessed.current) return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userStr = params.get('user');

    if (token && userStr) {
      hasProcessed.current = true; // Marca como capturado.
      try {
        const user = JSON.parse(decodeURIComponent(userStr));

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        if (user.tenantId) {
          localStorage.setItem('tenantId', user.tenantId);
        }

        dispatch({ type: 'SET_USER', payload: user });

        // Redirecionamento seguro para a dashboard (limpa o token da URL).
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Erro ao processar dados de autenticação SSO:', err);
        window.location.href = `${LOGIN_URL}/login?appSlug=${APP_SLUG}&error=true`;
      }
    } else {
      // SALVA-VIDAS: se não há token na URL, verifica se já salvamos no localStorage.
      const existingToken = localStorage.getItem('token');
      if (!existingToken) {
        console.warn('AuthCallback acessado sem token. Devolvendo ao Squamata...');
        window.location.href = `${LOGIN_URL}/login?appSlug=${APP_SLUG}`;
      } else {
        // Token sumiu da URL (Strict Mode), mas está no localStorage: segue para a dashboard.
        navigate('/dashboard', { replace: true });
      }
    }
  }, [navigate, dispatch]);

  return (
    <Flex h="100vh" w="100vw" justify="center" align="center" bg="gray.50">
      <VStack spacing={4}>
        <Spinner size="xl" color="brand.500" thickness="4px" />
        <Text fontSize="lg" color="gray.600">
          Autenticando sessão com o Identity...
        </Text>
      </VStack>
    </Flex>
  );
};

export default AuthCallback;
