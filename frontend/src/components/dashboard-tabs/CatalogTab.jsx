import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Badge, useColorModeValue, FormControl, FormLabel, Input, Textarea,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, IconButton, Tooltip, Spinner
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { businessAPI } from '../../services/api';

const CatalogTab = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');

  // Modal
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure();

  // State
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '', imageUrls: [], tags: [], variations: [] });
  const [editingProductIndex, setEditingProductIndex] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Sync
  useEffect(() => {
    if (state.businessConfig) {
      setProducts(state.businessConfig.products || []);
    }
  }, [state.businessConfig]);

  // Handlers
  const handleSaveProducts = async () => {
    try {
      const payload = { ...state.businessConfig, products };
      const res = await businessAPI.updateConfig(payload);
      dispatch({ type: 'SET_BUSINESS_CONFIG', payload: res.data });
      toast({ title: 'Catálogo salvo!', status: 'success' });
    } catch (e) { toast({ title: 'Erro ao salvar produtos', status: 'error' }); }
  };

  const handleAddProduct = () => {
    let finalTags = newProduct.tags;
    if (typeof finalTags === 'string') {
      finalTags = finalTags.split(',').map(t => t.trim()).filter(t => t);
    }

    const productToSave = { ...newProduct, tags: finalTags };
    const updated = [...products];
    if (editingProductIndex !== null) updated[editingProductIndex] = productToSave;
    else updated.push(productToSave);

    setProducts(updated);
    setNewProduct({ name: '', price: '', description: '', imageUrls: [], tags: [], variations: [] });
    setEditingProductIndex(null);
    onProductModalClose();
  };

  const addVariation = () => {
    setNewProduct({
      ...newProduct,
      variations: [...(newProduct.variations || []), { name: '', price: '', durationMinutes: 60 }]
    });
  };

  const updateVariation = (index, field, value) => {
    const updatedVariations = [...newProduct.variations];
    updatedVariations[index][field] = value;
    setNewProduct({ ...newProduct, variations: updatedVariations });
  };

  const removeVariation = (index) => {
    const updatedVariations = newProduct.variations.filter((_, i) => i !== index);
    setNewProduct({ ...newProduct, variations: updatedVariations });
  };

  const handleRemoveProduct = (idx) => setProducts(products.filter((_, i) => i !== idx));

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('image', file);
        return businessAPI.uploadImage(formData);
      });
      const responses = await Promise.all(uploadPromises);
      const newUrls = responses.map(res => res.data.imageUrl);

      setNewProduct(prev => ({
        ...prev,
        imageUrls: [...(prev.imageUrls || []), ...newUrls]
      }));
      toast({ title: `${newUrls.length} imagens enviadas!`, status: 'success' });
    } catch (error) {
      toast({ title: 'Erro ao enviar imagem', description: error.message, status: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (indexToRemove) => {
    const urlToRemove = newProduct.imageUrls[indexToRemove];
    if (urlToRemove && urlToRemove.startsWith('http')) {
      try {
        await businessAPI.deleteImage(urlToRemove);
        toast({ title: 'Imagem removida!', status: 'success' });
      } catch (error) {
        console.error("Erro ao deletar imagem:", error);
        toast({ title: 'Erro ao remover arquivo', status: 'error' });
        return;
      }
    }
    setNewProduct(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== indexToRemove)
    }));
  };

  return (
    <Box>
      <Card bg={cardBg} boxShadow="md">
        <CardHeader>
          <Stack direction={{ base: 'column', md: 'row' }} justify="space-between">
            <Box><Heading size="md">Produtos & Serviços</Heading><Text fontSize="sm" color="gray.500">Para a IA consultar preços e enviar fotos.</Text></Box>
            <Button leftIcon={<AddIcon />} variant="outline" colorScheme="blue" onClick={() => { setEditingProductIndex(null); setNewProduct({ name: '', price: '', description: '', imageUrls: [], tags: [], variations: [] }); onProductModalOpen(); }}>Novo Item</Button>
          </Stack>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={3}>
            {products.map((prod, idx) => (
              <Stack direction={{ base: 'column', md: 'row' }} key={idx} p={4} borderWidth="1px" borderRadius="md" justify="space-between" bg={gray50Bg} align="start">
                {prod.imageUrls && prod.imageUrls.length > 0 && (
                  <Box w="60px" h="60px" borderRadius="md" overflow="hidden" flexShrink={0}>
                    <img src={prod.imageUrls[0]} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </Box>
                )}
                <VStack align="start" spacing={1} flex={1}>
                  <HStack><Text fontWeight="bold">{prod.name}</Text><Badge colorScheme="green">R$ {prod.price}</Badge></HStack>
                  <Text fontSize="sm" color="gray.600">{prod.description}</Text>
                  {prod.variations && prod.variations.length > 0 && (
                     <Text fontSize="xs" color="gray.500" mt={1}>
                        Opções: {prod.variations.map(v => `${v.name} (R$${v.price})`).join(', ')}
                     </Text>
                  )}
                  {prod.tags && prod.tags.length > 0 && (
                    <HStack flexWrap="wrap" spacing={1} mt={1}>
                      {prod.tags.map((t, i) => <Badge key={i} colorScheme="purple" variant="subtle" fontSize="0.6em">{t}</Badge>)}
                    </HStack>
                  )}
                </VStack>
                <HStack>
                  <Tooltip label="Editar produto">
                    <IconButton icon={<EditIcon />} aria-label="Editar produto" size={{ base: 'lg', md: 'sm' }} variant="ghost" onClick={() => { setNewProduct(prod); setEditingProductIndex(idx); onProductModalOpen(); }} />
                  </Tooltip>
                  <Tooltip label="Excluir produto">
                    <IconButton icon={<DeleteIcon />} aria-label="Excluir produto" size={{ base: 'lg', md: 'sm' }} colorScheme="red" variant="ghost" onClick={() => handleRemoveProduct(idx)} />
                  </Tooltip>
                </HStack>
              </Stack>
            ))}
          </VStack>
          {products.length > 0 && <Box mt={6} pt={4} textAlign="right"><Button colorScheme="brand" onClick={handleSaveProducts}>Salvar Catálogo</Button></Box>}
        </CardBody>
      </Card>

      {/* Modal Produto */}
      <Modal isOpen={isProductModalOpen} onClose={onProductModalClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingProductIndex !== null ? 'Editar' : 'Novo'} Produto</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired><FormLabel>Nome</FormLabel><Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} size={{ base: 'lg', md: 'md' }} /></FormControl>
              <FormControl isRequired><FormLabel>Preço</FormLabel><Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} size={{ base: 'lg', md: 'md' }} /></FormControl>
              <FormControl><FormLabel>Detalhes</FormLabel><Textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} size={{ base: 'lg', md: 'md' }} /></FormControl>

              {/* Variations Section */}
              <Box w="100%" bg={gray50Bg} p={3} borderRadius="md" borderWidth="1px">
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm">Variações / Opções</Text>
                  <Button size="xs" leftIcon={<AddIcon />} onClick={addVariation}>Add Opção</Button>
                </HStack>

                {newProduct.variations && newProduct.variations.length > 0 ? (
                  <VStack spacing={2} align="stretch">
                    {newProduct.variations.map((variation, index) => (
                      <HStack key={index} spacing={2}>
                        <Input
                          placeholder="Nome (ex: Longo)"
                          size="sm"
                          value={variation.name}
                          onChange={(e) => updateVariation(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="R$"
                          type="number"
                          size="sm"
                          w="80px"
                          value={variation.price}
                          onChange={(e) => updateVariation(index, 'price', e.target.value)}
                        />
                        <Input
                          placeholder="Min"
                          type="number"
                          size="sm"
                          w="60px"
                          value={variation.durationMinutes}
                          onChange={(e) => updateVariation(index, 'durationMinutes', e.target.value)}
                        />
                         <IconButton
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            aria-label="Remover variação"
                            onClick={() => removeVariation(index)}
                         />
                      </HStack>
                    ))}
                  </VStack>
                ) : (
                  <Text fontSize="xs" color="gray.500" fontStyle="italic">Nenhuma variação adicionada.</Text>
                )}
              </Box>

              <FormControl>
                <FormLabel>Tags (Palavras-chave separadas por vírgula)</FormLabel>
                <Input
                  placeholder="Escreva as palavras que correspondem ao produto."
                  value={Array.isArray(newProduct.tags) ? newProduct.tags.join(', ') : newProduct.tags}
                  onChange={e => setNewProduct({ ...newProduct, tags: e.target.value })}
                  size={{ base: 'lg', md: 'md' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Imagens do Produto</FormLabel>
                <HStack>
                  <Input type="file" multiple accept="image/*" onChange={handleImageUpload} p={1} isDisabled={isUploading} />
                  {isUploading && <Spinner size="sm" />}
                </HStack>
                {newProduct.imageUrls && newProduct.imageUrls.length > 0 && (
                  <HStack mt={2} spacing={2} overflowX="auto" py={2}>
                    {newProduct.imageUrls.map((url, i) => (
                      <Box key={i} w="60px" h="60px" borderRadius="md" overflow="hidden" border="1px solid gray" position="relative" flexShrink={0}>
                        <img src={url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <IconButton
                          icon={<DeleteIcon boxSize={3} />}
                          size={{ base: 'sm', md: 'xs' }}
                          colorScheme="red"
                          position="absolute"
                          top={0}
                          right={0}
                          onClick={() => handleDeleteImage(i)}
                          aria-label="Remover imagem"
                          borderRadius="none"
                          borderBottomLeftRadius="md"
                        />
                      </Box>
                    ))}
                  </HStack>
                )}
              </FormControl>

            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={onProductModalClose}>Cancelar</Button><Button colorScheme="blue" onClick={handleAddProduct} isLoading={isUploading}>Salvar</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CatalogTab;
