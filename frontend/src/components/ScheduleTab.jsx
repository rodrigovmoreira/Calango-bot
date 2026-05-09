import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  Box, Button, Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalFooter, ModalBody, ModalCloseButton, FormControl, FormLabel,
  Input, Select, useDisclosure, useToast, VStack, HStack, Stack, Text,
  useColorModeValue, Badge, Menu, MenuButton, MenuList, MenuItem, Tooltip, IconButton
} from '@chakra-ui/react';
import { DeleteIcon, ChevronDownIcon, CheckIcon, AddIcon, TimeIcon, SettingsIcon } from '@chakra-ui/icons';
import { businessAPI } from '../services/api';
import { useApp } from '../context/AppContext';

// Configura o Moment para Português 
moment.locale('pt-br');
const localizer = momentLocalizer(moment);

const ScheduleTab = () => {
  const { state } = useApp();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isFollowUpOpen, onOpen: onFollowUpOpen, onClose: onFollowUpClose } = useDisclosure(); // Modal de confirmação follow-up
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure(); // Modal de Configurações
  const toast = useToast();

  const [view, setView] = useState('week');
  const [minNotice, setMinNotice] = useState(60); // Default 60
  const [date, setDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all'); // all, scheduled, completed, pending

  const [newEvent, setNewEvent] = useState({
    title: '',
    clientName: '',
    clientPhone: '',
    start: '',
    end: '',
    type: 'servico',
    status: 'scheduled'
  });

  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchAppointments();
    if (state.businessConfig?.minSchedulingNoticeMinutes) {
        setMinNotice(state.businessConfig.minSchedulingNoticeMinutes);
    }
  }, [state.businessConfig]);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(e => {
        if (filterStatus === 'pending') return e.status === 'followup_pending';
        return e.status === filterStatus;
      }));
    }
  }, [events, filterStatus]);

  const fetchAppointments = async () => {
    try {
      const res = await businessAPI.getAppointments();
      const formattedEvents = res.data.map(evt => ({
        ...evt,
        start: new Date(evt.start),
        end: new Date(evt.end),
        title: `${evt.title} - ${evt.clientName}`,
        status: evt.status || 'scheduled'
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error("Erro ao buscar agenda:", error);
    }
  };

  const formatForInput = (dateObj) => {
    return moment(dateObj).format('YYYY-MM-DDTHH:mm');
  };

  const isWithinOperatingHours = (start, end) => {
    if (!state.businessConfig?.operatingHours) return true;

    const { opening, closing } = state.businessConfig.operatingHours;

    const openHour = parseInt(opening.split(':')[0]);
    const closeHour = parseInt(closing.split(':')[0]);
    const openMin = parseInt(opening.split(':')[1] || 0);
    const closeMin = parseInt(closing.split(':')[1] || 0);

    const startH = new Date(start).getHours();
    const startM = new Date(start).getMinutes();
    const endH = new Date(end).getHours();
    const endM = new Date(end).getMinutes();

    if (startH < openHour || (startH === openHour && startM < openMin)) return false;
    if (endH > closeHour || (endH === closeHour && endM > closeMin)) return false;

    return true;
  };

  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent(null);
    setNewEvent({
      ...newEvent,
      start: start,
      end: end,
      title: '',
      clientName: '',
      clientPhone: ''
    });
    onOpen();
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setNewEvent({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    });
    onOpen();
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedEvent) return;

    // Se for marcar como concluído, pergunta sobre o follow-up
    if (newStatus === 'completed') {
      onFollowUpOpen(); // Abre modal de confirmação
      return;
    }

    await updateStatus(newStatus);
  };

  const updateStatus = async (status) => {
    try {
      await businessAPI.updateAppointmentStatus(selectedEvent._id, status, selectedEvent.__v);
      toast({ title: `Status atualizado para: ${status}`, status: 'success' });
      fetchAppointments();
      onClose();
      onFollowUpClose();
    } catch (error) {
      if (error.response?.status === 409) {
          toast({
              title: "Conflito de Versão",
              description: "Atenção: Este agendamento foi modificado por outro usuário. Recarregue a página (ou feche e abra o modal novamente) para ver as atualizações.",
              status: "error",
              duration: null,
              isClosable: true
          });
      } else {
          toast({ title: 'Erro ao atualizar status', status: 'error' });
      }
    }
  };

  const handleFollowUpChoice = async (shouldSchedule) => {
    // Se sim, status = followup_pending (para o scheduler pegar)
    // Se não, status = completed (finaliza ciclo)
    const finalStatus = shouldSchedule ? 'followup_pending' : 'completed';
    await updateStatus(finalStatus);
    if (shouldSchedule) {
      toast({ title: 'Agendado para follow-up automático!', status: 'info' });
    }
  };

  const handleSave = async () => {
    if (!newEvent.title || !newEvent.clientName || !newEvent.clientPhone) {
      toast({ title: 'Preencha título, nome e telefone.', status: 'warning' });
      return;
    }

    if (!isWithinOperatingHours(newEvent.start, newEvent.end)) {
      const { opening, closing } = state.businessConfig?.operatingHours || { opening: '?', closing: '?' };
      toast({
        title: 'Fora do horário de funcionamento!',
        description: `A empresa funciona das ${opening} às ${closing}.`,
        status: 'error',
        duration: 5000
      });
      return;
    }

    try {
      if (selectedEvent) {
        // UPDATE (Preserva histórico e IDs)
        const payload = {
          ...newEvent,
          status: selectedEvent.status, // Garante que status não seja resetado acidentalmente
          __v: selectedEvent.__v
        };
        await businessAPI.updateAppointment(selectedEvent._id, payload);
        toast({ title: 'Agendamento atualizado!', status: 'success' });
      } else {
        // CREATE
        await businessAPI.createAppointment(newEvent);
        toast({ title: 'Agendamento criado!', status: 'success' });
      }

      await fetchAppointments();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.response?.data?.message || 'Conflito de horário.', status: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (!window.confirm(`Cancelar agendamento de ${selectedEvent.clientName}?`)) return;

    try {
      await businessAPI.deleteAppointment(selectedEvent._id);
      toast({ title: 'Agendamento cancelado.', status: 'success' });
      await fetchAppointments();
      onClose();
    } catch (error) {
      if (error.response?.status === 409) {
          toast({
              title: "Conflito de Versão",
              description: "Atenção: Este agendamento foi modificado por outro usuário. Recarregue a página para ver as atualizações.",
              status: "error",
              duration: null,
              isClosable: true
          });
      } else {
          toast({ title: 'Erro ao salvar agendamento', status: 'error' });
      }
    }
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3182ce'; // Default Blue

    // Cores por STATUS têm prioridade
    if (event.status === 'completed') backgroundColor = '#38a169'; // Green
    if (event.status === 'cancelled') backgroundColor = '#e53e3e'; // Red
    if (event.status === 'followup_pending') backgroundColor = '#dd6b20'; // Orange
    if (event.status === 'no_show') backgroundColor = '#718096'; // Grey

    // Se estiver 'scheduled', usa a cor do TIPO
    if (event.status === 'scheduled') {
      if (event.type === 'orcamento') backgroundColor = '#d69e2e'; // Yellow
      if (event.type === 'servico') backgroundColor = '#3182ce'; // Blue
    }

    return { style: { backgroundColor } };
  };

  const bg = useColorModeValue('white', 'gray.800');
  const cardBg = useColorModeValue('gray.50', 'gray.700'); // Defined at top level

  const actionsBg = useColorModeValue("gray.50", "gray.700");

  const statusColors = {
    scheduled: 'blue',
    confirmed: 'cyan',
    completed: 'green',
    cancelled: 'red',
    no_show: 'gray',
    followup_pending: 'orange',
    archived: 'gray'
  };

  // Custom Styles for Dark Mode Support in React Big Calendar
  const calendarSx = {
    '.rbc-calendar': {
      color: useColorModeValue('gray.800', '#C9D1D9'),
    },
    '.rbc-off-range-bg': {
      bg: useColorModeValue('gray.100', 'transparent'),
    },
    '.rbc-today': {
      bg: useColorModeValue('blue.50', 'whiteAlpha.100'),
    },
    '.rbc-header': {
      borderColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-time-view': {
      borderColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-time-content': {
      borderTopColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-timeslot-group': {
      borderBottomColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-day-slot': {
      borderLeftColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-time-header-content': {
      borderLeftColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-time-gutter': {
      borderRightColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-day-bg': {
      borderColor: useColorModeValue('gray.200', '#30363D'),
    },
    '.rbc-toolbar button': {
      color: useColorModeValue('gray.600', '#C9D1D9'),
      borderColor: useColorModeValue('gray.300', '#30363D'),
      _hover: {
        bg: useColorModeValue('gray.100', '#161B22'),
      },
      _active: {
        bg: useColorModeValue('gray.200', '#161B22'),
      }
    },
    '.rbc-toolbar button.rbc-active': {
      bg: useColorModeValue('brand.500', 'brand.500'),
      color: 'white',
      borderColor: useColorModeValue('brand.500', 'brand.500'),
    }
  };

  return (
    <Box h="85vh" bg={bg} p={4} borderRadius="md" boxShadow="sm" sx={calendarSx}>

      {/* MOBILE CARD VIEW */}
      <Box display={{ base: 'block', md: 'none' }} h="90%" overflowY="auto" pb={20}>
        <HStack justify="space-between" mb={4}>
           <Text fontWeight="bold" fontSize="lg">Agenda</Text>
           <HStack>
               <IconButton icon={<SettingsIcon />} size={{ base: 'lg', md: 'md' }} onClick={onSettingsOpen} aria-label="Configurações" />
               <Button leftIcon={<AddIcon />} colorScheme="blue" size={{ base: 'lg', md: 'md' }} onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })}>
                 Novo
               </Button>
           </HStack>
        </HStack>

        <VStack spacing={3} align="stretch">
          {filteredEvents.length === 0 ? (
             <Text color="gray.500" textAlign="center" mt={10}>Nenhum agendamento encontrado.</Text>
          ) : (
             filteredEvents.map((evt, idx) => (
               <Box
                 key={idx}
                 p={4}
                 bg={cardBg}
                 borderRadius="md"
                 boxShadow="sm"
                 borderLeft="4px solid"
                 borderLeftColor={
                    evt.status === 'completed' ? 'green.500' :
                    evt.status === 'cancelled' ? 'red.500' :
                    evt.status === 'followup_pending' ? 'orange.500' :
                    'blue.500'
                 }
                 onClick={() => handleSelectEvent(evt)}
               >
                 <HStack justify="space-between">
                    <Text fontWeight="bold">{evt.clientName}</Text>
                    <Badge colorScheme={statusColors[evt.status]}>{evt.status}</Badge>
                 </HStack>
                 <Text fontSize="sm">{evt.title}</Text>
                 <HStack fontSize="xs" color="gray.500" mt={2}>
                    <TimeIcon />
                    <Text>{moment(evt.start).format('DD/MM HH:mm')} - {moment(evt.end).format('HH:mm')}</Text>
                 </HStack>
               </Box>
             ))
          )}
        </VStack>
      </Box>

      {/* DESKTOP CALENDAR VIEW */}
      <Box display={{ base: 'none', md: 'block' }} h="100%">

      {/* BARRA DE FILTROS DE STATUS */}
      <HStack mb={4} justify="space-between">
          <HStack spacing={4} overflowX="auto" pb={2} css={{
            '&::-webkit-scrollbar': { height: '4px' },
            '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '24px' },
          }}>
            <Button
              flexShrink={0}
              size="sm"
              variant={filterStatus === 'all' ? 'solid' : 'outline'}
              colorScheme="blue"
              onClick={() => setFilterStatus('all')}
            >
              Todos
            </Button>
            <Button
              flexShrink={0}
              size="sm"
              variant={filterStatus === 'scheduled' ? 'solid' : 'outline'}
              colorScheme="blue"
              onClick={() => setFilterStatus('scheduled')}
            >
              Agendados
            </Button>
            <Button
              flexShrink={0}
              size="sm"
              variant={filterStatus === 'completed' ? 'solid' : 'outline'}
              colorScheme="green"
              onClick={() => setFilterStatus('completed')}
            >
              Concluídos
            </Button>
            <Button
              flexShrink={0}
              size="sm"
              variant={filterStatus === 'pending' ? 'solid' : 'outline'}
              colorScheme="orange"
              onClick={() => setFilterStatus('pending')}
            >
              Follow-up Pendente
            </Button>
          </HStack>

          <Tooltip label="Configurar Antecedência Mínima">
             <IconButton icon={<SettingsIcon />} size="sm" onClick={onSettingsOpen} aria-label="Configurações da Agenda" />
          </Tooltip>
      </HStack>

      <Box flex="1" overflowX="auto" h="90%">
        <Box minW="700px" h="100%">
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}

            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}

            messages={{
              next: "Próximo", previous: "Anterior", today: "Hoje",
              month: "Mês", week: "Semana", day: "Dia", agenda: "Lista",
              date: "Data", time: "Hora", event: "Evento", noEventsInRange: "Sem agendamentos."
            }}
          />
        </Box>
      </Box>

      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedEvent ? 'Gerenciar Agendamento' : 'Novo Agendamento'}
            {selectedEvent && (
              <Badge ml={2} colorScheme={statusColors[selectedEvent.status]}>
                {selectedEvent.status}
              </Badge>
            )}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              {/* STATUS CONTROL (Só aparece se já existir) */}
              {selectedEvent && (
                <HStack w="100%" justify="space-between" bg={actionsBg} p={2} borderRadius="md">
                  <Text fontWeight="bold" fontSize="sm">Ações Rápidas:</Text>
                  <Menu>
                    <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />}>
                      Mudar Status
                    </MenuButton>
                    <MenuList>
                      <MenuItem onClick={() => handleStatusChange('confirmed')}>Confirmar</MenuItem>
                      <MenuItem onClick={() => handleStatusChange('completed')} icon={<CheckIcon color="green.500" />}>Concluir</MenuItem>
                      <MenuItem onClick={() => handleStatusChange('no_show')}>Não Compareceu</MenuItem>
                      <MenuItem onClick={() => handleStatusChange('cancelled')} color="red.500">Cancelar</MenuItem>
                    </MenuList>
                  </Menu>
                </HStack>
              )}

              <FormControl isRequired>
                <FormLabel>Título / Serviço</FormLabel>
                <Input
                  placeholder="Digite aqui o título ou serviço"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  size={{ base: 'lg', md: 'md' }}
                />
              </FormControl>

              <Stack direction={{ base: 'column', md: 'row' }} w="100%" spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Nome Cliente</FormLabel>
                  <Input
                    placeholder="João Silva"
                    value={newEvent.clientName}
                    onChange={(e) => setNewEvent({ ...newEvent, clientName: e.target.value })}
                    size={{ base: 'lg', md: 'md' }}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Telefone</FormLabel>
                  <Input
                    placeholder="11999999999"
                    value={newEvent.clientPhone}
                    onChange={(e) => setNewEvent({ ...newEvent, clientPhone: e.target.value })}
                    size={{ base: 'lg', md: 'md' }}
                  />
                </FormControl>
              </Stack>

              <Stack direction={{ base: 'column', md: 'row' }} w="100%" spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Início</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formatForInput(newEvent.start)}
                    onChange={(e) => setNewEvent({ ...newEvent, start: new Date(e.target.value) })}
                    size={{ base: 'lg', md: 'md' }}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Fim</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formatForInput(newEvent.end)}
                    onChange={(e) => setNewEvent({ ...newEvent, end: new Date(e.target.value) })}
                    size={{ base: 'lg', md: 'md' }}
                  />
                </FormControl>
              </Stack>

              {/* CORREÇÃO AQUI: Substituído FormHelperText por Text */}
              {state.businessConfig?.operatingHours && (
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Horário de funcionamento: {state.businessConfig.operatingHours.opening} às {state.businessConfig.operatingHours.closing}
                </Text>
              )}

              <FormControl>
                <FormLabel>Tipo</FormLabel>
                <Select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                >
                  <option value="servico">Prestação de Serviço</option>
                  <option value="orcamento">Orçamento / Avaliação</option>
                  <option value="retorno">Retorno</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter justifyContent="space-between">
            {selectedEvent ? (
              <Button colorScheme="red" leftIcon={<DeleteIcon />} onClick={handleDelete}>
                Cancelar
              </Button>
            ) : (
              <Box></Box>
            )}

            <HStack>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button colorScheme="blue" onClick={handleSave}>Salvar</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE FOLLOW-UP */}
      <Modal isOpen={isFollowUpOpen} onClose={onFollowUpClose} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Serviço Concluído!</ModalHeader>
          <ModalBody>
            <Text>Você deseja agendar o <b>Follow-up Automático</b> (mensagem pós-venda) para este cliente?</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => handleFollowUpChoice(false)}>
              Não, apenas concluir
            </Button>
            <Button colorScheme="green" onClick={() => handleFollowUpChoice(true)}>
              Sim, agendar Follow-up
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* MODAL DE CONFIGURAÇÕES DA AGENDA */}
      <Modal isOpen={isSettingsOpen} onClose={onSettingsClose}>
        <ModalOverlay />
        <ModalContent>
            <ModalHeader>Configurações da Agenda</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
                <FormControl>
                    <FormLabel>
                        Tempo Mínimo de Antecedência (Minutos)
                        <Tooltip label="Tempo mínimo entre agora e o próximo agendamento disponível. Ex: Se colocar 60 min, o cliente só verá vagas daqui a 1 hora.">
                            <TimeIcon ml={2} color="gray.500" />
                        </Tooltip>
                    </FormLabel>
                    <Input
                        type="number"
                        value={minNotice}
                        onChange={(e) => setMinNotice(Number(e.target.value))}
                    />
                    <Text fontSize="sm" color="gray.500" mt={2}>
                        Isso impede que a IA agende horários muito próximos de "agora".
                    </Text>
                </FormControl>
            </ModalBody>
            <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onSettingsClose}>Cancelar</Button>
                <Button colorScheme="blue" onClick={async () => {
                    try {
                        await businessAPI.updateConfig({ minSchedulingNoticeMinutes: minNotice });
                        toast({ title: 'Configuração salva!', status: 'success' });
                        onSettingsClose();
                    } catch (e) {
                        toast({ title: 'Erro ao salvar', status: 'error' });
                    }
                }}>
                    Salvar
                </Button>
            </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
};

export default ScheduleTab;