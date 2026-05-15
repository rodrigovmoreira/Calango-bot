import React, { useEffect, useState, Suspense, lazy } from 'react';
import {
  Box, Flex, Heading, Text, Button, VStack, HStack,
  useToast, useColorModeValue, FormControl, FormLabel, Input,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Avatar, IconButton, Spinner, Center
} from '@chakra-ui/react';
import {
  EditIcon, WarningTwoIcon, ChevronDownIcon, AddIcon
} from '@chakra-ui/icons';
import { FaUsers } from 'react-icons/fa';
import { useApp } from '../context/AppContext';
import { authAPI, businessAPI } from '../services/api';
import { uploadFileToFirebase } from '../utils/uploadHelper';

// Imported Components
import { Sidebar, LinkItems, MobileNav } from '../components/Sidebar';

// Lazy Loaded Components for Performance Optimization
const OverviewTab = lazy(() => import('../components/dashboard-tabs/OverviewTab'));
const ConnectionTab = lazy(() => import('../components/dashboard-tabs/ConnectionTab'));
const IntelligenceTab = lazy(() => import('../components/dashboard-tabs/IntelligenceTab'));
const QuickRepliesTab = lazy(() => import('../components/dashboard-tabs/QuickRepliesTab'));
const CatalogTab = lazy(() => import('../components/dashboard-tabs/CatalogTab'));
const CampaignTab = lazy(() => import('../components/dashboard-tabs/CampaignTab'));
const LiveChatTab = lazy(() => import('../components/dashboard-tabs/LiveChatTab'));
const ScheduleTab = lazy(() => import('../components/ScheduleTab'));
const SalesFunnel = lazy(() => import('./SalesFunnel'));
const TeamTab = lazy(() => import('../components/dashboard-tabs/TeamTab'));

const Dashboard = ({ initialTab = 0 }) => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const fileInputRef = React.useRef();

  // Colors
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');

  // Global Modals
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
  const { isOpen: isCreateBusinessOpen, onOpen: onCreateBusinessOpen, onClose: onCreateBusinessClose } = useDisclosure();
  const { isOpen: isSidebarOpen, onOpen: onSidebarOpen, onClose: onSidebarClose } = useDisclosure();

  // Navigation State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profile Data
  const [profileData, setProfileData] = useState({ name: '', email: '', company: '', avatarUrl: '' });

  // Sync Profile
  useEffect(() => {
    if (state.user) {
      // Find the current business name from user's populated businesses array or fallback
      let currentBusinessName = 'Minha Empresa';
      if (state.user.businesses && state.user.activeBusinessId) {
        const b = state.user.businesses.find(b => {
          const bId = b.businessId._id ? b.businessId._id.toString() : b.businessId.toString();
          return bId === state.user.activeBusinessId.toString();
        });
        if (b && b.businessId.businessName) {
           currentBusinessName = b.businessId.businessName;
        }
      }

      // Override with state.businessConfig if available as it is the real time source of truth
      if (state.businessConfig?.businessName) {
         currentBusinessName = state.businessConfig.businessName;
      }

      setProfileData({
        name: state.user.name || '',
        email: state.user.email || '',
        company: currentBusinessName,
        avatarUrl: state.user.avatarUrl || ''
      });
    }
  }, [state.user, state.businessConfig]);

  const handleSwitchBusiness = async (targetBusinessId) => {
    try {
      const { data } = await authAPI.switchBusiness(targetBusinessId);

      // Update local storage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      toast({ title: 'Trocando de empresa...', status: 'info', duration: 2000 });

      // Force reload to root dashboard to avoid state leakage
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Erro ao trocar de empresa:', error);
      toast({ title: 'Erro ao trocar de empresa', status: 'error' });
    }
  };

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim()) {
      toast({ title: 'O nome da empresa é obrigatório.', status: 'warning' });
      return;
    }
    try {
      setIsCreatingBusiness(true);
      const { data } = await businessAPI.createBusiness({ businessName: newBusinessName });

      // Update local storage with new context
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      toast({ title: 'Empresa criada com sucesso!', status: 'success', duration: 2000 });
      onCreateBusinessClose();

      // Force reload to avoid state leakage and initialize new context
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Erro ao criar empresa:', error);
      toast({ title: 'Erro ao criar empresa', status: 'error' });
    } finally {
      setIsCreatingBusiness(false);
    }
  };

  const handleLogoutSystem = async () => {
    const confirm = window.confirm("Ao sair, o Robô do WhatsApp será desligado para economizar recursos. Deseja continuar?");
    if (confirm) {
      try {
        await authAPI.logout();
        toast({ title: 'Sessão encerrada', status: 'info' });
      } catch (error) {
        console.error("Erro ao notificar logout:", error);
      } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Novo fluxo: usa uploadFileToFirebase que:
      // 1. Solicita URL assinada do Squamata Upload
      // 2. Faz upload direto para Firebase
      // 3. Retorna a URL final
      const { imageUrl } = await uploadFileToFirebase(file, 'avatars');
      setProfileData(prev => ({ ...prev, avatarUrl: imageUrl }));
      toast({ title: 'Avatar enviado!', status: 'success' });
    } catch (error) {
      console.error('Erro ao enviar avatar:', error);
      toast({ title: 'Erro ao enviar imagem', status: 'error' });
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await authAPI.updateUser({
        name: profileData.name,
        avatarUrl: profileData.avatarUrl
      });

      dispatch({ type: 'SET_USER', payload: data.user });
      localStorage.setItem('user', JSON.stringify(data.user));
      toast({ title: "Perfil atualizado!", status: "success" });
      onProfileClose();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({ title: 'Erro ao atualizar perfil', status: 'error' });
    }
  };

  // Business Selector Component
  const BusinessSelector = () => {
    return (
      <Menu>
        <MenuButton as={Button} variant="ghost" rightIcon={<ChevronDownIcon />} size="md" px={2}>
          <Heading size="sm" color={useColorModeValue("gray.700", "white")} maxW="200px" isTruncated>
            {profileData.company}
          </Heading>
        </MenuButton>
        <MenuList maxH="300px" overflowY="auto">
          {state.user?.businesses?.map((b) => {
            const bId = b.businessId._id ? b.businessId._id.toString() : b.businessId.toString();
            const bName = b.businessId.businessName || 'Empresa Sem Nome';
            const isActive = bId === state.user?.activeBusinessId;

            return (
              <MenuItem
                key={bId}
                onClick={() => !isActive && handleSwitchBusiness(bId)}
                isDisabled={isActive}
                fontWeight={isActive ? "bold" : "normal"}
              >
                {bName} {isActive ? "(Atual)" : ""}
              </MenuItem>
            );
          })}
          <MenuDivider />
          <MenuItem icon={<AddIcon />} onClick={onCreateBusinessOpen}>
            + Criar nova empresa
          </MenuItem>
        </MenuList>
      </Menu>
    );
  };

  // Profile Menu Component
  const ProfileMenu = (
    <Menu>
      <MenuButton
        as={Button}
        rounded={'full'}
        variant={'link'}
        cursor={'pointer'}
        minW={0}
      >
        <Avatar
          size={'sm'}
          name={profileData.name}
          src={profileData.avatarUrl}
        />
      </MenuButton>
      <MenuList>
        <MenuItem icon={<EditIcon />} onClick={onProfileOpen}>Meu Perfil</MenuItem>
        <MenuItem icon={<FaUsers />} onClick={() => setActiveTab(9)}>Gestão de Equipe</MenuItem>
        <MenuItem icon={<WarningTwoIcon />} onClick={handleLogoutSystem}>Sair</MenuItem>
      </MenuList>
    </Menu>
  );

  const LoadingFallback = () => (
    <Center h="50vh">
      <Spinner size="xl" color="brand.500" thickness="4px" />
    </Center>
  );

  return (
    <Box minH="100vh" bg={mainBg}>
      {/* Unified Sidebar (Handles Desktop Fixed & Mobile Drawer) */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={onSidebarClose}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        toggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Navbar Mobile Customizada (Com Avatar e Menu) - Moved outside content Box for better stacking context */}
      <MobileNav
        onOpen={onSidebarOpen}
        title={<BusinessSelector />}
      >
        {ProfileMenu}
      </MobileNav>

      {/* CONTEÚDO PRINCIPAL (Área à direita) */}
      <Box
        ml={{ base: 0, lg: isCollapsed ? 20 : 60 }}
        p={{ base: 4, md: 6 }}
        pt={{ base: 4, lg: 6 }}
        mt={{ base: 20, lg: 0 }} // Add margin top on mobile because MobileNav is fixed
        transition="margin-left 0.2s"
      >

        {/* HEADER DESKTOP (TopBar) */}
        <Flex
          display={{ base: 'none', lg: 'flex' }}
          justify="space-between"
          align="center"
          mb={6}
          bg={headerBg}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
        >
          {/* Lado Esquerdo: Dropdown de Empresas */}
          <BusinessSelector />

          {/* Lado Direito: Menu do Usuário */}
          <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} variant="ghost" p={2}>
              <HStack>
                <Avatar size="sm" name={profileData.name} src={profileData.avatarUrl} />
                <Text fontWeight="normal">{profileData.name}</Text>
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem icon={<EditIcon />} onClick={onProfileOpen}>Meu Perfil</MenuItem>
              <MenuItem icon={<FaUsers />} onClick={() => setActiveTab(9)}>Gestão de Equipe</MenuItem>
              <MenuItem icon={<WarningTwoIcon />} onClick={handleLogoutSystem}>Sair</MenuItem>
            </MenuList>
          </Menu>
        </Flex>

        {/* --- CONTEÚDO DAS ABAS (Render Condicional) --- */}
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 0 && <OverviewTab />}
          {activeTab === 1 && <ConnectionTab />}
          {activeTab === 2 && <IntelligenceTab />}
          {activeTab === 3 && <QuickRepliesTab />}
          {activeTab === 4 && <CatalogTab />}
          {activeTab === 5 && <CampaignTab />}
          {activeTab === 6 && <LiveChatTab />}
          {activeTab === 7 && <ScheduleTab />}
          {activeTab === 8 && <SalesFunnel />}
          {activeTab === 9 && <TeamTab />}
        </Suspense>

      </Box>

      {/* Modal Perfil (Minha Conta) - Mantido Globalmente */}
      <Modal isOpen={isProfileOpen} onClose={onProfileClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Minha Conta</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={6} py={4}>
              <Box position="relative">
                <Avatar size="2xl" name={profileData.name} src={profileData.avatarUrl} />
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <IconButton
                  aria-label="Alterar foto"
                  icon={<EditIcon />}
                  size="sm"
                  colorScheme="brand"
                  rounded="full"
                  position="absolute"
                  bottom={0}
                  right={0}
                  boxShadow="md"
                  onClick={() => fileInputRef.current.click()}
                />
              </Box>

              <FormControl>
                <FormLabel>Nome Completo</FormLabel>
                <Input
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  size={{ base: 'lg', md: 'md' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Email (Login)</FormLabel>
                <Input value={profileData.email} isDisabled bg="gray.100" size={{ base: 'lg', md: 'md' }} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onProfileClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleSaveProfile}>Salvar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Criar Empresa */}
      <Modal isOpen={isCreateBusinessOpen} onClose={onCreateBusinessClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Criar Nova Empresa</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel>Nome da Empresa</FormLabel>
              <Input
                placeholder="Ex: Minha Nova Loja"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateBusinessClose} isDisabled={isCreatingBusiness}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={handleCreateBusiness} isLoading={isCreatingBusiness}>
              Salvar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default Dashboard;
