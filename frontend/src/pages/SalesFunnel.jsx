import React, { useState, useEffect } from 'react';
import { Box, Button, Center, Heading, Text, useDisclosure, useToast, Spinner, Flex } from '@chakra-ui/react';
import { SettingsIcon } from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { businessAPI, tagAPI } from '../services/api';
import FunnelConfigModal from '../components/funnel/FunnelConfigModal';
import FunnelBoard from '../components/funnel/FunnelBoard';

const SalesFunnel = () => {
  const { state, dispatch } = useApp();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]); // <--- New state for Tags
  const [loading, setLoading] = useState(true);

  const businessConfig = state.businessConfig || {};
  const funnelSteps = businessConfig.funnelSteps || [];
  // const availableTags = businessConfig.availableTags || []; // DEPRECATED

  // Fetch Tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data } = await tagAPI.getAll();
        setTags(data);
      } catch (error) {
        console.error("Error fetching tags:", error);
      }
    };
    fetchTags();
  }, []);

  // Fetch Contacts on Mount
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const { data } = await businessAPI.getContacts();
        setContacts(data);
      } catch (error) {
        console.error("Error fetching contacts:", error);
        toast({ title: 'Erro ao carregar contatos', status: 'error' });
      } finally {
        setLoading(false);
      }
    };

    if (funnelSteps.length > 0) {
        fetchContacts();
    } else {
        setLoading(false);
    }
  }, [funnelSteps.length, toast]);

  const handleSaveConfig = async (newSteps) => {
    try {
      const { data } = await businessAPI.updateConfig({
        funnelSteps: newSteps,
        __v: state.businessConfig.__v
      });

      // Update Context
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: data });
      // Reload contacts not needed really unless tags changed drastically,
      // but re-render will happen automatically due to context update

    } catch (error) {
      console.error('Error saving funnel config:', error);
      if (error.response?.status === 409) {
          toast({ title: 'Conflito de Versão', description: 'As configurações foram modificadas por outro processo. Recarregue a página.', status: 'error', duration: null, isClosable: true });
      }
      throw error;
    }
  };

  const handleUpdateStep = async (tag, updates) => {
    // 1. Update Local State
    const newSteps = funnelSteps.map(step =>
        step.tag === tag ? { ...step, ...updates } : step
    );

    // 2. Save to Backend
    try {
        await handleSaveConfig(newSteps);
    } catch (error) {
        toast({ title: 'Erro ao salvar prompt', status: 'error' });
    }
  };

  if (funnelSteps.length === 0) {
    return (
      <Box p={8} bg="white" borderRadius="lg" boxShadow="sm" minH="500px">
        <Center h="100%" flexDirection="column">
          <Heading size="lg" mb={4} color="gray.600">Seu Funil de Vendas está vazio</Heading>
          <Text color="gray.500" mb={8} maxW="md" textAlign="center">
             Organize seus contatos em etapas (colunas) baseadas em Tags.
             Acompanhe o progresso de "Novo Lead" até "Venda Realizada".
          </Text>
          <Button
            leftIcon={<SettingsIcon />}
            colorScheme="brand"
            size="lg"
            onClick={onOpen}
          >
            Configurar meu Funil
          </Button>
        </Center>

        <FunnelConfigModal
          isOpen={isOpen}
          onClose={onClose}
          availableTags={tags} // Pass Tag Objects
          initialSteps={funnelSteps}
          onSave={handleSaveConfig}
        />
      </Box>
    );
  }

  return (
    <Box h="calc(100vh - 100px)" display="flex" flexDirection="column">
      <Flex mb={4} justify="space-between" align="center">
        <Heading size="md">Funil de Vendas</Heading>
        <Button size="sm" leftIcon={<SettingsIcon />} onClick={onOpen}>
          Configurar Etapas
        </Button>
      </Flex>

      <Box flex="1" overflow="hidden">
        {loading ? (
            <Center h="full">
                <Spinner size="xl" color="brand.500" />
            </Center>
        ) : (
            <FunnelBoard
                columns={funnelSteps}
                contacts={contacts}
                onUpdateStep={handleUpdateStep}
            />
        )}
      </Box>

      <FunnelConfigModal
        isOpen={isOpen}
        onClose={onClose}
        availableTags={tags} // Pass Tag Objects
        initialSteps={funnelSteps}
        onSave={handleSaveConfig}
      />
    </Box>
  );
};

export default SalesFunnel;
