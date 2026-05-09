import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Flex, useToast } from '@chakra-ui/react';
import FunnelColumn from './FunnelColumn';
import { businessAPI } from '../../services/api';
import { groupContacts } from '../../utils/funnelUtils';

const FunnelBoard = ({ columns, contacts, onUpdateStep }) => {
  const [boardData, setBoardData] = useState({});
  const toast = useToast();

  // Initialize/Reset Board Data when props change
  useEffect(() => {
    const initialData = groupContacts(contacts, columns);
    setBoardData(initialData);
  }, [columns, contacts]);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside
    if (!destination) return;

    // Dropped in same place
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    // Clone source and dest lists
    const sourceList = [...boardData[sourceColId]];
    const destList = sourceColId === destColId ? sourceList : [...boardData[destColId]];

    // Move contact
    const [movedContact] = sourceList.splice(source.index, 1);

    // Prepare updated contact object for local state (Optimistic UI)
    const currentTags = movedContact.tags || [];
    let newTags = currentTags;

    if (sourceColId !== destColId) {
      // Remove source tag, Add destination tag
      newTags = currentTags.filter(t => t !== sourceColId).concat(destColId);
    }

    const updatedContact = { ...movedContact, tags: newTags };
    destList.splice(destination.index, 0, updatedContact);

    const newBoardData = {
      ...boardData,
      [sourceColId]: sourceList,
      [destColId]: destList
    };

    // Optimistic Update
    setBoardData(newBoardData);

    // Call API if column changed
    if (sourceColId !== destColId) {
      try {
        await businessAPI.updateContact(draggableId, { tags: newTags, __v: movedContact.__v });
      } catch (error) {
        console.error("Failed to update contact tags:", error);
        if (error.response?.status === 409) {
            toast({
              title: 'Conflito de Versão',
              description: 'O contato foi modificado por outro processo. Recarregue a página para continuar.',
              status: 'error',
              duration: null,
              isClosable: true,
            });
        } else {
            toast({
              title: 'Erro ao mover contato',
              description: 'Não foi possível salvar a alteração.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
        }
        // Revert UI change
        setBoardData(boardData);
      }
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Flex
        h="full"
        direction={{ base: 'column', md: 'row' }}
        overflowX={{ base: 'hidden', md: 'auto' }}
        overflowY={{ base: 'auto', md: 'hidden' }}
        pb={4}
        css={{
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#CBD5E0',
            borderRadius: '24px',
          },
        }}
      >
        {columns
          .sort((a, b) => a.order - b.order)
          .map(step => (
            <FunnelColumn
              key={step.tag}
              droppableId={step.tag}
              step={step}
              contacts={boardData[step.tag] || []}
              onUpdateStep={onUpdateStep}
            />
        ))}
      </Flex>
    </DragDropContext>
  );
};

export default FunnelBoard;
