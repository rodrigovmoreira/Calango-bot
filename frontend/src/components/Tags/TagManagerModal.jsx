import React, { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Button, VStack, HStack, Input, Text, IconButton, useToast, Circle, Grid, GridItem,
  Box, FormControl, FormLabel, Popover, PopoverTrigger, PopoverContent, PopoverBody
} from '@chakra-ui/react';
import { DeleteIcon, EditIcon, CheckIcon, SmallCloseIcon } from '@chakra-ui/icons';
import { tagAPI } from '../../services/api';

const WHATSAPP_COLORS = [
  '#009588', // Teal
  '#075E54', // Dark Teal
  '#25D366', // Green (Logo)
  '#34B7F1', // Blue
  '#ECE5DD', // Chat Bg
  '#FFC107', // Amber
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#00BCD4', // Cyan
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#CDDC39', // Lime
  '#FFEB3B', // Yellow
  '#FF9800', // Orange
  '#FF5722', // Deep Orange
  '#795548', // Brown
  '#607D8B'  // Blue Grey
];

const TagManagerModal = ({ isOpen, onClose, onTagsUpdated }) => {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // New Tag State
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(WHATSAPP_COLORS[0]);

  // Editing State
  const [editingTagId, setEditingTagId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const { data } = await tagAPI.getAll();
      setTags(data);
    } catch (error) {
      console.error("Erro ao carregar tags:", error);
      toast({ title: "Erro ao carregar etiquetas.", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    try {
      await tagAPI.create({ name: newTagName, color: newTagColor });
      toast({ title: "Tag criada!", status: "success" });
      setNewTagName('');
      setNewTagColor(WHATSAPP_COLORS[0]);
      loadTags();
      if (onTagsUpdated) onTagsUpdated();
    } catch (error) {
       toast({ title: "Erro ao criar tag.", status: "error" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tag?")) return;
    try {
      await tagAPI.delete(id);
      toast({ title: "Tag excluída.", status: "success" });
      loadTags();
      if (onTagsUpdated) onTagsUpdated();
    } catch (error) {
      toast({ title: "Erro ao excluir tag.", status: "error" });
    }
  };

  const startEditing = (tag) => {
    setEditingTagId(tag._id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditingTagVersion(tag.__v);
  };

  const [editingTagVersion, setEditingTagVersion] = useState(null);

  const cancelEditing = () => {
    setEditingTagId(null);
    setEditName('');
    setEditColor('');
    setEditingTagVersion(null);
  };

  const saveEditing = async () => {
    try {
      await tagAPI.update(editingTagId, { name: editName, color: editColor, __v: editingTagVersion });
      toast({ title: "Tag atualizada!", status: "success" });
      setEditingTagId(null);
      setEditingTagVersion(null);
      loadTags();
      if (onTagsUpdated) onTagsUpdated();
    } catch (error) {
      if (error.response?.status === 409) {
          toast({ title: "Conflito de Versão", description: "Esta tag foi modificada por outro processo. Recarregue e tente novamente.", status: "error", duration: null, isClosable: true });
      } else {
          toast({ title: "Erro ao atualizar tag.", status: "error" });
      }
    }
  };

  const ColorPicker = ({ selectedColor, onSelect }) => (
    <Popover placement='bottom-start'>
      <PopoverTrigger>
        <Button size="xs" bg={selectedColor} _hover={{ bg: selectedColor }} width="30px" height="30px" borderRadius="full" border="2px solid white" boxShadow="sm" />
      </PopoverTrigger>
      <PopoverContent width="220px">
        <PopoverBody>
            <Grid templateColumns="repeat(5, 1fr)" gap={2}>
              {WHATSAPP_COLORS.map(color => (
                <GridItem key={color}>
                   <Circle
                     size="30px"
                     bg={color}
                     cursor="pointer"
                     onClick={() => onSelect(color)}
                     border={selectedColor === color ? '2px solid black' : 'none'}
                     _hover={{ transform: 'scale(1.1)' }}
                   />
                </GridItem>
              ))}
            </Grid>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Gerenciar Etiquetas</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {/* Create New Tag */}
          <HStack mb={6} spacing={2} align="end">
             <FormControl>
                <FormLabel fontSize="sm">Nova Etiqueta</FormLabel>
                <HStack>
                    <ColorPicker selectedColor={newTagColor} onSelect={setNewTagColor} />
                    <Input
                        placeholder="Nome da etiqueta..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <Button colorScheme="brand" onClick={handleCreate} isDisabled={!newTagName.trim()}>
                        Criar
                    </Button>
                </HStack>
             </FormControl>
          </HStack>

          <Text fontSize="sm" fontWeight="bold" mb={2}>Etiquetas Existentes</Text>
          <VStack align="stretch" spacing={2} maxH="400px" overflowY="auto">
            {tags.map(tag => (
              <Box key={tag._id} p={2} border="1px solid" borderColor="gray.200" borderRadius="md">
                  {editingTagId === tag._id ? (
                      <HStack>
                          <ColorPicker selectedColor={editColor} onSelect={setEditColor} />
                          <Input
                             value={editName}
                             onChange={(e) => setEditName(e.target.value)}
                             size="sm"
                          />
                          <IconButton icon={<CheckIcon />} size="sm" colorScheme="green" onClick={saveEditing} aria-label="Salvar" />
                          <IconButton icon={<SmallCloseIcon />} size="sm" onClick={cancelEditing} aria-label="Cancelar" />
                      </HStack>
                  ) : (
                      <HStack justify="space-between">
                          <HStack>
                              <Circle size="20px" bg={tag.color} />
                              <Text fontSize="md">{tag.name}</Text>
                          </HStack>
                          <HStack>
                              <IconButton icon={<EditIcon />} size="sm" variant="ghost" onClick={() => startEditing(tag)} aria-label="Editar" />
                              <IconButton icon={<DeleteIcon />} size="sm" variant="ghost" colorScheme="red" onClick={() => handleDelete(tag._id)} aria-label="Excluir" />
                          </HStack>
                      </HStack>
                  )}
              </Box>
            ))}
            {tags.length === 0 && !isLoading && (
                <Text color="gray.500" textAlign="center" py={4}>Nenhuma etiqueta encontrada.</Text>
            )}
          </VStack>

        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Fechar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TagManagerModal;
