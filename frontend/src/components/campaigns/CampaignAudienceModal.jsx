import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Button, Tabs, TabList, TabPanels, Tab, TabPanel,
  Table, Thead, Tbody, Tr, Th, Td, Badge, Text, Spinner, Center, Box
} from '@chakra-ui/react';
import axios from 'axios';

const CampaignAudienceModal = ({ campaign, isOpen, onClose }) => {
  const [data, setData] = useState({ sent: [], pending: [], totalPending: 0, totalSent: 0 });
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  const fetchAudience = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/campaigns/${campaign._id}/audience`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (error) {
      console.error("Error fetching audience:", error);
    } finally {
      setLoading(false);
    }
  }, [campaign, API_URL]);

  useEffect(() => {
    if (isOpen && campaign) {
      fetchAudience();
    }
  }, [isOpen, campaign, fetchAudience]);

  const renderTable = (contacts, type) => {
    if (contacts.length === 0) {
        return <Text color="gray.500" p={4} textAlign="center">Nenhum contato encontrado.</Text>;
    }
    return (
      <Box maxH="400px" overflowY="auto" overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Telefone</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {contacts.map(contact => (
              <Tr key={contact._id}>
                <Td>{contact.name}</Td>
                <Td>{contact.phone}</Td>
                <Td>
                  {type === 'pending' ? (
                    <Badge colorScheme="orange">Aguardando</Badge>
                  ) : (
                    <Badge colorScheme="green">Enviado</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
            Audiência: {campaign?.name}
            <Text fontSize="sm" fontWeight="normal" color="gray.500">
                Status: {campaign?.status}
            </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {loading ? (
            <Center h="200px"><Spinner /></Center>
          ) : (
            <Tabs isFitted variant="enclosed">
              <TabList mb="1em">
                <Tab>
                    Fila de Envio ({data.totalPending})
                </Tab>
                <Tab>
                    Já Enviados ({data.totalSent})
                </Tab>
              </TabList>
              <TabPanels>
                <TabPanel p={0}>
                  {renderTable(data.pending, 'pending')}
                </TabPanel>
                <TabPanel p={0}>
                  {renderTable(data.sent, 'sent')}
                </TabPanel>
              </TabPanels>
            </Tabs>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CampaignAudienceModal;
