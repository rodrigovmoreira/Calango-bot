import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Select,
  VStack,
  Text,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { businessAPI } from '../../services/api';

/**
 * AssignmentModal - Modal for assigning a contact to a team member
 *
 * Props:
 * - isOpen: boolean - Whether the modal is open
 * - onClose: function - Callback to close the modal
 * - contact: object - The contact to assign (must include _id and __v)
 * - teamMembers: array - List of available team members to assign to
 * - onAssignSuccess: function - Callback after successful assignment (receives updated contact)
 */
const AssignmentModal = ({ isOpen, onClose, contact, teamMembers = [], onAssignSuccess }) => {
  const toast = useToast();
  const [selectedUserId, setSelectedUserId] = useState(contact?.assignedTo?._id || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleAssign = async () => {
    try {
      setIsLoading(true);

      // assignedTo can be null (to unassign) or a userId
      const assignTo = selectedUserId || null;

      const updatedContact = await businessAPI.assignContact(
        contact._id,
        assignTo,
        contact.__v
      );

      toast({
        title: 'Sucesso',
        description: assignTo
          ? `Contato atribuído a ${selectedUserId ? teamMembers.find(m => m._id === selectedUserId)?.name : 'ninguém'}`
          : 'Contato desatribuído',
        status: 'success',
        duration: 3,
        isClosable: true,
      });

      // Call success callback with updated contact
      if (onAssignSuccess) {
        onAssignSuccess(updatedContact);
      }

      onClose();
    } catch (error) {
      if (error.response?.status === 409) {
        toast({
          title: 'Conflito de Versão',
          description: 'Este contato foi modificado por outro usuário. Recarregue a página para ver as atualizações.',
          status: 'error',
          duration: 5,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro',
          description: error.response?.data?.message || 'Erro ao atribuir contato',
          status: 'error',
          duration: 3,
          isClosable: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Atribuir Contato</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <div>
              <Text fontSize="sm" fontWeight="bold" mb={2}>
                Contato: {contact?.name || contact?.phone}
              </Text>
              <Select
                placeholder="Selecione um membro da equipe"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                isDisabled={isLoading}
              >
                {teamMembers.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </Select>
            </div>

            {selectedUserId && (
              <Text fontSize="sm" color="gray.600">
                Atualmente atribuído a:{' '}
                <strong>
                  {teamMembers.find((m) => m._id === selectedUserId)?.name}
                </strong>
              </Text>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="ghost"
            mr={3}
            onClick={onClose}
            isDisabled={isLoading}
          >
            Cancelar
          </Button>
          {selectedUserId && (
            <Button
              colorScheme="red"
              mr={2}
              onClick={() => setSelectedUserId('')}
              isDisabled={isLoading}
            >
              Desatribuir
            </Button>
          )}
          <Button
            colorScheme="brand"
            onClick={handleAssign}
            isDisabled={!selectedUserId && !contact?.assignedTo}
            isLoading={isLoading}
            loadingText="Atribuindo..."
          >
            Atribuir
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AssignmentModal;
