import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardHeader, CardBody, Heading, Text, Button, VStack,
  useToast, useColorModeValue, Table, Thead, Tbody, Tr, Th, Td, Badge,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, FormControl, FormLabel, Select, Input, InputGroup, InputRightElement, IconButton,
  Spinner, Center
} from '@chakra-ui/react';
import { AddIcon, CopyIcon } from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { authAPI, businessAPI } from '../../services/api';

const TeamTab = () => {
  const { state } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [role, setRole] = useState('operator');
  const [inviteLink, setInviteLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setIsLoading(true);
        const response = await businessAPI.getTeam();
        setMembers(response.data);
      } catch (error) {
        console.error('Erro ao buscar equipe:', error);
        toast({ title: 'Erro ao buscar equipe', status: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    if (state.user?.activeBusinessId) {
      fetchTeam();
    }
  }, [state.user?.activeBusinessId, toast]);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setInviteLink('');
    try {
      const response = await authAPI.createInvite({ role });
      const token = response.data.token;
      const link = `${window.location.origin}/invite/${token}`;
      setInviteLink(link);
      toast({ title: 'Convite gerado com sucesso!', status: 'success' });
    } catch (error) {
      console.error('Error generating invite:', error);
      toast({ title: 'Erro ao gerar convite', description: error.response?.data?.message || 'Tente novamente.', status: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({ title: 'Link copiado!', status: 'info' });
  };

  const closeModal = () => {
    onClose();
    setInviteLink('');
    setRole('operator');
  };

  const isAdmin = state.user?.businesses?.find(b => {
    const id = b.businessId?._id || b.businessId;
    return id === state.user?.activeBusinessId;
  })?.role === 'admin';

  if (isLoading) {
    return (
      <Center p={10}>
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box>
      <Card bg={cardBg} shadow="sm">
        <CardHeader display="flex" justifyContent="space-between" alignItems="center">
          <Heading size="md">Equipe</Heading>
          {isAdmin && (
            <Button leftIcon={<AddIcon />} colorScheme="brand" onClick={onOpen}>
              Convidar Membro
            </Button>
          )}
        </CardHeader>
        <CardBody>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Email</Th>
                <Th>Cargo</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {members.map(member => (
                <Tr key={member.id}>
                  <Td fontWeight="medium">
                    {member.name} {member.isMe && <Badge ml={2} colorScheme="green">Você</Badge>}
                  </Td>
                  <Td>{member.email}</Td>
                  <Td>
                    <Badge colorScheme={member.role === 'admin' ? 'purple' : 'blue'}>
                      {member.role === 'admin' ? 'Administrador' : 'Operador'}
                    </Badge>
                  </Td>
                  <Td>Ativo</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {members.length === 0 && (
             <Text mt={4} color="gray.500" textAlign="center">Nenhum membro encontrado.</Text>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={closeModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Convidar Membro</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text fontSize="sm" color="gray.600">
                Gere um link de convite para que um novo membro entre no seu negócio.
              </Text>
              <FormControl>
                <FormLabel>Papel (Nível de Acesso)</FormLabel>
                <Select value={role} onChange={(e) => setRole(e.target.value)} isDisabled={isGenerating || inviteLink}>
                  <option value="operator">Operador (Atendimento, Visualização)</option>
                  <option value="admin">Administrador (Acesso Total)</option>
                </Select>
              </FormControl>

              {inviteLink && (
                <FormControl mt={4}>
                  <FormLabel>Link de Convite</FormLabel>
                  <InputGroup size="md">
                    <Input pr="4.5rem" value={inviteLink} readOnly />
                    <InputRightElement width="4.5rem">
                      <IconButton h="1.75rem" size="sm" icon={<CopyIcon />} onClick={copyToClipboard} aria-label="Copiar link" />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            {!inviteLink ? (
              <Button colorScheme="brand" onClick={handleGenerateLink} isLoading={isGenerating} width="100%">
                Gerar Link
              </Button>
            ) : (
              <Button onClick={closeModal} width="100%">
                Concluído
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TeamTab;