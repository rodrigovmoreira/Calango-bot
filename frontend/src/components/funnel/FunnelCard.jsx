import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Box, Text, HStack, Avatar, Flex, useColorModeValue, Tooltip } from '@chakra-ui/react';
import moment from 'moment';

const FunnelCard = ({ contact, index }) => {
  const bg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Helper to format currency
  const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Helper for relative time
  const timeAgo = (date) => {
    if (!date) return 'Nunca';
    return moment(date).fromNow(true); // "2 hours" (without "ago" suffix/prefix usually, or customizable)
  };

  return (
    <Draggable draggableId={contact._id} index={index}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          bg={bg}
          p={3}
          mb={3}
          borderRadius="md"
          boxShadow={snapshot.isDragging ? "lg" : "sm"}
          border="1px solid"
          borderColor={borderColor}
          _hover={{ boxShadow: 'md', borderColor: 'brand.300' }}
          opacity={snapshot.isDragging ? 0.9 : 1}
        >
          <HStack justify="space-between" mb={2}>
            <HStack>
              <Avatar size="xs" name={contact.name} src={contact.profilePicUrl} />
              <Text fontWeight="bold" fontSize="sm" noOfLines={1} maxW="150px">
                {contact.name || contact.phone}
              </Text>
            </HStack>
            <HStack spacing={2}>
              {/* === ASSIGNED OPERATOR AVATAR (Ponto 3) === */}
              {contact.assignedTo && (
                <Tooltip label={contact.assignedTo.name || 'Assigned'} placement="top">
                  <Avatar 
                    size="xs" 
                    name={contact.assignedTo.name} 
                    src={contact.assignedTo.avatarUrl}
                    cursor="pointer"
                    borderWidth="2px"
                    borderColor="brand.500"
                  />
                </Tooltip>
              )}
              {contact.lastInteraction && (
                <Text fontSize="xs" color="gray.500" minW="50px" textAlign="right">
                  {timeAgo(contact.lastInteraction)}
                </Text>
              )}
            </HStack>
          </HStack>

          <Flex justify="space-between" align="center">
            <Text fontWeight="bold" color="green.500" fontSize="sm">
              {formatMoney(contact.dealValue)}
            </Text>
            {/* Tag or other info could go here */}
          </Flex>

          {contact.notes && (
             <Text fontSize="xs" color="gray.400" mt={2} noOfLines={2}>
               {contact.notes}
             </Text>
          )}
        </Box>
      )}
    </Draggable>
  );
};

export default React.memo(FunnelCard);
