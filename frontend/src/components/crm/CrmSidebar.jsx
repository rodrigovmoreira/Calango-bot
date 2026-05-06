import React, { useState, useEffect } from 'react';
import {
  Box, VStack, Text, FormControl, FormLabel, Select, Textarea,
  Button, Badge, Icon, IconButton,
  InputGroup, InputLeftAddon,
  useColorModeValue, Flex, Input
} from '@chakra-ui/react';
import { SmallCloseIcon, CloseIcon } from '@chakra-ui/icons';
import TagAutocomplete from '../Tags/TagAutocomplete';

const CrmSidebar = ({ contact, onUpdate, availableTags, onAddTag, onRemoveTag, tagColors, onClose }) => {
  const [dealValue, setDealValue] = useState('0.00');
  const [funnelStage, setFunnelStage] = useState('new');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with contact (Hydration Fix)
  useEffect(() => {
    if (contact) {
      setDealValue(contact.dealValue !== undefined ? contact.dealValue.toString() : '0');
      setFunnelStage(contact.funnelStage || 'new');
      setNotes(contact.notes || '');
    }
  }, [contact]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Fix Currency Parsing (Brazilian Format)
      // Replace comma with dot to ensure parseFloat works correctly
      const normalizedValue = dealValue.toString().replace(',', '.');
      const numericValue = parseFloat(normalizedValue);
      const newDealValue = isNaN(numericValue) ? 0 : numericValue;

      // Intelligent Payload: only send fields that changed, plus __v
      const payload = { __v: contact.__v };

      const originalDealValue = contact.dealValue !== undefined ? contact.dealValue : 0;
      if (newDealValue !== originalDealValue) payload.dealValue = newDealValue;
      if (funnelStage !== (contact.funnelStage || 'new')) payload.funnelStage = funnelStage;
      if (notes !== (contact.notes || '')) payload.notes = notes;

      // Se nada mudou, opcionalmente a gente pode não disparar o update, mas pra garantir o fluxo:
      if (Object.keys(payload).length > 1) { // > 1 because __v is always there
          await onUpdate(payload);
      } else {
          // just to clear loading state if they click save without changes
          setIsSaving(false);
          return;
      }
    } catch (error) {
      // Error handling is managed by parent (LiveChatTab) via toast
      console.error("Failed to save CRM data", error);
    } finally {
      setIsSaving(false);
    }
  };

  const funnelOptions = [
    { value: 'new', label: 'Novos' },
    { value: 'negotiation', label: 'Em Negociação' },
    { value: 'scheduled', label: 'Agendado' },
    { value: 'closed_won', label: 'Venda Realizada' },
    { value: 'closed_lost', label: 'Perdido' }
  ];

  const getTagStyle = (tag) => {
      if (tagColors && tagColors[tag]) {
          return { bg: tagColors[tag], color: 'white' };
      }
      const colors = ['purple', 'green', 'blue', 'orange', 'red', 'teal'];
      const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return { colorScheme: colors[hash % colors.length] };
  };

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (!contact) return null;

  return (
    <Box
        w={{ base: "100%", md: "300px" }}
        h="100%"
        borderLeft={{ base: 'none', md: '1px solid' }}
        borderColor={borderColor}
        bg={bg}
        p={4}
        overflowY="auto"
        position="relative"
    >
      {/* Mobile Close Button */}
      <IconButton
        display={{ base: 'flex', md: 'none' }}
        icon={<CloseIcon />}
        size="sm"
        position="absolute"
        top={2}
        right={2}
        onClick={onClose}
        aria-label="Fechar CRM"
        variant="ghost"
      />

      <VStack spacing={5} align="stretch">
        <Text fontWeight="bold" fontSize="lg" mb={2}>Ficha do Cliente</Text>

        {/* Deal Value */}
        <FormControl>
          <FormLabel fontSize="sm" color="gray.500">Valor da Oportunidade</FormLabel>
          <InputGroup size={{ base: 'lg', md: 'sm' }}>
            <InputLeftAddon children="R$" />
            <Input
              type="text"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="0,00"
              borderTopLeftRadius={0}
              borderBottomLeftRadius={0}
            />
          </InputGroup>
        </FormControl>

        {/* Funnel Stage */}
        <FormControl>
          <FormLabel fontSize="sm" color="gray.500">Estágio do Funil</FormLabel>
          <Select
            value={funnelStage}
            onChange={(e) => setFunnelStage(e.target.value)}
            size={{ base: 'lg', md: 'sm' }}
          >
            {funnelOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormControl>

        {/* Tags */}
        <FormControl>
            <FormLabel fontSize="sm" color="gray.500">Tags</FormLabel>
            <Flex wrap="wrap" gap={2} mb={2}>
                {contact.tags && contact.tags.map(tag => (
                    <Badge key={tag} {...getTagStyle(tag)} borderRadius="full" px={2} py={1} display="flex" alignItems="center">
                        {tag}
                        <Icon as={SmallCloseIcon} ml={1} cursor="pointer" onClick={() => onRemoveTag(tag)} />
                    </Badge>
                ))}
            </Flex>

            <TagAutocomplete
                onSelect={onAddTag}
                existingTags={contact.tags || []}
            />
        </FormControl>

        {/* Notes */}
        <FormControl flex="1">
          <FormLabel fontSize="sm" color="gray.500">Anotações Internas</FormLabel>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comentários sobre o cliente..."
            size={{ base: 'lg', md: 'sm' }}
            minH="150px"
            resize="vertical"
          />
        </FormControl>

        {/* Action */}
        <Button
          colorScheme="brand"
          onClick={handleSave}
          w="full"
          isLoading={isSaving}
          loadingText="Salvando..."
          size={{ base: 'lg', md: 'md' }}
        >
          Salvar Dados
        </Button>

      </VStack>
    </Box>
  );
};

export default CrmSidebar;
