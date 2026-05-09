import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Card, Heading, Text, Button, VStack, HStack, Stack,
  useColorModeValue, Alert, Icon,
  Avatar, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalCloseButton, ModalBody, ModalFooter, useDisclosure, Code, IconButton, Tooltip, useToast,
  Switch, FormControl, FormLabel,
  Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton, DrawerBody,
  useBreakpointValue, Input,
  Tabs, TabList, TabPanels, Tab, TabPanel,
  Menu, MenuButton, MenuList, MenuItem, Flex
} from '@chakra-ui/react';
import { ChatIcon, LinkIcon, DeleteIcon, ArrowBackIcon, InfoIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { FaRobot, FaUser, FaTags, FaSync, FaEdit, FaFileImport } from 'react-icons/fa';
import { IoMdSend } from 'react-icons/io';
import { businessAPI, tagAPI } from '../../services/api';
import { useApp } from '../../context/AppContext';
import CrmSidebar from '../crm/CrmSidebar';
import ImportModal from '../crm/ImportModal';
import TagManagerModal from '../Tags/TagManagerModal';
import ContactItem from '../ContactItem';
import axios from 'axios';

const LiveChatTab = () => {
  const { state, dispatch } = useApp();
  const [conversations, setConversations] = useState([]);
  const [allContacts, setAllContacts] = useState([]); // NEW: All contacts for Tab 2
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [tagColors, setTagColors] = useState({}); // Map name -> hex

  // Layout State
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  // CRM UI State (Mobile)
  const { isOpen: isCrmOpen, onOpen: onCrmOpen, onClose: onCrmClose } = useDisclosure();

  // Import Modal State
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure();

  // Tag Manager State
  const { isOpen: isTagManagerOpen, onOpen: onTagManagerOpen, onClose: onTagManagerClose } = useDisclosure();

  // Mobile View State
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Message Input State
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef(null);

  // Modal de Embed
  const { isOpen: isEmbedOpen, onOpen: onEmbedOpen, onClose: onEmbedClose } = useDisclosure();
  const toast = useToast();

  const isLargeScreen = useBreakpointValue({ base: false, lg: true });

  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const gray100 = useColorModeValue("gray.100", "gray.900");
  const inputBg = useColorModeValue('white', '#0D1117');
  const chatBg = useColorModeValue('linear-gradient(to bottom, #f0f2f5, #e1e5ea)', '#0D1117');

  const myMsgBg = useColorModeValue('brand.100', 'brand.600');
  const otherMsgBg = useColorModeValue('white', '#21262D');
  const myMsgColor = useColorModeValue('black', 'white');
  const otherMsgColor = useColorModeValue('black', '#C9D1D9');

  const messagesEndRef = useRef(null);

  // === Handlers for Tags & Handover ===

  const updateContact = async (updates) => {
    if (!selectedContact) return;
    try {
        // Prepare payload with optimistic concurrency version
        const payload = { ...updates };
        if (payload.__v === undefined) {
            payload.__v = selectedContact.__v;
        }

        const token = localStorage.getItem('token');
        const response = await axios.put(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/contacts/${selectedContact._id}`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Update local state immediately
        setSelectedContact(prev => ({ ...prev, ...response.data }));

        // Update lists
        setConversations(prev => prev.map(c => c._id === selectedContact._id ? { ...c, ...response.data } : c));
        setAllContacts(prev => prev.map(c => c._id === selectedContact._id ? { ...c, ...response.data } : c));

        // Show success toast for CRM updates
        if (updates.dealValue !== undefined || updates.funnelStage || updates.notes) {
             toast({ title: "CRM atualizado.", status: "success", duration: 2000 });
        }

        return response.data;
    } catch (error) {
        console.error("Error updating contact:", error);
        toast({ title: "Erro ao atualizar contato.", status: "error", duration: 3000 });
        throw error;
    }
  };

  const handleAddTag = async (tag) => {
    if (!tag || !selectedContact) return;

    const currentTags = selectedContact.tags || [];
    if (currentTags.includes(tag)) return;

    // Check available tags
    const availableTags = state.businessConfig?.availableTags || [];
    if (!availableTags.includes(tag)) {
       try {
           const newAvailableTags = [...availableTags, tag];
           await businessAPI.updateConfig({ availableTags: newAvailableTags, __v: state.businessConfig.__v });
           dispatch({
             type: 'SET_BUSINESS_CONFIG',
             payload: { ...state.businessConfig, availableTags: newAvailableTags }
           });
       } catch (error) {
           console.error("Erro ao criar nova tag global:", error);
           toast({ title: "Erro ao salvar nova tag no sistema. Recarregue se houve conflito.", status: "error" });
           return;
       }
    }

    const updatedTags = [...currentTags, tag];
    await updateContact({ tags: updatedTags });
  };

  const handleRemoveTag = async (tagToRemove) => {
      if (!selectedContact) return;
      const currentTags = selectedContact.tags || [];
      const updatedTags = currentTags.filter(t => t !== tagToRemove);
      await updateContact({ tags: updatedTags });
  };

  const toggleHandover = async () => {
      const newValue = !selectedContact.isHandover;
      await updateContact({ isHandover: newValue });
      toast({
          title: newValue ? "Robô Pausado (Modo Humano)" : "Robô Ativado",
          status: newValue ? "warning" : "success",
          duration: 2000
      });
  };

  const handleClearHistory = async () => {
    if (!selectedContact) return;
    if (!window.confirm("Tem certeza que deseja limpar o histórico desta conversa? A memória da IA será apagada.")) return;
    try {
      await businessAPI.clearHistory(selectedContact._id);
      setMessages([]);
      toast({ title: "Histórico limpo.", status: "success", duration: 3000, isClosable: true });
    } catch (error) {
      console.error("Erro ao limpar histórico:", error);
      toast({ title: "Erro ao limpar histórico.", status: "error", duration: 3000, isClosable: true });
    }
  };

  // 1. Carregar Conversas (Apenas com histórico)
  const loadConversations = async () => {
    try {
      const { data } = await businessAPI.getConversations();
      // Ensure we only show active conversations (lastInteraction exists)
      // and sort by date descending
      const sorted = data.sort((a, b) => new Date(b.lastInteraction || 0) - new Date(a.lastInteraction || 0));
      setConversations(sorted);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
    }
  };

  // 1b. Carregar Todos Contatos (Ordenado por Nome)
  const loadAllContacts = async () => {
      try {
          const { data } = await businessAPI.getContacts();
           // Sort by Name (A-Z)
          const sorted = data.sort((a, b) => (a.name || a.phone).localeCompare(b.name || b.phone));
          setAllContacts(sorted);
      } catch (error) {
          console.error("Erro ao carregar contatos:", error);
      }
  };

  // 1c. Carregar Tags e Cores
  const loadTags = async () => {
      try {
          const { data } = await businessAPI.getBusinessTags();
          const map = {};
          if (Array.isArray(data)) {
              data.forEach(t => map[t.name] = t.color);
          }
          setTagColors(map);
      } catch (error) {
          console.error("Erro ao carregar tags:", error);
      }
  };

  const handleSyncTags = async () => {
      const toastId = toast({ title: "Sincronizando etiquetas...", status: "info", duration: null, isClosable: false });
      try {
          await tagAPI.sync();
          toast.close(toastId);
          toast({
              title: "Sincronização concluída!",
              status: "success",
              duration: 3000
          });
          loadTags(); // Reload colors
          loadAllContacts(); // Reload contacts
          loadConversations();
      } catch (error) {
          toast.close(toastId);
          console.error("Erro sync tags:", error);
          toast({ title: "Erro ao sincronizar etiquetas.", description: error.response?.data?.message || "Erro desconhecido", status: "error" });
      }
  };

  const handleSyncContacts = async () => {
      const toastId = toast({ title: "Sincronizando contatos...", description: "Isso pode levar alguns minutos.", status: "info", duration: null, isClosable: false });
      try {
          await businessAPI.syncContacts();
          toast.close(toastId);
          toast({
              title: "Sincronização concluída!",
              status: "success",
              duration: 3000
          });
          loadAllContacts();
          loadConversations();
      } catch (error) {
          toast.close(toastId);
          console.error("Erro sync contacts:", error);
          toast({ title: "Erro ao sincronizar contatos.", status: "error" });
      }
  };

  // Tab Change Handler
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (index) => {
      setTabIndex(index);
      if (index === 0) loadConversations();
      if (index === 1) loadAllContacts();
  };

  useEffect(() => {
    loadConversations();
    loadTags(); // Load tags on mount
    // Polling de conversas a cada 10s
    const interval = setInterval(() => {
        if (tabIndex === 0) loadConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, [tabIndex]);

  // 2. Carregar Mensagens ao selecionar
  useEffect(() => {
    if (!selectedContact) return;

    setHasScrolled(false);

    const fetchMessages = async () => {
      try {
        const { data } = await businessAPI.getMessages(selectedContact._id);
        setMessages(data || []);
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
        setMessages([]); // On error or no messages, empty
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedContact]);

  useEffect(() => {
    if (!hasScrolled && messages.length > 0) {
        scrollToBottom();
        setHasScrolled(true);
    }
  }, [messages, hasScrolled]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleContactSelect = useCallback((contact) => {
    setSelectedContact(contact);
    setShowMobileChat(true);
  }, []);

  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedContact(null);
  };

  const handleCrmToggle = () => {
      if (isLargeScreen) {
          setIsRightSidebarOpen(!isRightSidebarOpen);
      } else {
          onCrmOpen();
      }
  };

  const handleSendMessage = async () => {
      if (!inputMessage.trim() || !selectedContact) return;
      setIsSending(true);
      try {
          await businessAPI.sendMessage(selectedContact._id, inputMessage);
          setMessages(prev => [...prev, {
              role: 'agent',
              content: inputMessage,
              timestamp: new Date().toISOString()
          }]);
          setInputMessage('');
          setHasScrolled(false);
          setTimeout(() => {
              inputRef.current?.focus();
          }, 50);

      } catch (error) {
          console.error("Error sending message:", error);
          toast({ title: "Erro ao enviar mensagem.", status: "error" });
      } finally {
          setIsSending(false);
      }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEmbedCode = () => {
    const businessId = state.businessConfig?._id;
    if (!businessId) return "<!-- Carregando ID do Negócio... -->";
    const origin = window.location.origin;
    return `<iframe src="${origin}/chat/${businessId}" width="350" height="600" style="border:none; position:fixed; bottom:20px; right:20px; z-index:9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 12px;"></iframe>`;
  };

  const renderContactList = (list, emptyMessage) => (
       <Box flex="1" overflowY="auto" w="full">
          <VStack spacing={0} align="stretch">
            {list.length === 0 && (
               <Text p={4} fontSize="sm" color="gray.500">{emptyMessage}</Text>
            )}
            {list.map(contact => (
              <ContactItem
                key={contact._id}
                contact={contact}
                isSelected={selectedContact?._id === contact._id}
                onClick={handleContactSelect}
                tagColors={tagColors}
              />
            ))}
          </VStack>
       </Box>
  );

  return (
    <Box>
      <Stack direction={{ base: 'column', md: 'row' }} mb={4} justify="flex-end" spacing={2}>
        <Button leftIcon={<LinkIcon />} size="sm" onClick={onEmbedOpen} colorScheme="brand">
          Instalar no Site
        </Button>
      </Stack>

      <Card h={{ base: "calc(100dvh - 150px)", md: "75vh" }} overflow="hidden" border="1px solid" borderColor="gray.200">
        <Flex direction={{ base: 'column', md: 'row' }} h="100%" align="stretch">

          {/* LADO ESQUERDO: LISTA DE CONTATOS E TABS */}
          <Box
            w={{ base: "100%", md: isLeftSidebarOpen ? "350px" : "0px" }}
            display={{ base: showMobileChat ? 'none' : 'flex', md: isLeftSidebarOpen ? 'flex' : 'none' }}
            flexDirection="column"
            h="100%"
            borderRight="1px solid"
            borderColor={gray50Bg}
            bg={gray50Bg}
            overflow="hidden"
            transition="width 0.3s ease"
          >
             {/* Header com Botão Importar */}
            <HStack p={4} borderBottom="1px solid" borderColor={gray50Bg} bg={cardBg} justify="space-between" flexShrink={0}>
                <Heading size="sm" color="gray.600">Chats</Heading>
                <HStack spacing={1}>
                     {/* Global Sync Menu */}
                     <Menu>
                        <Tooltip label="Sincronização e Tags">
                            <MenuButton as={IconButton} icon={<Icon as={FaSync} />} size="sm" variant="ghost" colorScheme="brand" aria-label="Sync Menu" />
                        </Tooltip>
                        <MenuList zIndex={10}>
                            <MenuItem icon={<Icon as={FaUser} />} onClick={handleSyncContacts}>
                                Sincronizar Contatos
                            </MenuItem>
                            <MenuItem icon={<Icon as={FaTags} />} onClick={handleSyncTags}>
                                Sincronizar Etiquetas
                            </MenuItem>
                            <MenuItem icon={<Icon as={FaEdit} />} onClick={onTagManagerOpen}>
                                Gerenciar Etiquetas
                            </MenuItem>
                            <MenuItem icon={<Icon as={FaFileImport} />} onClick={onImportOpen}>
                                Importar CSV/Excel
                            </MenuItem>
                        </MenuList>
                    </Menu>
                </HStack>
            </HStack>

            {/* Tabs */}
            <Tabs isFitted variant="enclosed" onChange={handleTabChange} display="flex" flexDirection="column" flex="1" overflow="hidden">
               <TabList mb={0} bg={cardBg} flexShrink={0}>
                  <Tab fontSize="sm">Conversas</Tab>
                  <Tab fontSize="sm">Contatos</Tab>
               </TabList>

               <TabPanels flex="1" overflow="hidden" display="flex" flexDirection="column">

                  {/* Tab 1: Conversas Ativas */}
                  <TabPanel p={0} h="100%" display="flex" flexDirection="column">
                      {renderContactList(conversations, "Nenhuma conversa recente.")}
                  </TabPanel>

                  {/* Tab 2: Todos os Contatos */}
                  <TabPanel p={0} h="100%" display="flex" flexDirection="column">
                       {renderContactList(allContacts, "Nenhum contato encontrado.")}
                  </TabPanel>
               </TabPanels>
            </Tabs>
          </Box>

          {/* LADO DIREITO: CHAT */}
          <Box
            flex="1"
            bg={gray100}
            position="relative"
            display={{ base: showMobileChat ? 'flex' : 'none', md: 'flex' }}
            flexDirection="column"
            h="100%"
            border={selectedContact?.isHandover ? "4px solid orange" : "none"}
          >
            {selectedContact ? (
              <>
                {/* Header do Chat */}
                <Box p={3} bg={cardBg} borderBottom="1px solid" borderColor={gray50Bg}>
                    <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" mb={2} spacing={2}>
                      <HStack>
                         {/* Toggle Left Sidebar (Desktop) */}
                        <IconButton
                             display={{ base: 'none', md: 'flex' }}
                             icon={isLeftSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                             onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                             variant="ghost"
                             size="sm"
                             aria-label="Toggle Sidebar"
                             mr={1}
                        />
                        <IconButton
                          display={{ base: 'flex', md: 'none' }}
                          icon={<ArrowBackIcon />}
                          onClick={handleBackToList}
                          variant="ghost"
                          aria-label="Voltar"
                          mr={2}
                        />
                        <Avatar size="sm" name={selectedContact.name} src={selectedContact.profilePicUrl} />
                        <Box>
                          <Text fontWeight="bold">{selectedContact.name || 'Visitante'}</Text>
                          <Text fontSize="xs" color="gray.500">
                             {selectedContact.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}
                          </Text>
                        </Box>
                      </HStack>

                      <Stack direction={{ base: 'column', sm: 'row' }} alignItems={{ base: 'stretch', sm: 'center' }} justify={{ base: 'space-between', md: 'flex-end' }} w={{ base: 'full', md: 'auto' }} spacing={2}>
                           <FormControl display='flex' alignItems='center' justifyContent={{ base: 'space-between', sm: 'flex-start' }} w={{ base: 'full', sm: 'auto' }}>
                              <FormLabel htmlFor='handover-switch' mb='0' fontSize="xs" color={selectedContact.isHandover ? "orange.500" : "gray.500"} mr={2}>
                                {selectedContact.isHandover ? "Pausado" : "Robô Ativo"}
                              </FormLabel>
                              <Switch
                                id='handover-switch'
                                isChecked={selectedContact.isHandover}
                                onChange={toggleHandover}
                                colorScheme="orange"
                                size="sm"
                              />
                            </FormControl>

                            <HStack>
                              <Tooltip label="Informações do Cliente (CRM)">
                                <IconButton
                                    icon={isRightSidebarOpen && isLargeScreen ? <ChevronRightIcon /> : <InfoIcon />}
                                    onClick={handleCrmToggle}
                                    variant={isRightSidebarOpen && isLargeScreen ? "solid" : "ghost"}
                                    colorScheme={isRightSidebarOpen && isLargeScreen ? "brand" : "gray"}
                                    aria-label="CRM"
                                    size="sm"
                                />
                              </Tooltip>

                              <Tooltip label="Limpar Histórico">
                                <Button
                                  leftIcon={<DeleteIcon />}
                                  size="sm"
                                  colorScheme="red"
                                  variant="ghost"
                                  onClick={handleClearHistory}
                                >
                                  Limpar
                                </Button>
                              </Tooltip>
                            </HStack>
                      </Stack>
                    </Stack>
                </Box>

                {/* Área de Mensagens */}
                <Box flex="1" p={4} overflowY="auto" bg={chatBg}>
                  <VStack spacing={3} align="stretch">
                    {messages.length === 0 && (
                        <VStack justify="center" h="100%" pt={10}>
                            <Text color="gray.400" fontSize="sm">Inicie a conversa ou adicione notas no CRM.</Text>
                        </VStack>
                    )}
                    {messages.map((msg, index) => {
                       const isMe = msg.role === 'bot' || msg.role === 'system' || msg.role === 'agent';
                       return (
                         <HStack key={index} justify={isMe ? 'flex-end' : 'flex-start'} align="flex-start">
                           {!isMe && <Avatar size="xs" name={selectedContact.name} mr={2} mt={1} />}
                           <Box
                             bg={isMe ? myMsgBg : otherMsgBg}
                             color={isMe ? myMsgColor : otherMsgColor}
                             px={4} py={2}
                             borderRadius="lg"
                             boxShadow="sm"
                             maxW="70%"
                             borderTopLeftRadius={!isMe ? 0 : 'lg'}
                             borderTopRightRadius={isMe ? 0 : 'lg'}
                           >
                             <Text
                               fontSize="sm"
                               whiteSpace="pre-wrap"
                               wordBreak="break-word"
                               overflowWrap="anywhere"
                             >
                               {msg.content}
                             </Text>
                             <Text fontSize="10px" color="gray.500" textAlign="right" mt={1}>
                               {formatTime(msg.timestamp)}
                             </Text>
                           </Box>
                         </HStack>
                       );
                    })}
                    <div ref={messagesEndRef} />
                  </VStack>
                </Box>

                {/* Input Area */}
                <Box p={4} bg={cardBg} borderTop="1px solid" borderColor={gray50Bg}>
                    {selectedContact.isHandover ? (
                       <Alert status="success" variant="subtle" size="sm" borderRadius="md" mb={3} bg="green.100" color="green.800">
                          <Icon as={FaUser} mr={2} />
                          🤖 Robô Pausado.
                       </Alert>
                    ) : (
                       <Alert status="info" variant="subtle" size="sm" borderRadius="md" mb={3}>
                          <Icon as={FaRobot} mr={2} />
                          IA Ativa.
                       </Alert>
                    )}

                    <HStack>
                        <Input
                            ref={inputRef}
                            placeholder="Digite sua resposta..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            isDisabled={isSending}
                            bg={inputBg}
                            size={{ base: 'lg', md: 'md' }}
                            autoFocus
                        />
                        <IconButton
                            icon={<Icon as={IoMdSend} />}
                            colorScheme="brand"
                            onClick={handleSendMessage}
                            isLoading={isSending}
                            aria-label="Enviar"
                            size={{ base: 'lg', md: 'md' }}
                        />
                    </HStack>
                </Box>
              </>
            ) : (
              <VStack justify="center" h="100%" spacing={4}>
                 <Icon as={ChatIcon} boxSize={12} color="gray.300" />
                 <Text color="gray.500">Selecione uma conversa para iniciar o atendimento.</Text>
              </VStack>
            )}

          </Box>

          {/* LADO DIREITO: CRM SIDEBAR (DESKTOP) */}
          {selectedContact && isRightSidebarOpen && (
              <Box
                  display={{ base: 'none', lg: 'block' }}
                  h="100%"
                  w="300px"
                  transition="width 0.3s ease"
              >
                  <CrmSidebar
                      contact={selectedContact}
                      onUpdate={updateContact}
                      availableTags={state.businessConfig?.availableTags || []}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                      tagColors={tagColors}
                      onClose={() => setIsRightSidebarOpen(false)}
                  />
              </Box>
          )}

        </Flex>
      </Card>

      <Modal isOpen={isEmbedOpen} onClose={onEmbedClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Instalar Widget no Site</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>Copie o código abaixo e cole no HTML do seu site (antes de fechar a tag `&lt;/body&gt;`):</Text>
            <Box bg="gray.900" p={4} borderRadius="md" color="green.300" overflowX="auto">
               <Code display="block" whiteSpace="pre" bg="transparent" color="inherit">
                  {getEmbedCode()}
               </Code>
            </Box>
          </ModalBody>
          <ModalFooter>
             <Button colorScheme="blue" onClick={() => { navigator.clipboard.writeText(getEmbedCode()); onEmbedClose(); }}>
                Copiar Código
             </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Drawer isOpen={isCrmOpen} placement="right" onClose={onCrmClose} size="sm">
        <DrawerOverlay />
        <DrawerContent>
            <DrawerCloseButton />
            <DrawerBody p={0}>
                 {selectedContact && (
                    <CrmSidebar
                        contact={selectedContact}
                        onUpdate={(data) => { updateContact(data); }}
                        availableTags={state.businessConfig?.availableTags || []}
                        onAddTag={handleAddTag}
                        onRemoveTag={handleRemoveTag}
                        tagColors={tagColors}
                        onClose={onCrmClose}
                    />
                )}
            </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={onImportClose}
        onSuccess={() => {
            loadAllContacts();
            loadConversations();
        }}
      />

      {/* Tag Manager Modal */}
      <TagManagerModal
        isOpen={isTagManagerOpen}
        onClose={onTagManagerClose}
        onTagsUpdated={loadTags}
      />

    </Box>
  );
};

export default LiveChatTab;
