import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Badge, useColorModeValue, FormControl, FormLabel, Input, Textarea, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, IconButton, Tooltip
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { businessAPI } from '../../services/api';

const QuickRepliesTab = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray200 = useColorModeValue('gray.200', 'gray.600');

  // Modal
  const { isOpen, onOpen, onClose } = useDisclosure();

  // State
  const [menuOptions, setMenuOptions] = useState([]);
  const [newMenuOption, setNewMenuOption] = useState({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false });
  const [editingMenuIndex, setEditingMenuIndex] = useState(null);

  // Sync
  useEffect(() => {
    if (state.businessConfig) {
      setMenuOptions(state.businessConfig.menuOptions || []);
    }
  }, [state.businessConfig]);

  // Handlers
  const handleSaveMenu = async () => {
    try {
      const payload = { ...state.businessConfig, menuOptions, __v: state.businessConfig.__v };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      toast({ title: 'Menu salvo!', status: 'success' });
    } catch (error) {
      if (error.response?.status === 409) {
          toast({ title: 'Conflito de Versão', description: 'As configurações foram modificadas por outro processo. Recarregue a página.', status: 'error', duration: null, isClosable: true });
      } else {
          toast({ title: 'Erro ao salvar menu', status: 'error' });
      }
    }
  };

  const handleEditMenuOption = (idx) => {
    setEditingMenuIndex(idx);
    setNewMenuOption(menuOptions[idx]);
    onOpen();
  };

  const handleSaveMenuOption = () => {
    if (!newMenuOption.keyword || !newMenuOption.response) {
      toast({ title: 'Preencha os campos obrigatórios', status: 'warning' });
      return;
    }
    const updated = [...menuOptions];
    if (editingMenuIndex !== null) updated[editingMenuIndex] = newMenuOption;
    else updated.push(newMenuOption);

    setMenuOptions(updated);
    setEditingMenuIndex(null);
    setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false });
    onClose();
  };

  const handleRemoveMenuOption = (idx) => setMenuOptions(menuOptions.filter((_, i) => i !== idx));

  return (
    <Box>
      <Card bg={cardBg} boxShadow="md">
        <CardHeader>
          <Stack direction={{ base: 'column', md: 'row' }} justify="space-between">
            <Box><Heading size="md">Menu de Respostas</Heading><Text fontSize="sm" color="gray.500">Palavras-chave que o bot responde instantaneamente.</Text></Box>
            <Button leftIcon={<AddIcon />} colorScheme="green" onClick={() => { setEditingMenuIndex(null); setNewMenuOption({ keyword: '', description: '', response: '', requiresHuman: false, useAI: false }); onOpen(); }}>Nova Regra</Button>
          </Stack>
        </CardHeader>
        <CardBody>
          <Grid templateColumns={{ base: '1fr', sm: 'repeat(auto-fill, minmax(250px, 1fr))' }} gap={4}>
            {menuOptions.map((opt, idx) => (
              <Card key={idx} variant="outline" size="sm">
                <CardBody p={3}>
                  <HStack justify="space-between" mb={2}>
                    <Badge colorScheme="purple">{idx + 1}. {opt.keyword.split(',')[0]}</Badge>
                    <HStack spacing={1}>
                      <Tooltip label="Editar regra">
                        <IconButton icon={<EditIcon />} aria-label="Editar regra" size={{ base: 'lg', md: 'xs' }} colorScheme="blue" variant="ghost" onClick={() => handleEditMenuOption(idx)} />
                      </Tooltip>
                      <Tooltip label="Excluir regra">
                        <IconButton icon={<DeleteIcon />} aria-label="Excluir regra" size={{ base: 'lg', md: 'xs' }} colorScheme="red" variant="ghost" onClick={() => handleRemoveMenuOption(idx)} />
                      </Tooltip>
                    </HStack>
                  </HStack>
                  <Text fontWeight="bold" fontSize="xs" mb={1}>{opt.description}</Text>
                  <Text fontSize="xs" color="gray.500" noOfLines={2}>{opt.response}</Text>
                  <HStack mt={2}>
                    {opt.requiresHuman && <Badge colorScheme="orange" fontSize="0.6em">Humano</Badge>}
                    {opt.useAI && <Badge colorScheme="teal" fontSize="0.6em">IA Ativa</Badge>}
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </Grid>
          {menuOptions.length > 0 && <Box mt={6} pt={4} textAlign="right"><Button colorScheme="brand" onClick={handleSaveMenu}>Salvar Alterações do Menu</Button></Box>}
        </CardBody>
      </Card>

      {/* Modal Menu */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingMenuIndex !== null ? 'Editar Regra' : 'Nova Regra'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl><FormLabel fontSize="sm" fontWeight="bold">Descrição Interna</FormLabel><Input placeholder="Descrição de resposta" value={newMenuOption.description} onChange={e => setNewMenuOption({ ...newMenuOption, description: e.target.value })} size={{ base: 'lg', md: 'md' }} /></FormControl>
              <FormControl isRequired><FormLabel fontSize="sm" fontWeight="bold">Palavras-Chave (separadas por vírgula)</FormLabel><Textarea placeholder="pix, pagamento, conta" value={newMenuOption.keyword} onChange={e => setNewMenuOption({ ...newMenuOption, keyword: e.target.value })} rows={2} size={{ base: 'lg', md: 'md' }} /></FormControl>
              <FormControl isRequired><FormLabel fontSize="sm" fontWeight="bold">Resposta Oficial</FormLabel><Textarea placeholder="Chave: 123..." value={newMenuOption.response} onChange={e => setNewMenuOption({ ...newMenuOption, response: e.target.value })} rows={4} size={{ base: 'lg', md: 'md' }} /></FormControl>
              <Box w="100%" bg={gray50Bg} p={3} borderRadius="md" border="1px dashed" borderColor={gray200}>
                <Text fontSize="xs" fontWeight="bold" mb={2}>COMPORTAMENTO</Text>
                <VStack align="start">
                  <Checkbox colorScheme="teal" isChecked={newMenuOption.useAI} onChange={e => setNewMenuOption({ ...newMenuOption, useAI: e.target.checked })}>Usar IA para humanizar ✨</Checkbox>
                  <Checkbox colorScheme="orange" isChecked={newMenuOption.requiresHuman} onChange={e => setNewMenuOption({ ...newMenuOption, requiresHuman: e.target.checked })}>Pausar Bot (Chamar Humano) 🛑</Checkbox>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button><Button colorScheme="brand" onClick={handleSaveMenuOption}>{editingMenuIndex !== null ? 'Salvar' : 'Adicionar'}</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default QuickRepliesTab;
