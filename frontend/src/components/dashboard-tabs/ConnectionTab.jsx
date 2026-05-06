import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Grid, GridItem, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Icon, useColorModeValue, FormControl, FormLabel, Input, Textarea,
  Divider, Switch, Badge
} from '@chakra-ui/react';
import {
  CheckCircleIcon, WarningTwoIcon, EditIcon, ViewIcon
} from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { businessAPI } from '../../services/api';
import SmartLoader from '../SmartLoader';

const ConnectionTab = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  // Local state for editing form
  const [editingHours, setEditingHours] = useState(false);
  const [configForm, setConfigForm] = useState({
    businessName: '',
    operatingHours: { opening: '09:00', closing: '18:00' },
    awayMessage: '',
    socialMedia: { instagram: '', website: '', portfolio: '' }
  });

  // Sync with global state
  useEffect(() => {
    if (state.businessConfig) {
      setConfigForm({
        businessName: state.businessConfig.businessName || '',
        operatingHours: state.businessConfig.operatingHours || { opening: '09:00', closing: '18:00' },
        awayMessage: state.businessConfig.awayMessage || '',
        socialMedia: state.businessConfig.socialMedia || { instagram: '', website: '', portfolio: '' }
      });
    }
  }, [state.businessConfig]);

  // Actions
  const handleStartWhatsApp = async () => {
    try {
      toast({ title: 'Iniciando servidor...', status: 'info', duration: 2000 });
      await businessAPI.startWhatsApp();
    } catch (error) {
      toast({ title: 'Erro ao iniciar', description: error.message, status: 'error' });
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!window.confirm("Tem certeza? O bot vai parar de responder.")) return;
    try {
      await businessAPI.logoutWhatsApp();
      toast({ title: 'Desconectado', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao desconectar', status: 'error' });
    }
  };

  const handleSaveConfig = async () => {
    try {
      const payload = { ...state.businessConfig, ...configForm, __v: state.businessConfig.__v };
      const response = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });
      setEditingHours(false);
      toast({ title: 'Configurações salvas!', status: 'success' });
    } catch (error) {
      if (error.response?.status === 409) {
          toast({ title: 'Conflito de Versão', description: 'As configurações foram modificadas por outro processo. Recarregue a página.', status: 'error', duration: null, isClosable: true });
      } else {
          toast({ title: 'Erro ao salvar', status: 'error' });
      }
    }
  };

  const handleToggleObserverMode = async (e) => {
    const newValue = e.target.checked;
    try {
      // Optimistic update
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: { ...state.businessConfig, aiGlobalDisabled: newValue } });

      const response = await businessAPI.updateConfig({ aiGlobalDisabled: newValue, __v: state.businessConfig.__v });
      // Confirm with server response
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: response.data });

      toast({
        title: newValue ? 'Modo Observador ATIVADO' : 'Modo Observador DESATIVADO',
        description: newValue ? 'A IA não responderá automaticamente.' : 'A IA voltará a responder.',
        status: newValue ? 'warning' : 'success',
        duration: 3000
      });
    } catch (error) {
      if (error.response?.status === 409) {
          toast({ title: 'Conflito de Versão', description: 'As configurações foram modificadas por outro processo. Recarregue a página.', status: 'error', duration: null, isClosable: true });
      }
      console.error(error);
      toast({ title: 'Erro ao atualizar modo', status: 'error' });
    }
  };

  return (
    <Box>
      {/* GLOBAL CONTROLS */}
      <Card bg={cardBg} mb={6} borderLeft="4px solid" borderLeftColor={state.businessConfig?.aiGlobalDisabled ? "orange.400" : "green.400"}>
        <CardBody display="flex" alignItems="center" justifyContent="space-between" flexDirection={{ base: 'column', md: 'row' }} gap={4}>
            <HStack spacing={4}>
                <Box p={3} bg={state.businessConfig?.aiGlobalDisabled ? "orange.100" : "green.100"} borderRadius="full">
                    <Icon as={ViewIcon} boxSize={6} color={state.businessConfig?.aiGlobalDisabled ? "orange.600" : "green.600"} />
                </Box>
                <Box>
                    <Heading size="sm">
                        Modo Observador
                        {state.businessConfig?.aiGlobalDisabled && <Badge ml={2} colorScheme="orange">ATIVO</Badge>}
                    </Heading>
                    <Text fontSize="sm" color="gray.500">
                        Quando ativo, o sistema recebe mensagens e permite envios manuais, mas a IA <b>não responde ninguém automaticamente</b>.
                    </Text>
                </Box>
            </HStack>
            <FormControl display='flex' alignItems='center' w="auto">
                <Switch
                    id='observer-mode'
                    size="lg"
                    colorScheme="orange"
                    isChecked={state.businessConfig?.aiGlobalDisabled || false}
                    onChange={handleToggleObserverMode}
                />
            </FormControl>
        </CardBody>
      </Card>

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
        {/* Card WhatsApp */}
        <GridItem>
          <Card bg={cardBg} h="100%" boxShadow="md" borderTop="4px solid" borderTopColor={state.whatsappStatus.isConnected ? "green.400" : "red.400"}>
            <CardHeader><Heading size="md">Status do WhatsApp</Heading></CardHeader>
            <CardBody display="flex" flexDirection="column" alignItems="center" justifyContent="center">
              {state.whatsappStatus.error ? (
                <VStack spacing={4} textAlign="center" p={4} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
                    <Icon as={WarningTwoIcon} color="red.500" boxSize={12} />
                    <Text fontWeight="bold" color="red.700">Erro de Conexão</Text>
                    <Text color="red.600">{state.whatsappStatus.error}</Text>
                    <Button size="sm" colorScheme="red" variant="outline" onClick={() => window.location.reload()}>Recarregar Página</Button>
                </VStack>
              ) : state.whatsappStatus.isConnected ? (
                <VStack spacing={4}>
                  <Icon as={CheckCircleIcon} color="green.500" boxSize={16} />
                  <Box textAlign="center">
                    <Text fontWeight="bold" fontSize="lg" color="green.600">Sistema Online</Text>
                    <Text fontSize="sm" color="gray.500">O robô está respondendo seus clientes.</Text>
                  </Box>
                  <Button colorScheme="red" variant="outline" onClick={handleLogoutWhatsApp}>Desconectar Sessão</Button>
                </VStack>
              ) : (
                <VStack spacing={4} w="100%">
                  {state.whatsappStatus.qrCode ? (
                    <VStack>
                      <Box bg="white" p={4} borderRadius="lg"><QRCodeSVG value={state.whatsappStatus.qrCode} size={180} /></Box>
                      <Button colorScheme="red" variant="outline" size="sm" onClick={handleLogoutWhatsApp}>Cancelar / Desligar</Button>
                    </VStack>
                  ) : (state.whatsappStatus.mode === 'Iniciando...' || state.whatsappStatus.mode === 'initializing' || state.whatsappStatus.mode === 'authenticating') ? (
                    <SmartLoader />
                  ) : (
                    <VStack py={4}>
                      <Icon as={WarningTwoIcon} color="orange.400" boxSize={12} />
                      <Text fontWeight="bold" color="gray.600">Sessão Desligada</Text>
                      <Button size="lg" colorScheme="green" onClick={handleStartWhatsApp} width="full">Ligar Robô</Button>
                    </VStack>
                  )}
                </VStack>
              )}
            </CardBody>
          </Card>
        </GridItem>
        {/* Card Configs */}
        <GridItem>
          <Card bg={cardBg} h="100%" boxShadow="md">
            <CardHeader>
              <HStack justify="space-between"><Heading size="md">Dados da Empresa</Heading><Button size={{ base: 'md', md: 'xs' }} onClick={() => setEditingHours(!editingHours)} leftIcon={<EditIcon />}>{editingHours ? 'Cancelar' : 'Editar'}</Button></HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">NOME FANTASIA</FormLabel>
                  <Input isDisabled={!editingHours} value={configForm.businessName} onChange={e => setConfigForm({ ...configForm, businessName: e.target.value })} />
                </FormControl>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                  <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">ABERTURA</FormLabel><Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.opening} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, opening: e.target.value } })} size={{ base: 'lg', md: 'md' }} /></FormControl>
                  <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">FECHAMENTO</FormLabel><Input type="time" isDisabled={!editingHours} value={configForm.operatingHours.closing} onChange={e => setConfigForm({ ...configForm, operatingHours: { ...configForm.operatingHours, closing: e.target.value } })} size={{ base: 'lg', md: 'md' }} /></FormControl>
                </Stack>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">MENSAGEM DE AUSÊNCIA</FormLabel>
                  <Textarea isDisabled={!editingHours} value={configForm.awayMessage} onChange={e => setConfigForm({ ...configForm, awayMessage: e.target.value })} rows={3} />
                </FormControl>

                <Divider />

                <Heading size="sm" pt={2} color="gray.600">Links & Redes Sociais</Heading>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">INSTAGRAM</FormLabel>
                  <Input isDisabled={!editingHours} placeholder="@seu_negocio" value={configForm.socialMedia.instagram} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, instagram: e.target.value } })} size={{ base: 'lg', md: 'md' }} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">WEBSITE</FormLabel>
                  <Input isDisabled={!editingHours} placeholder="https://..." value={configForm.socialMedia.website} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, website: e.target.value } })} size={{ base: 'lg', md: 'md' }} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">PORTFOLIO</FormLabel>
                  <Input isDisabled={!editingHours} placeholder="Link externo (Drive, Behance...)" value={configForm.socialMedia.portfolio} onChange={e => setConfigForm({ ...configForm, socialMedia: { ...configForm.socialMedia, portfolio: e.target.value } })} size={{ base: 'lg', md: 'md' }} />
                </FormControl>

                {editingHours && <Button colorScheme="brand" onClick={handleSaveConfig} width="full">Salvar Alterações</Button>}
              </VStack>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Box>
  );
};

export default ConnectionTab;
