import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Card, CardHeader, CardBody, Heading, Table, Thead, Tbody, Tr, Th, Td,
  useToast, Center, Spinner, Text, useColorModeValue, Input
} from '@chakra-ui/react';
import { AttachmentIcon } from '@chakra-ui/icons';
import { businessAPI } from '../../services/api';

const ContactsTab = () => {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const response = await businessAPI.getContacts();
      setContacts(response.data);
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      toast({ title: 'Erro ao buscar contatos', status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsImporting(true);
      const response = await businessAPI.importContacts(formData);
      toast({
        title: 'Importação Concluída',
        description: `${response.data.imported} criados, ${response.data.updated} atualizados, ${response.data.failed} falhas.`,
        status: 'success',
        duration: 5000
      });
      fetchContacts();
    } catch (error) {
      console.error('Erro ao importar contatos:', error);
      toast({ title: 'Erro ao importar contatos', description: error.response?.data?.message, status: 'error' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <Center p={10}>
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Box>
      <Card bg={cardBg} shadow="sm">
        <CardHeader display="flex" justifyContent="space-between" alignItems="center">
          <Heading size="md">Contatos</Heading>
          <Box>
            <Input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              hidden
              ref={fileInputRef}
              onChange={handleImport}
            />
            <Button
              leftIcon={<AttachmentIcon />}
              colorScheme="brand"
              onClick={() => fileInputRef.current?.click()}
              isLoading={isImporting}
            >
              Importar CSV/XLSX
            </Button>
          </Box>
        </CardHeader>
        <CardBody overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Telefone</Th>
                <Th>Email</Th>
                <Th>Tags</Th>
              </Tr>
            </Thead>
            <Tbody>
              {contacts.map(contact => (
                <Tr key={contact._id}>
                  <Td fontWeight="medium">{contact.name}</Td>
                  <Td>{contact.phone}</Td>
                  <Td>{contact.email}</Td>
                  <Td>{contact.tags?.join(', ')}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {contacts.length === 0 && (
            <Text mt={4} color="gray.500" textAlign="center">Nenhum contato encontrado.</Text>
          )}
        </CardBody>
      </Card>
    </Box>
  );
};

export default ContactsTab;
