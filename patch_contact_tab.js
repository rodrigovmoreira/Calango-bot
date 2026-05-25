const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/dashboard-tabs/ContactTab.jsx', 'utf8');

// Vou substituir o componente inteiro para aplicar a refatoração.
// Não consigo fazer regex limpo devido à quantidade de mudanças (paginação, checkbox, ordenação, etc).

const newCode = `import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Card, CardHeader, CardBody, Heading, VStack, HStack,
  useToast, useColorModeValue, Table, Thead, Tbody, Tr, Th, Td, Badge,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, FormControl, FormLabel, Input, Button, Spinner, Center, InputGroup, InputLeftElement, IconButton,
  Checkbox, Tooltip, Text, AlertDialog, AlertDialogBody, AlertDialogFooter,
  AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Wrap, WrapItem
} from '@chakra-ui/react';
import { AddIcon, SearchIcon, EditIcon, DeleteIcon, CheckIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FaFileImport, FaTrash, FaTags } from 'react-icons/fa';
import { businessAPI } from '../../services/api';
import TagAutocomplete from '../Tags/TagAutocomplete';
import ImportModal from '../crm/ImportModal';

const ContactTab = () => {
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  // Disclosures
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure();
  const { isOpen: isDeleteAlertOpen, onOpen: onDeleteAlertOpen, onClose: onDeleteAlertClose } = useDisclosure();
  const { isOpen: isBulkTagsOpen, onOpen: onBulkTagsOpen, onClose: onBulkTagsClose } = useDisclosure();

  // Data State
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sortConfig, setSortConfig] = useState({ key: 'lastInteraction', direction: 'desc' });

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkTags, setBulkTags] = useState([]);
  const [contactToDelete, setContactToDelete] = useState(null); // null means bulk delete
  const cancelRef = React.useRef();

  // Inline Editing State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Create Form State
  const [formData, setFormData] = useState({ name: '', phone: '', tags: [], notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const response = await businessAPI.getContacts();
      setContacts(response.data);
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

  // Filter & Sort Logic
  const processedContacts = useMemo(() => {
    let result = contacts;

    // Filter
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        c.tags?.some(t => t.toLowerCase().includes(term)) ||
        c.notes?.toLowerCase().includes(term)
      );
    }

    // Sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let valA = a[sortConfig.key] || '';
        let valB = b[sortConfig.key] || '';

        if (sortConfig.key === 'lastInteraction') {
          valA = new Date(valA).getTime() || 0;
          valB = new Date(valB).getTime() || 0;
        } else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [contacts, search, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(processedContacts.length / itemsPerPage) || 1;
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedContacts.slice(start, start + itemsPerPage);
  }, [processedContacts, currentPage]);

  useEffect(() => {
    // Reset to page 1 if search changes
    setCurrentPage(1);
    setSelectedIds([]); // Clear selection on search
  }, [search]);

  // Handlers
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const pageIds = paginatedContacts.map(c => c._id);
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    } else {
      const pageIds = paginatedContacts.map(c => c._id);
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const isAllPageSelected = paginatedContacts.length > 0 && paginatedContacts.every(c => selectedIds.includes(c._id));

  const handleCreateContact = async () => {
    if (!formData.phone) {
      toast({ title: 'O número de telefone é obrigatório', status: 'warning' });
      return;
    }
    try {
      setIsSubmitting(true);
      await businessAPI.createContact(formData);
      toast({ title: 'Contato criado com sucesso!', status: 'success' });
      onClose();
      setFormData({ name: '', phone: '', tags: [], notes: '' });
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

  // Inline Edit
  const startEditing = (contact) => {
    setEditingId(contact._id);
    setEditFormData({
      name: contact.name || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      tags: contact.tags || [],
      __v: contact.__v
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const saveEditing = async (id) => {
    if (!editFormData.phone) {
      toast({ title: 'O telefone é obrigatório', status: 'error' });
      return;
    }
    try {
      await businessAPI.updateContact(id, editFormData);
      toast({ title: 'Contato atualizado', status: 'success', duration: 2000 });
      setEditingId(null);
      fetchContacts();
    } catch (error) {
      console.error('Erro ao atualizar', error);
      toast({ title: 'Erro ao atualizar', status: 'error' });
    }
  };

  // Deletions
  const confirmDelete = (id = null) => {
    setContactToDelete(id);
    onDeleteAlertOpen();
  };

  const handleDelete = async () => {
    try {
      if (contactToDelete) {
        // Unit delete
        await businessAPI.deleteContact(contactToDelete);
        toast({ title: 'Contato excluído', status: 'success' });
      } else {
        // Bulk delete
        await businessAPI.bulkDeleteContacts(selectedIds);
        toast({ title: 'Contatos excluídos', status: 'success' });
        setSelectedIds([]);
      }
      fetchContacts();
    } catch (error) {
      console.error('Erro ao excluir', error);
      toast({ title: 'Erro ao excluir', status: 'error' });
    } finally {
      onDeleteAlertClose();
    }
  };

  // Bulk Tags
  const handleBulkTags = async () => {
    if (bulkTags.length === 0) return;
    try {
      await businessAPI.bulkAddTags(selectedIds, bulkTags);
      toast({ title: 'Tags adicionadas', status: 'success' });
      setBulkTags([]);
      setSelectedIds([]);
      onBulkTagsClose();
      fetchContacts();
    } catch (error) {
      console.error('Erro ao adicionar tags', error);
      toast({ title: 'Erro ao adicionar tags', status: 'error' });
    }
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />;
  };

  return (
    <Box>
      <Card bg={cardBg} shadow="sm">
        <CardHeader display="flex" flexDirection="column" gap={4}>
          <HStack justifyContent="space-between" w="full" flexWrap="wrap" gap={4}>
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
          </HStack>

          {/* Bulk Actions Bar */}
          {selectedIds.length > 0 && (
            <HStack bg="blue.50" p={2} borderRadius="md" w="full" justifyContent="space-between">
              <Text fontSize="sm" fontWeight="bold" color="blue.700">
                {selectedIds.length} selecionado(s)
              </Text>
              <HStack>
                <Button size="sm" colorScheme="blue" leftIcon={<FaTags />} onClick={onBulkTagsOpen}>
                  Tags em Massa
                </Button>
                <Button size="sm" colorScheme="red" leftIcon={<FaTrash />} onClick={() => confirmDelete(null)}>
                  Excluir Selecionados
                </Button>
              </HStack>
            </HStack>
          )}
        </CardHeader>
        <CardBody pt={0}>
          {isLoading ? (
            <Center p={10}><Spinner size="xl" /></Center>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th w="40px">
                      <Checkbox
                        isChecked={isAllPageSelected}
                        onChange={handleSelectAll}
                        colorScheme="brand"
                      />
                    </Th>
                    <Th cursor="pointer" onClick={() => handleSort('name')}>
                      Nome {renderSortIcon('name')}
                    </Th>
                    <Th cursor="pointer" onClick={() => handleSort('phone')}>
                      Telefone {renderSortIcon('phone')}
                    </Th>
                    <Th>Tags</Th>
                    <Th w="200px">Observações</Th>
                    <Th cursor="pointer" onClick={() => handleSort('lastInteraction')}>
                      Última Interação {renderSortIcon('lastInteraction')}
                    </Th>
                    <Th textAlign="right">Ações</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedContacts.map(contact => {
                    const isEditing = editingId === contact._id;
                    const isSelected = selectedIds.includes(contact._id);

                    return (
                      <Tr key={contact._id} bg={isSelected ? 'blue.50' : 'transparent'}>
                        <Td>
                          <Checkbox
                            isChecked={isSelected}
                            onChange={(e) => handleSelectOne(contact._id, e.target.checked)}
                            colorScheme="brand"
                          />
                        </Td>

                        {/* Nome */}
                        <Td>
                          {isEditing ? (
                            <Input
                              size="sm"
                              value={editFormData.name}
                              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            />
                          ) : (
                            <Text fontWeight="medium">{contact.name}</Text>
                          )}
                        </Td>

                        {/* Telefone */}
                        <Td>
                          {isEditing ? (
                            <Input
                              size="sm"
                              value={editFormData.phone}
                              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value.replace(/\\D/g, '') })}
                            />
                          ) : (
                            <Text>{contact.phone || '-'}</Text>
                          )}
                        </Td>

                        {/* Tags */}
                        <Td>
                          {isEditing ? (
                            <TagAutocomplete
                              selectedTags={editFormData.tags}
                              existingTags={editFormData.tags}
                              onChange={(tagName) => setEditFormData({ ...editFormData, tags: [...editFormData.tags, tagName] })}
                              onSelect={(tagName) => {
                                if(!editFormData.tags.includes(tagName)){
                                  setEditFormData({ ...editFormData, tags: [...editFormData.tags, tagName] });
                                }
                              }}
                              placeholder="Add tag"
                            />
                          ) : (
                            <Wrap>
                              {contact.tags?.map(tag => (
                                <WrapItem key={tag}>
                                  <Badge mr={1} mb={1} colorScheme="brand" variant="subtle">
                                    {tag}
                                  </Badge>
                                </WrapItem>
                              ))}
                            </Wrap>
                          )}
                          {/* We need a way to remove tags in edit mode, so I will render them with a close button if editing */}
                          {isEditing && (
                            <Wrap mt={1}>
                              {editFormData.tags.map(tag => (
                                <WrapItem key={tag}>
                                  <Badge mr={1} mb={1} colorScheme="brand" variant="solid" display="flex" alignItems="center">
                                    {tag}
                                    <CloseIcon ml={1} w={2} h={2} cursor="pointer" onClick={() => {
                                      setEditFormData({...editFormData, tags: editFormData.tags.filter(t => t !== tag)});
                                    }}/>
                                  </Badge>
                                </WrapItem>
                              ))}
                            </Wrap>
                          )}
                        </Td>

                        {/* Observações */}
                        <Td maxW="200px">
                          {isEditing ? (
                            <Input
                              size="sm"
                              value={editFormData.notes}
                              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                              placeholder="Obs..."
                            />
                          ) : (
                            <Tooltip label={contact.notes || ''} isDisabled={!contact.notes}>
                              <Text isTruncated noOfLines={1} fontSize="sm">
                                {contact.notes || '-'}
                              </Text>
                            </Tooltip>
                          )}
                        </Td>

                        {/* Última Interação */}
                        <Td>
                          {new Date(contact.lastInteraction).toLocaleDateString('pt-BR')}
                        </Td>

                        {/* Ações */}
                        <Td textAlign="right">
                          {isEditing ? (
                            <HStack justifyContent="flex-end">
                              <IconButton size="xs" icon={<CheckIcon />} colorScheme="green" onClick={() => saveEditing(contact._id)} />
                              <IconButton size="xs" icon={<CloseIcon />} colorScheme="gray" onClick={cancelEditing} />
                            </HStack>
                          ) : (
                            <HStack justifyContent="flex-end">
                              <IconButton size="xs" icon={<EditIcon />} variant="ghost" onClick={() => startEditing(contact)} />
                              <IconButton size="xs" icon={<DeleteIcon />} colorScheme="red" variant="ghost" onClick={() => confirmDelete(contact._id)} />
                            </HStack>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                  {paginatedContacts.length === 0 && (
                    <Tr>
                      <Td colSpan={7} textAlign="center" py={4} color="gray.500">
                        Nenhum contato encontrado.
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <HStack justifyContent="center" mt={4} pb={2}>
                  <Button size="xs" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} isDisabled={currentPage === 1}>
                    Anterior
                  </Button>
                  <Text fontSize="sm">
                    Página {currentPage} de {totalPages}
                  </Text>
                  <Button size="xs" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} isDisabled={currentPage === totalPages}>
                    Próxima
                  </Button>
                </HStack>
              )}
            </Box>
          )}
        </CardBody>
      </Card>

      {/* Create Contact Modal */}
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
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\\D/g, '') })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Observações</FormLabel>
                <Input
                  placeholder="Anotações sobre o cliente..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Etiquetas (Tags)</FormLabel>
                <TagAutocomplete
                  selectedTags={formData.tags}
                  existingTags={formData.tags}
                  onSelect={(tagName) => {
                    if(!formData.tags.includes(tagName)){
                      setFormData({ ...formData, tags: [...formData.tags, tagName] });
                    }
                  }}
                  placeholder="Selecione ou crie tags..."
                />
                <Wrap mt={2}>
                  {formData.tags.map(tag => (
                    <WrapItem key={tag}>
                      <Badge mr={1} mb={1} colorScheme="brand" variant="solid" display="flex" alignItems="center">
                        {tag}
                        <CloseIcon ml={1} w={2} h={2} cursor="pointer" onClick={() => {
                          setFormData({...formData, tags: formData.tags.filter(t => t !== tag)});
                        }}/>
                      </Badge>
                    </WrapItem>
                  ))}
                </Wrap>
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

      {/* Delete Alert */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Excluir Contato(s)
            </AlertDialogHeader>
            <AlertDialogBody>
              Tem certeza que deseja excluir {contactToDelete ? 'este contato' : \`\${selectedIds.length} contatos\` }? Esta ação não pode ser desfeita.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose}>
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Bulk Tags Modal */}
      <Modal isOpen={isBulkTagsOpen} onClose={onBulkTagsClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Adicionar Tags em Massa</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm">
                As tags selecionadas serão adicionadas a <b>{selectedIds.length}</b> contatos. Se o contato já possuir a tag, ela será ignorada.
              </Text>
              <FormControl>
                <TagAutocomplete
                  selectedTags={bulkTags}
                  existingTags={bulkTags}
                  onSelect={(tagName) => {
                    if(!bulkTags.includes(tagName)){
                      setBulkTags([...bulkTags, tagName]);
                    }
                  }}
                  placeholder="Selecione as tags..."
                />
                <Wrap mt={2}>
                  {bulkTags.map(tag => (
                    <WrapItem key={tag}>
                      <Badge mr={1} mb={1} colorScheme="brand" variant="solid" display="flex" alignItems="center">
                        {tag}
                        <CloseIcon ml={1} w={2} h={2} cursor="pointer" onClick={() => {
                          setBulkTags(bulkTags.filter(t => t !== tag));
                        }}/>
                      </Badge>
                    </WrapItem>
                  ))}
                </Wrap>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onBulkTagsClose}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={handleBulkTags} isDisabled={bulkTags.length === 0}>
              Aplicar Tags
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
`;
fs.writeFileSync('frontend/src/components/dashboard-tabs/ContactTab.jsx', newCode);
console.log('ContactTab.jsx successfully refactored!');
