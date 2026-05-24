import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardHeader, CardBody, Heading, VStack, HStack,
  useToast, useColorModeValue, Table, Thead, Tbody, Tr, Th, Td, Badge,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, FormControl, FormLabel, Input, Button, Spinner, Center, InputGroup, InputLeftElement, IconButton
} from '@chakra-ui/react';
import { AddIcon, SearchIcon } from '@chakra-ui/icons';
import { FaFileImport } from 'react-icons/fa';
import { contactAPI } from '../../services/api';
import TagAutocomplete from '../Tags/TagAutocomplete';
import ImportModal from '../crm/ImportModal';

const ContactTab = () => {
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure();

  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({ name: '', phone: '', tags: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const response = await contactAPI.getContacts();
      setContacts(response.data);
      setFilteredContacts(response.data);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({ title: 'Erro ao buscar contatos', status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = search.toLowerCase();
    const filtered = contacts.filter(c =>
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      c.tags.some(t => t.toLowerCase().includes(term))
    );
    setFilteredContacts(filtered);
  }, [search, contacts]);

  const handleCreateContact = async () => {
    if (!formData.phone) {
      toast({ title: 'O número de telefone é obrigatório', status: 'warning' });
      return;
    }
    try {
      setIsSubmitting(true);
      await contactAPI.createContact(formData);
      toast({ title: 'Contato criado com sucesso!', status: 'success' });
      onClose();
      setFormData({ name: '', phone: '', tags: [] });
      fetchContacts();
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      toast({
        title: 'Erro ao criar contato',
        description: error.response?.data?.message || 'Tente novamente',
        status: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Card bg={cardBg} shadow="sm">
        <CardHeader display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={4}>
          <Heading size="md">Contatos</Heading>
          <HStack>
            <InputGroup size="sm" w={{ base: 'full', md: '250px' }}>
              <InputLeftElement pointerEvents="none" children={<SearchIcon color="gray.400" />} />
              <Input
                placeholder="Buscar contatos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                borderRadius="md"
              />
            </InputGroup>
            <Button size="sm" leftIcon={<FaFileImport />} onClick={onImportOpen}>
              Importar
            </Button>
            <Button size="sm" leftIcon={<AddIcon />} colorScheme="brand" onClick={onOpen}>
              Novo Contato
            </Button>
          </HStack>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <Center p={10}><Spinner size="xl" /></Center>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Nome</Th>
                    <Th>Telefone</Th>
                    <Th>Tags</Th>
                    <Th>Última Interação</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredContacts.map(contact => (
                    <Tr key={contact._id}>
                      <Td fontWeight="medium">{contact.name}</Td>
                      <Td>{contact.phone || '-'}</Td>
                      <Td>
                        {contact.tags.map(tag => (
                          <Badge key={tag} mr={1} mb={1} colorScheme="brand" variant="subtle">
                            {tag}
                          </Badge>
                        ))}
                      </Td>
                      <Td>{new Date(contact.lastInteraction).toLocaleDateString('pt-BR')}</Td>
                    </Tr>
                  ))}
                  {filteredContacts.length === 0 && (
                    <Tr>
                      <Td colSpan={4} textAlign="center" py={4} color="gray.500">
                        Nenhum contato encontrado.
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Novo Contato</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nome</FormLabel>
                <Input
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Telefone (WhatsApp)</FormLabel>
                <Input
                  placeholder="Ex: 5511999999999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Etiquetas (Tags)</FormLabel>
                <TagAutocomplete
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                  placeholder="Selecione ou crie tags..."
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={handleCreateContact} isLoading={isSubmitting}>
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Import Modal */}
      {isImportOpen && (
        <ImportModal
          isOpen={isImportOpen}
          onClose={() => {
            onImportClose();
            fetchContacts();
          }}
        />
      )}
    </Box>
  );
};

export default ContactTab;
