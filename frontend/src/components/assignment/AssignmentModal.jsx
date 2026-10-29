import React, { useState, useEffect } from 'react';
import { Modal,  ModalOverlay,  ModalContent,  ModalHeader,  ModalFooter,  ModalBody,  ModalCloseButton,
  Button,  Select,  VStack,  Text,  useToast } from '@chakra-ui/react';
import { businessAPI } from '../../services/api';

// O time vem de /business/team como { id, name, email, role } e o contato
// pode trazer assignedTo populado ({_id,name}) ou como ObjectId.
const memberId = (m) => m?._id || m?.id;
const assignedId = (contact) => contact?.assignedTo?._id || contact?.assignedTo || '';

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
  const [selectedUserId, setSelectedUserId] = useState(assignedId(contact));
  const [isLoading, setIsLoading] = useState(false);

  // O modal é montado uma vez e reutilizado para contatos diferentes:
  // sem este reset ele abriria com o responsável do contato anterior.
  useEffect(() => {
    if (isOpen) setSelectedUserId(assignedId(contact));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contact?._id]);

  const handleAssign = async () => {
    try {
      setIsLoading(true);

      // assignedTo can be null (to unassign) or a userId
      const assignTo = selectedUserId || null;

      const { data: updatedContact } = await businessAPI.assignContact(
        contact._id,
        assignTo,
        contact.__v
      );

      toast({
        title: 'Sucesso',
        description: assignTo
          ? `Contato atribuído a ${teamMembers.find(m => memberId(m) === selectedUserId)?.name || 'membro'}`
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
                  <option key={memberId(member)} value={memberId(member)}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </Select>
            </div>

            {selectedUserId && (
              <Text fontSize="sm" color="gray.600">
                Atualmente atribuído a:{' '}
                <strong>
                  {teamMembers.find((m) => memberId(m) === selectedUserId)?.name}
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
            isDisabled={!selectedUserId && !assignedId(contact)}
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
