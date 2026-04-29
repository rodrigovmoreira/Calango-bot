import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardHeader, CardBody, Heading, Text, Button, VStack, HStack, Stack,
  useToast, Badge, useColorModeValue, FormControl, FormLabel, Input, Textarea,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, IconButton, Tooltip, Spinner, Select, Switch, Divider
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { useApp } from '../../context/AppContext';
import { businessAPI } from '../../services/api';
import { uploadMultipleFiles } from '../../utils/uploadHelper';

const CatalogTab = () => {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const gray50Bg = useColorModeValue('gray.50', 'gray.700');
  const advancedModeBg = useColorModeValue('gray.50', 'gray.700');
  const attrBoxBg = useColorModeValue('white', 'gray.600');

  // Modal
  const { isOpen: isProductModalOpen, onOpen: onProductModalOpen, onClose: onProductModalClose } = useDisclosure();

  // State
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '', price: '', description: '', imageUrls: [], tags: [],
    type: 'physical', visualGuideUrl: '', customAttributes: []
  });
  const [editingProductIndex, setEditingProductIndex] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingGuide, setIsUploadingGuide] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

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
    // Validation for Advanced Mode
    if (isAdvancedMode) {
      for (const attr of newProduct.customAttributes) {
        if (!attr.label || attr.label.trim() === '') {
          toast({ title: 'Erro de Validação', description: 'O nome do atributo (label) não pode estar vazio.', status: 'error' });
          return;
        }
        for (const opt of attr.options) {
          if (!opt.name || opt.name.trim() === '') {
            toast({ title: 'Erro de Validação', description: 'Todas as opções devem ter um nome.', status: 'error' });
            return;
          }
          if (opt.price === '' || isNaN(opt.price) || Number(opt.price) < 0) {
            toast({ title: 'Erro de Validação', description: 'Todas as opções devem ter um preço válido.', status: 'error' });
            return;
          }
        }
      }
    }

    let finalTags = newProduct.tags;
    if (typeof finalTags === 'string') {
      finalTags = finalTags.split(',').map(t => t.trim()).filter(t => t);
    }

    const productToSave = {
      ...newProduct,
      tags: finalTags,
      // Se não estiver no modo avançado, limpa os campos avançados antes de salvar
      visualGuideUrl: isAdvancedMode ? newProduct.visualGuideUrl : '',
      customAttributes: isAdvancedMode ? newProduct.customAttributes : []
    };
    const updated = [...products];
    if (editingProductIndex !== null) updated[editingProductIndex] = productToSave;
    else updated.push(productToSave);

    setProducts(updated);
    setNewProduct({ name: '', price: '', description: '', imageUrls: [], tags: [], type: 'physical', visualGuideUrl: '', customAttributes: [] });
    setEditingProductIndex(null);
    setIsAdvancedMode(false);
    onProductModalClose();
  };

  const handleRemoveProduct = (idx) => setProducts(products.filter((_, i) => i !== idx));

  const handleGuideUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploadingGuide(true);
    try {
      const newUrls = await uploadMultipleFiles(files, 'products');
      if (newUrls && newUrls.length > 0) {
        setNewProduct(prev => ({
          ...prev,
          visualGuideUrl: newUrls[0]
        }));
        toast({ title: 'Guia Visual enviado!', status: 'success' });
      }
    } catch (error) {
      console.error('Erro ao enviar Guia Visual:', error);
      toast({ title: 'Erro ao enviar imagem', description: error.message, status: 'error' });
    } finally {
      setIsUploadingGuide(false);
    }
  };

  const handleDeleteGuide = async () => {
    const urlToRemove = newProduct.visualGuideUrl;
    if (urlToRemove && urlToRemove.startsWith('http')) {
      try {
        await businessAPI.deleteImage(urlToRemove);
        toast({ title: 'Guia Visual removido!', status: 'success' });
      } catch (error) {
        console.error("Erro ao deletar Guia Visual:", error);
        toast({ title: 'Erro ao remover arquivo', status: 'error' });
        return;
      }
    }
    setNewProduct(prev => ({ ...prev, visualGuideUrl: '' }));
  };

  const addCustomAttribute = () => {
    setNewProduct(prev => ({
      ...prev,
      customAttributes: [...prev.customAttributes, { label: '', options: [] }]
    }));
  };

  const removeCustomAttribute = (attrIndex) => {
    setNewProduct(prev => {
      const updatedAttrs = [...prev.customAttributes];
      updatedAttrs.splice(attrIndex, 1);
      return { ...prev, customAttributes: updatedAttrs };
    });
  };

  const updateAttributeLabel = (attrIndex, newLabel) => {
    setNewProduct(prev => {
      const updatedAttrs = [...prev.customAttributes];
      updatedAttrs[attrIndex].label = newLabel;
      return { ...prev, customAttributes: updatedAttrs };
    });
  };

  const addOptionToAttribute = (attrIndex) => {
    setNewProduct(prev => {
      const updatedAttrs = [...prev.customAttributes];
      updatedAttrs[attrIndex].options.push({ name: '', price: 0 });
      return { ...prev, customAttributes: updatedAttrs };
    });
  };

  const removeOptionFromAttribute = (attrIndex, optionIndex) => {
    setNewProduct(prev => {
      const updatedAttrs = [...prev.customAttributes];
      updatedAttrs[attrIndex].options.splice(optionIndex, 1);
      return { ...prev, customAttributes: updatedAttrs };
    });
  };

  const updateOption = (attrIndex, optionIndex, field, value) => {
    setNewProduct(prev => {
      const updatedAttrs = [...prev.customAttributes];
      updatedAttrs[attrIndex].options[optionIndex][field] = field === 'price' ? Number(value) : value;
      return { ...prev, customAttributes: updatedAttrs };
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);
    try {
      const newUrls = await uploadMultipleFiles(files, 'products');
      setNewProduct(prev => ({
        ...prev,
        imageUrls: [...(prev.imageUrls || []), ...newUrls]
      }));
      toast({ title: `${newUrls.length} imagens enviadas!`, status: 'success' });
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
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
            <Button leftIcon={<AddIcon />} variant="outline" colorScheme="blue" onClick={() => {
              setEditingProductIndex(null);
              setNewProduct({ name: '', price: '', description: '', imageUrls: [], tags: [], type: 'physical', visualGuideUrl: '', customAttributes: [] });
              setIsAdvancedMode(false);
              onProductModalOpen();
            }}>Novo Item</Button>
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
                  {prod.tags && prod.tags.length > 0 && (
                    <HStack flexWrap="wrap" spacing={1}>
                      {prod.tags.map((t, i) => <Badge key={i} colorScheme="purple" variant="subtle" fontSize="0.6em">{t}</Badge>)}
                    </HStack>
                  )}
                </VStack>
                <HStack>
                  <Tooltip label="Editar produto">
                    <IconButton icon={<EditIcon />} aria-label="Editar produto" size={{ base: 'lg', md: 'sm' }} variant="ghost" onClick={() => {
                      setNewProduct({
                        ...prod,
                        type: prod.type || 'physical',
                        visualGuideUrl: prod.visualGuideUrl || '',
                        customAttributes: prod.customAttributes || []
                      });
                      setEditingProductIndex(idx);
                      setIsAdvancedMode(!!(prod.visualGuideUrl || (prod.customAttributes && prod.customAttributes.length > 0)));
                      onProductModalOpen();
                    }} />
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
              <FormControl isRequired>
                <FormLabel>Tipo</FormLabel>
                <Select value={newProduct.type} onChange={e => setNewProduct({ ...newProduct, type: e.target.value })} size={{ base: 'lg', md: 'md' }}>
                  <option value="physical">Produto Físico</option>
                  <option value="digital">Produto Digital</option>
                  <option value="service">Serviço</option>
                </Select>
              </FormControl>

              <FormControl isRequired><FormLabel>{isAdvancedMode ? 'Preço Base (A partir de)' : 'Preço'}</FormLabel><Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} size={{ base: 'lg', md: 'md' }} /></FormControl>
              <FormControl><FormLabel>Detalhes</FormLabel><Textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} size={{ base: 'lg', md: 'md' }} /></FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="advanced-mode" mb="0">
                  Modo Avançado (Guia Visual e Variações)
                </FormLabel>
                <Switch id="advanced-mode" isChecked={isAdvancedMode} onChange={(e) => setIsAdvancedMode(e.target.checked)} />
              </FormControl>

              {isAdvancedMode && (
                <Box w="100%" p={4} borderWidth="1px" borderRadius="md" bg={advancedModeBg}>
                  <VStack spacing={4} align="stretch">
                    <Heading size="sm">Opções Avançadas</Heading>
                    <Divider />

                    <FormControl>
                      <FormLabel>Guia Visual (Opcional)</FormLabel>
                      <Text fontSize="xs" color="gray.500" mb={2}>Uma imagem de referência para o cliente (ex: mapa do corpo, peças do carro).</Text>
                      {!newProduct.visualGuideUrl ? (
                        <HStack>
                          <Input type="file" accept="image/*" onChange={handleGuideUpload} p={1} isDisabled={isUploadingGuide} />
                          {isUploadingGuide && <Spinner size="sm" />}
                        </HStack>
                      ) : (
                        <Box w="120px" h="120px" borderRadius="md" overflow="hidden" border="1px solid gray" position="relative">
                          <img src={newProduct.visualGuideUrl} alt="Guia Visual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <IconButton
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            position="absolute"
                            top={1}
                            right={1}
                            onClick={handleDeleteGuide}
                            aria-label="Remover Guia Visual"
                          />
                        </Box>
                      )}
                    </FormControl>

                    <Divider />

                    <Box>
                      <HStack justify="space-between" mb={2}>
                        <FormLabel mb={0}>Atributos Personalizados</FormLabel>
                        <Button size="sm" leftIcon={<AddIcon />} onClick={addCustomAttribute}>Adicionar Atributo</Button>
                      </HStack>

                      <VStack spacing={4} align="stretch">
                        {newProduct.customAttributes.map((attr, attrIndex) => (
                          <Box key={attrIndex} p={3} borderWidth="1px" borderRadius="md" bg={attrBoxBg}>
                            <HStack mb={3}>
                              <FormControl isRequired>
                                <Input
                                  placeholder="Nome do Atributo (ex: Local do Corpo, Tamanho)"
                                  value={attr.label}
                                  onChange={(e) => updateAttributeLabel(attrIndex, e.target.value)}
                                  size="sm"
                                  fontWeight="bold"
                                />
                              </FormControl>
                              <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" variant="ghost" onClick={() => removeCustomAttribute(attrIndex)} aria-label="Remover Atributo" />
                            </HStack>

                            <VStack align="stretch" pl={4} borderLeft="2px solid" borderColor="brand.500" spacing={2}>
                              {attr.options.map((opt, optIndex) => (
                                <HStack key={optIndex}>
                                  <FormControl isRequired>
                                    <Input placeholder="Opção (ex: Braço)" value={opt.name} onChange={(e) => updateOption(attrIndex, optIndex, 'name', e.target.value)} size="sm" />
                                  </FormControl>
                                  <FormControl isRequired w="120px">
                                    <Input type="number" placeholder="Preço (R$)" value={opt.price} onChange={(e) => updateOption(attrIndex, optIndex, 'price', e.target.value)} size="sm" />
                                  </FormControl>
                                  <IconButton icon={<DeleteIcon />} size="sm" colorScheme="red" variant="ghost" onClick={() => removeOptionFromAttribute(attrIndex, optIndex)} aria-label="Remover Opção" />
                                </HStack>
                              ))}
                              <Button size="xs" variant="outline" alignSelf="flex-start" leftIcon={<AddIcon />} onClick={() => addOptionToAttribute(attrIndex)}>Adicionar Opção</Button>
                            </VStack>
                          </Box>
                        ))}
                        {newProduct.customAttributes.length === 0 && (
                          <Text fontSize="sm" color="gray.500" fontStyle="italic">Nenhum atributo adicionado.</Text>
                        )}
                      </VStack>
                    </Box>
                  </VStack>
                </Box>
              )}

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
                        <img 
                          src={url} 
                          alt="preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
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
