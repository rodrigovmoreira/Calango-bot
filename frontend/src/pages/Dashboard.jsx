import React, { useEffect, useState, Suspense, lazy } from 'react';
import {
  Box, Flex, Heading, Text, Button, VStack, HStack,
  useToast, useColorModeValue, FormControl, FormLabel, Input,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Menu, MenuButton, MenuList, MenuItem, Avatar, IconButton, Spinner, Center
} from '@chakra-ui/react';
import {
  EditIcon, WarningTwoIcon, ChevronDownIcon,
} from '@chakra-ui/icons';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
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

const Dashboard = ({ initialTab = 0 }) => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const fileInputRef = React.useRef();

  // Colors
  const mainBg = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');

  // Global Modals
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
  const { isOpen: isSidebarOpen, onOpen: onSidebarOpen, onClose: onSidebarClose } = useDisclosure();

  // Navigation State
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  // Profile Data
  const [profileData, setProfileData] = useState({ name: '', email: '', company: '', avatarUrl: '' });

  // Sync Profile
  useEffect(() => {
    if (state.user) {
      setProfileData({
        name: state.user.name || '',
        email: state.user.email || '',
        company: state.businessConfig?.businessName || state.user.company || 'Minha Empresa',
        avatarUrl: state.user.avatarUrl || ''
      });
    }
  }, [state.user, state.businessConfig]);

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
        title={LinkItems[activeTab]?.name || 'Painel'}
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
          {/* Lado Esquerdo: Nome da Empresa */}
          <Heading size="md" color={useColorModeValue("gray.700", "white")}>
            {profileData.company}
          </Heading>

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

    </Box>
  );
};

export default Dashboard;
