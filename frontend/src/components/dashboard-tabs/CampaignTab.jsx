import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Button, Card, CardBody, Heading, Text, VStack, HStack, Badge,
  Table, Thead, Tbody, Tr, Th, Td, IconButton, useDisclosure,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  FormControl, FormLabel, Input, Select, Textarea, useToast, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper, Checkbox, SimpleGrid,
  RadioGroup, Radio, Stack, FormHelperText
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, TimeIcon, CalendarIcon } from '@chakra-ui/icons';
// Using direct axios for this specific module as it is not fully integrated into standard services yet,
// but auth headers are handled carefully.
import axios from 'axios';
import { SmallCloseIcon, ViewIcon } from '@chakra-ui/icons';
import CampaignAudienceModal from '../campaigns/CampaignAudienceModal';
import TagAutocomplete from '../Tags/TagAutocomplete';

const CampaignTab = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [currentCampaign, setCurrentCampaign] = useState(null);

  // Modal states
  const { isOpen, onOpen, onClose } = useDisclosure(); // Edit/Create Modal
  const { isOpen: isAudienceOpen, onOpen: onAudienceOpen, onClose: onAudienceClose } = useDisclosure(); // Audience Modal
  const [audienceCampaign, setAudienceCampaign] = useState(null);

  const toast = useToast();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const DAYS_OF_WEEK = [
      { label: 'Dom', value: 0 },
      { label: 'Seg', value: 1 },
      { label: 'Ter', value: 2 },
      { label: 'Qua', value: 3 },
      { label: 'Qui', value: 4 },
      { label: 'Sex', value: 5 },
      { label: 'Sab', value: 6 }
  ];

  const loadCampaigns = useCallback(async () => {
      try {
          const token = localStorage.getItem('token');
          const { data } = await axios.get(`${API_URL}/api/campaigns`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          console.log('Campaigns fetched:', data);
          setCampaigns(data);
      } catch (error) {
          toast({ title: 'Erro ao carregar campanhas', status: 'error' });
      }
  }, [API_URL, toast]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);



  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
          ...currentCampaign,
          __v: currentCampaign.__v,
          // Ensure targetTags is array (it should already be array with new UI, but keeping safeguard)
          targetTags: Array.isArray(currentCampaign.targetTags)
            ? currentCampaign.targetTags
            : (typeof currentCampaign.targetTags === 'string'
                ? currentCampaign.targetTags.split(',').map(t => t.trim()).filter(Boolean)
                : [])
      };

      if (currentCampaign._id) {
        await axios.put(`${API_URL}/api/campaigns/${currentCampaign._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: 'Campanha atualizada!', status: 'success' });
      } else {
        await axios.post(`${API_URL}/api/campaigns`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast({ title: 'Campanha criada!', status: 'success' });
      }
      onClose();
      loadCampaigns();
    } catch (error) {
      if (error.response?.status === 409) {
          toast({ title: 'Conflito de Versão', description: 'Esta campanha foi modificada por outro processo. Recarregue a tela e tente novamente.', status: 'error', duration: null, isClosable: true });
      } else {
          toast({ title: 'Erro ao salvar', status: 'error' });
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir campanha?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadCampaigns();
      toast({ title: 'Removido', status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao excluir', status: 'error' });
    }
  };

  const toggleDay = (dayValue) => {
      const currentDays = currentCampaign?.schedule?.days || [];
      const newDays = currentDays.includes(dayValue)
          ? currentDays.filter(d => d !== dayValue)
          : [...currentDays, dayValue];

      setCurrentCampaign({
          ...currentCampaign,
          schedule: { ...currentCampaign.schedule, days: newDays }
      });
  };

  const openModal = (campaign = null) => {
    let ui_offsetUnit = 'minutes';
    if (campaign && campaign.eventOffset) {
        if (campaign.eventOffset % 1440 === 0 && campaign.eventOffset !== 0) ui_offsetUnit = 'days';
        else if (campaign.eventOffset % 60 === 0 && campaign.eventOffset !== 0) ui_offsetUnit = 'hours';
    } else {
        ui_offsetUnit = 'hours';
    }

    if (campaign) {
      setCurrentCampaign({
          ...campaign,
          // Explicitly set contentMode to ensure persistence as per bug report
          contentMode: (campaign.contentMode === 'ai_prompt' || campaign.contentMode === 'static')
            ? campaign.contentMode
            : 'static',
          targetTags: Array.isArray(campaign.targetTags) ? campaign.targetTags : [],
          triggerType: campaign.triggerType || 'time',
          eventOffset: campaign.eventOffset !== undefined ? campaign.eventOffset : 60,
          eventTargetStatus: campaign.eventTargetStatus || ['scheduled', 'confirmed'],
          ui_offsetUnit
      });
    } else {
      setCurrentCampaign({
        name: '',
        contentMode: 'static',
        type: 'broadcast',
        targetTags: [], // Initialize as empty array
        message: '',
        isActive: true,
        triggerType: 'time',
        eventOffset: 60,
        eventTargetStatus: ['scheduled', 'confirmed'],
        schedule: { frequency: 'once', time: '09:00', days: [] },
        delayRange: { min: 5, max: 15 },
        ui_offsetUnit: 'hours'
      });
    }
    onOpen();
  };

  const toggleTag = (tag) => {
      const currentTags = Array.isArray(currentCampaign.targetTags) ? currentCampaign.targetTags : [];
      const newTags = currentTags.includes(tag)
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag];

      setCurrentCampaign({ ...currentCampaign, targetTags: newTags });
  };

  const renderStatusBadge = (campaign) => {
      if (campaign.status === 'completed') {
          return <Badge colorScheme="gray">CONCLUÍDO</Badge>;
      }
      if (campaign.processing) {
          return <Badge colorScheme="green">ENVIANDO</Badge>;
      }
      if (campaign.isActive) {
           // Check if future scheduled
           if (campaign.nextRun && new Date(campaign.nextRun) > new Date()) {
               return <Badge colorScheme="blue">AGENDADO</Badge>;
           }
           // Default active
           return <Badge colorScheme="green">ATIVO</Badge>;
      }
      return <Badge colorScheme="orange">PAUSADO</Badge>;
  };

  const openAudienceModal = (campaign) => {
      setAudienceCampaign(campaign);
      onAudienceOpen();
  };

  return (
    <Box>
      <Stack direction={{ base: 'column', md: 'row' }} justify="space-between" mb={6} spacing={4}>
        <Heading size="md">Automação & Funis</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="brand" onClick={() => openModal()}>
          Nova Campanha
        </Button>
      </Stack>

      {campaigns.length === 0 ? (
        <Card>
            <CardBody>
                <Text color="gray.500">Nenhuma campanha configurada.</Text>
            </CardBody>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card display={{ base: 'none', md: 'block' }}>
            <CardBody>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                  <Th>Nome</Th>
                  <Th>Tipo</Th>
                  <Th>Alvo (Tags)</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {campaigns.map((c) => (
                  <Tr key={c._id}>
                    <Td fontWeight="bold">{c.name}</Td>
                    <Td>
                      <Badge colorScheme={c.type === 'recurring' ? 'purple' : 'blue'}>
                        {c.type === 'recurring' ? 'Recorrente' : 'Broadcast'}
                      </Badge>
                    </Td>
                    <Td>
                      {c.targetTags && c.targetTags.length > 0 ? (
                          c.targetTags.map(t => <Badge key={t} mr={1} variant="outline">{t}</Badge>)
                      ) : <Text fontSize="xs" color="gray.400">Todos</Text>}
                    </Td>
                    <Td>
                        {renderStatusBadge(c)}
                    </Td>
                    <Td>
                      <IconButton
                          icon={<ViewIcon />}
                          size="sm"
                          mr={2}
                          colorScheme="teal"
                          variant="ghost"
                          onClick={() => openAudienceModal(c)}
                          title="Ver Audiência"
                      />
                      <IconButton icon={<EditIcon />} size="sm" mr={2} onClick={() => openModal(c)} />
                      <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => handleDelete(c._id)} />
                    </Td>
                  </Tr>
                ))}
                  </Tbody>
                </Table>
              </Box>
            </CardBody>
          </Card>

          {/* Mobile Card View */}
          <VStack spacing={4} display={{ base: 'flex', md: 'none' }}>
            {campaigns.map((c) => (
              <Card key={c._id} w="100%" variant="outline">
                <CardBody p={4}>
                  <VStack align="stretch" spacing={3}>
                    <HStack justify="space-between">
                      <Text fontWeight="bold" fontSize="lg">{c.name}</Text>
                      {renderStatusBadge(c)}
                    </HStack>

                    <HStack>
                      <Badge colorScheme={c.type === 'recurring' ? 'purple' : 'blue'}>
                        {c.type === 'recurring' ? 'Recorrente' : 'Broadcast'}
                      </Badge>
                      <HStack flexWrap="wrap" spacing={1}>
                        {c.targetTags && c.targetTags.length > 0 ? (
                            c.targetTags.map(t => <Badge key={t} variant="outline" fontSize="xs">{t}</Badge>)
                        ) : <Text fontSize="xs" color="gray.400">Todos</Text>}
                      </HStack>
                    </HStack>

                    <HStack justify="flex-end" pt={2}>
                      <IconButton
                          icon={<ViewIcon />}
                          size="lg"
                          colorScheme="teal"
                          variant="ghost"
                          onClick={() => openAudienceModal(c)}
                          aria-label="Ver Audiência"
                      />
                      <IconButton
                          icon={<EditIcon />}
                          size="lg"
                          variant="ghost"
                          onClick={() => openModal(c)}
                          aria-label="Editar"
                      />
                      <IconButton
                          icon={<DeleteIcon />}
                          size="lg"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleDelete(c._id)}
                          aria-label="Excluir"
                      />
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </>
      )}

      {/* Audience Report Modal */}
      {audienceCampaign && (
          <CampaignAudienceModal
            campaign={audienceCampaign}
            isOpen={isAudienceOpen}
            onClose={onAudienceClose}
          />
      )}

      {/* Modal Create/Edit */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
            <form onSubmit={handleSave}>
              <ModalHeader>{currentCampaign?._id ? 'Editar Campanha' : 'Nova Campanha'}</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                        <FormLabel>Nome da Campanha</FormLabel>
                        <Input
                            value={currentCampaign?.name || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, name: e.target.value})}
                            size={{ base: 'lg', md: 'md' }}
                        />
                    </FormControl>

                    <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                        <FormControl>
                            <FormLabel>Tipo</FormLabel>
                            <Select
                                value={currentCampaign?.type}
                                onChange={e => setCurrentCampaign({...currentCampaign, type: e.target.value})}
                                size={{ base: 'lg', md: 'md' }}
                            >
                                <option value="broadcast">Broadcast (Disparo Único)</option>
                                <option value="recurring">Recorrente (Ex: Cobrança)</option>
                            </Select>
                        </FormControl>

                        <FormControl>
                            <FormLabel>Status</FormLabel>
                            <Select
                                value={currentCampaign?.isActive ? 'true' : 'false'}
                                onChange={e => setCurrentCampaign({...currentCampaign, isActive: e.target.value === 'true'})}
                                size={{ base: 'lg', md: 'md' }}
                            >
                                <option value="true">Ativo</option>
                                <option value="false">Pausado</option>
                            </Select>
                        </FormControl>
                    </Stack>

                    <FormControl>
                        <FormLabel>Tags Alvo</FormLabel>
                        <Box mb={2}>
                            <TagAutocomplete
                                placeholder="Adicionar Tag..."
                                existingTags={currentCampaign?.targetTags || []}
                                onSelect={(tagName) => {
                                    const currentTags = currentCampaign?.targetTags || [];
                                    if (!currentTags.includes(tagName)) {
                                        setCurrentCampaign({
                                            ...currentCampaign,
                                            targetTags: [...currentTags, tagName]
                                        });
                                    }
                                }}
                            />
                        </Box>

                        {/* Selected Tags Display */}
                        <HStack mt={2} wrap="wrap" spacing={2}>
                            {currentCampaign?.targetTags?.map(tag => (
                                <Badge key={tag} colorScheme="brand" borderRadius="full" px={2} py={1} display="flex" alignItems="center">
                                    {tag}
                                    <SmallCloseIcon
                                        ml={1}
                                        cursor="pointer"
                                        onClick={() => toggleTag(tag)} // Reuse toggleTag to remove
                                        _hover={{ color: 'red.500' }}
                                    />
                                </Badge>
                            ))}
                        </HStack>
                    </FormControl>

                    <FormControl mb={4}>
                        <FormLabel>Modo de Conteúdo</FormLabel>
                        <RadioGroup
                            value={currentCampaign?.contentMode}
                            onChange={val => setCurrentCampaign({...currentCampaign, contentMode: val})}
                        >
                            <Stack direction={{ base: 'column', sm: 'row' }} spacing={4}>
                                <Radio value="static">Mensagem Fixa (Padrão)</Radio>
                                <Radio value="ai_prompt">Gerado por IA (Dinâmico)</Radio>
                            </Stack>
                        </RadioGroup>
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel>
                            {currentCampaign?.contentMode === 'ai_prompt' ? 'Instrução para a IA' : 'Mensagem'}
                        </FormLabel>
                        <Textarea
                            rows={4}
                            value={currentCampaign?.message || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, message: e.target.value})}
                            placeholder={currentCampaign?.contentMode === 'ai_prompt'
                                ? "Ex: Analise a última conversa e convide o {nome} para retornar, oferecendo 10% de desconto. Use um tom amigável."
                                : ""}
                            size={{ base: 'lg', md: 'md' }}
                        />
                        {currentCampaign?.contentMode === 'ai_prompt' && (
                             <Text fontSize="sm" color="orange.500" mt={1}>
                                <i className="fas fa-info-circle"></i> A IA usará o histórico da conversa para personalizar esta mensagem para cada cliente.
                             </Text>
                        )}
                        <FormHelperText>
                            Variáveis disponíveis: {'{nome_cliente}'}
                            {currentCampaign?.triggerType === 'event' && ', {data_agendamento}, {hora_agendamento}'}.
                        </FormHelperText>
                    </FormControl>

                    <FormControl>
                        <FormLabel>Gatilho de Envio</FormLabel>
                        <RadioGroup
                            value={currentCampaign?.triggerType}
                            onChange={val => setCurrentCampaign({...currentCampaign, triggerType: val})}
                        >
                            <Stack direction={{ base: 'column', sm: 'row' }} spacing={4}>
                                <Radio value="time">Horário Fixo / Recorrente</Radio>
                                <Radio value="event">Lembrete da Agenda</Radio>
                            </Stack>
                        </RadioGroup>
                    </FormControl>

                    {currentCampaign?.triggerType === 'time' ? (
                        <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md">
                            <Heading size="sm" mb={3} display="flex" alignItems="center">
                                <TimeIcon mr={2} /> Agendamento
                            </Heading>
                            <Stack direction={{ base: 'column', md: 'row' }} alignItems="flex-start" spacing={4}>
                                <FormControl>
                                    <FormLabel>Frequência</FormLabel>
                                    <Select
                                        value={currentCampaign?.schedule?.frequency}
                                        onChange={e => setCurrentCampaign({
                                            ...currentCampaign,
                                            schedule: { ...currentCampaign.schedule, frequency: e.target.value }
                                        })}
                                        size={{ base: 'lg', md: 'md' }}
                                    >
                                        <option value="once">Uma vez</option>
                                        <option value="daily">Diário</option>
                                        <option value="weekly">Semanal</option>
                                        <option value="monthly">Mensal</option>
                                        <option value="minutes_1">A cada 1 minuto (Teste)</option>
                                        <option value="minutes_30">A cada 30 min</option>
                                        <option value="hours_1">A cada 1 Hora</option>
                                        <option value="hours_6">A cada 6 Horas</option>
                                        <option value="hours_12">A cada 12 Horas</option>
                                    </Select>
                                </FormControl>

                                {/* Use a function to check visibility for clarity */}
                                {(() => {
                                    const freq = currentCampaign?.schedule?.frequency;
                                    const isInterval = ['minutes_1', 'minutes_30', 'hours_1', 'hours_6', 'hours_12'].includes(freq);
                                    if (isInterval) return null;

                                    return (
                                        <FormControl>
                                            <FormLabel>Horário</FormLabel>
                                            <Input
                                                type="time"
                                                value={currentCampaign?.schedule?.time}
                                                onChange={e => setCurrentCampaign({
                                                    ...currentCampaign,
                                                    schedule: { ...currentCampaign.schedule, time: e.target.value }
                                                })}
                                                size={{ base: 'lg', md: 'md' }}
                                            />
                                        </FormControl>
                                    );
                                })()}
                            </Stack>

                            {/* Weekly Days Selector */}
                            {currentCampaign?.schedule?.frequency === 'weekly' && (
                                <FormControl mt={3}>
                                    <FormLabel fontSize="sm">Dias da Semana</FormLabel>
                                    <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={2}>
                                        {DAYS_OF_WEEK.map(day => (
                                            <Checkbox
                                                key={day.value}
                                                isChecked={currentCampaign?.schedule?.days?.includes(day.value)}
                                                onChange={() => toggleDay(day.value)}
                                                size="lg"
                                            >
                                                {day.label}
                                            </Checkbox>
                                        ))}
                                    </SimpleGrid>
                                </FormControl>
                            )}
                        </Box>
                    ) : (
                        <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md">
                            <Heading size="sm" mb={3} display="flex" alignItems="center">
                                <CalendarIcon mr={2} /> Regra de Agendamento
                            </Heading>
                            <Stack direction={{ base: 'column', md: 'row' }} alignItems="flex-end" spacing={4}>
                                <FormControl>
                                    <FormLabel>Enviar com antecedência de</FormLabel>
                                    <NumberInput
                                        min={1}
                                        value={currentCampaign?.eventOffset / (currentCampaign?.ui_offsetUnit === 'days' ? 1440 : currentCampaign?.ui_offsetUnit === 'hours' ? 60 : 1)}
                                        onChange={(str, num) => {
                                            const multiplier = currentCampaign?.ui_offsetUnit === 'days' ? 1440 : currentCampaign?.ui_offsetUnit === 'hours' ? 60 : 1;
                                            setCurrentCampaign({
                                                ...currentCampaign,
                                                eventOffset: num * multiplier
                                            });
                                        }}
                                        size={{ base: 'lg', md: 'md' }}
                                    >
                                        <NumberInputField />
                                        <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                    </NumberInput>
                                </FormControl>
                                <FormControl w={{ base: 'full', md: '150px' }}>
                                    <Select
                                        value={currentCampaign?.ui_offsetUnit}
                                        onChange={e => setCurrentCampaign({...currentCampaign, ui_offsetUnit: e.target.value})}
                                        size={{ base: 'lg', md: 'md' }}
                                    >
                                        <option value="minutes">Minutos</option>
                                        <option value="hours">Horas</option>
                                        <option value="days">Dias</option>
                                    </Select>
                                </FormControl>
                            </Stack>
                            <Text fontSize="xs" color="gray.500" mt={2}>
                                O sistema verificará agendamentos com status: {currentCampaign?.eventTargetStatus?.join(', ')}
                            </Text>
                        </Box>
                    )}

                    <Box border="1px solid" borderColor="gray.200" p={4} borderRadius="md">
                        <Heading size="sm" mb={3}>Humanização (Delay)</Heading>
                        <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                            <FormControl>
                                <FormLabel>Min (Segundos)</FormLabel>
                                <NumberInput
                                    min={0}
                                    value={currentCampaign?.delayRange?.min}
                                    onChange={(str, num) => setCurrentCampaign({
                                        ...currentCampaign,
                                        delayRange: { ...currentCampaign.delayRange, min: num }
                                    })}
                                    size={{ base: 'lg', md: 'md' }}
                                >
                                    <NumberInputField />
                                    <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                </NumberInput>
                            </FormControl>
                            <FormControl>
                                <FormLabel>Max (Segundos)</FormLabel>
                                <NumberInput
                                    min={0}
                                    value={currentCampaign?.delayRange?.max}
                                    onChange={(str, num) => setCurrentCampaign({
                                        ...currentCampaign,
                                        delayRange: { ...currentCampaign.delayRange, max: num }
                                    })}
                                    size={{ base: 'lg', md: 'md' }}
                                >
                                    <NumberInputField />
                                    <NumberInputStepper><NumberIncrementStepper /><NumberDecrementStepper /></NumberInputStepper>
                                </NumberInput>
                            </FormControl>
                        </Stack>
                    </Box>

                </VStack>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
                <Button colorScheme="brand" type="submit">Salvar Campanha</Button>
              </ModalFooter>
            </form>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CampaignTab;
