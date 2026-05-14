import React, { memo } from 'react';
import { Box, HStack, Icon, Text, Badge, useColorModeValue, Avatar } from '@chakra-ui/react';
import { FaWhatsapp, FaGlobe } from 'react-icons/fa';

const getTagStyle = (tag, tagColors) => {
  if (tagColors && tagColors[tag]) {
      return { bg: tagColors[tag], color: 'white' };
  }
  const colors = ['purple', 'green', 'blue', 'orange', 'red', 'teal'];
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return { colorScheme: colors[hash % colors.length] };
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    // Verifica se é um número do Brasil (começa com 55)
    if (cleaned.startsWith('55') && cleaned.length >= 12 && cleaned.length <= 13) {
        const ddd = cleaned.substring(2, 4);
        const prefix = cleaned.substring(4, cleaned.length - 4);
        const suffix = cleaned.substring(cleaned.length - 4);
        return `+55 (${ddd}) ${prefix}-${suffix}`;
    }
    // Caso não se enquadre no padrão BR, exibe como está ou aplica uma formatação simples
    if (cleaned.length > 0) {
        return `+${cleaned}`;
    }
    return phone;
};

const ContactItem = ({ contact, isSelected, onClick, tagColors }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');

  return (
    <Box
      p={3}
      bg={isSelected ? 'brand.50' : cardBg}
      borderBottom="1px solid"
      borderColor={gray50Bg}
      cursor="pointer"
      borderLeft={isSelected ? "4px solid" : "4px solid transparent"}
      borderLeftColor="brand.500"
      _hover={{ bg: 'gray.100' }}
      onClick={() => onClick(contact)}
    >
      <HStack align="start" spacing={3}>
         <Avatar
            size="md"
            name={contact.name || contact.phone}
            src={contact.profilePicUrl}
         />

         <Box flex="1">
            <HStack justify="space-between" mb={0}>
                <Text fontWeight="bold" fontSize="sm" noOfLines={1} maxW="70%">
                    {contact.name || formatPhone(contact.phone)}
                </Text>
                {contact.lastInteraction && (
                    <Text fontSize="xs" color="gray.500">{formatTime(contact.lastInteraction)}</Text>
                )}
            </HStack>

            <HStack spacing={1} mb={1}>
                 {contact.channel === 'whatsapp'
                   ? <Icon as={FaWhatsapp} color="green.500" boxSize={3} />
                   : <Icon as={FaGlobe} color="blue.500" boxSize={3} />
                 }
                 <Text fontSize="xs" color="gray.500">{formatPhone(contact.phone)}</Text>
            </HStack>

            {contact.tags && contact.tags.length > 0 && (
                <HStack mt={1} spacing={1} overflow="hidden">
                    {contact.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} fontSize="xx-small" {...getTagStyle(tag, tagColors)} borderRadius="full" px={1.5}>
                            {tag}
                        </Badge>
                    ))}
                    {contact.tags.length > 3 && (
                        <Text fontSize="xx-small" color="gray.500">+{contact.tags.length - 3}</Text>
                    )}
                </HStack>
            )}
         </Box>
      </HStack>
    </Box>
  );
};

export default memo(ContactItem);
