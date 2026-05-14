import React, { useState, useRef } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  useToast,
  Icon,
  Input,
  Box,
  Link
} from '@chakra-ui/react';
import { FaCloudUploadAlt, FaFileCsv, FaFileExcel } from 'react-icons/fa';
import { businessAPI } from '../../services/api';

const ImportModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await businessAPI.importContacts(formData);
      const { imported, updated, failed } = response.data;

      toast({
        title: "Importação Concluída",
        description: `Novos: ${imported} | Atualizados: ${updated} | Falhas: ${failed}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      onClose();
      setFile(null); // Reset
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Erro na Importação",
        description: "Falha ao processar arquivo. Verifique o formato.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Importar Contatos</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              Faça upload de um arquivo .csv ou .xlsx com as colunas:
              <b> name, phone, email, tags</b>.
            </Text>

            <Box
              w="100%"
              h="150px"
              border="2px dashed"
              borderColor={file ? "green.300" : "gray.300"}
              borderRadius="md"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              bg={file ? "green.50" : "gray.50"}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              cursor="pointer"
              onClick={() => inputRef.current.click()}
              transition="all 0.2s"
              _hover={{ borderColor: "brand.500", bg: "gray.100" }}
            >
              <Input
                type="file"
                ref={inputRef}
                display="none"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
              />

              {file ? (
                <>
                  <Icon as={file.name.endsWith('.csv') ? FaFileCsv : FaFileExcel} boxSize={8} color="green.500" mb={2} />
                  <Text fontWeight="bold">{file.name}</Text>
                </>
              ) : (
                <>
                  <Icon as={FaCloudUploadAlt} boxSize={10} color="gray.400" mb={2} />
                  <Text color="gray.500">Arraste ou Clique para Selecionar</Text>
                </>
              )}
            </Box>

            {/* Template Download Link */}
             <Text fontSize="xs" color="gray.400">
                <Link color="blue.500" href="#" onClick={(e) => {
                    e.preventDefault();
                    // Create a dummy CSV
                    const csvContent = "data:text/csv;charset=utf-8,name,phone,email,tags\nExemplo,5511999999999,exemplo@email.com,cliente-vip";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "template_contatos.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }}>
                    Baixar Modelo de importação em CSV
                </Link>
             </Text>

          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancelar
          </Button>
          <Button colorScheme="brand" onClick={handleImport} isLoading={isUploading} isDisabled={!file}>
            Importar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportModal;
