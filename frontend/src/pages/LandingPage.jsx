import {
  Box, Button, Container, Flex, Heading, HStack, SimpleGrid, Stack, Text, useColorModeValue, VStack,
  List, ListItem, ListIcon, Card, CardBody, CardHeader, Avatar, Icon, Image,
} from '@chakra-ui/react';
import { CheckIcon, StarIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';
import { FaWhatsapp, FaRobot, FaCalendarCheck, FaImages, FaCommentDots, FaTimes } from 'react-icons/fa';
import { Helmet } from 'react-helmet-async';
import ColorModeToggle from '../components/ColorModeToggle';
import HowItWorks from '../components/landing/HowItWorks';
import TargetAudience from '../components/landing/TargetAudience';
import FAQ from '../components/landing/FAQ';
import React, { useState, Suspense } from 'react';

// Lazy-loaded: seções abaixo da dobra (ganho no LCP)
const PricingTable = React.lazy(() => import('../components/landing/PricingTable'));


const LandingPage = () => {
  const navigate = useNavigate();
  const bg = useColorModeValue('gray.50', 'gray.900');
  const brandColor = 'brand.600';
  const [showChat, setShowChat] = useState(false);

  return (
    <Box bg={bg} minH="100vh">
      <Helmet>
        <title>CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h</title>
        <meta name="description" content="Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h para seus negócios. Comece grátis." />
        <meta name="keywords" content="chatbot, CRM, agendamento automático, WhatsApp, IA, inteligência artificial, atendimento 24h, empresas e pessoas." />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="CalangoApp" />
        <link rel="canonical" href="https://bot.calangoapp.com.br/" />

        <meta property="og:title" content="CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h" />
        <meta property="og:description" content="Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h." />
        <meta property="og:image" content="https://bot.calangoapp.com.br/og-image.png" />
        <meta property="og:url" content="https://bot.calangoapp.com.br/" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:site_name" content="CalangoBot" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="CalangoBot — CRM com Chatbot IA e Agendamento Automático 24h" />
        <meta name="twitter:description" content="Automatize atendimentos no WhatsApp com IA. Agendamento, catálogo visual e respostas 24h." />
        <meta name="twitter:image" content="https://bot.calangoapp.com.br/og-image.png" />
      </Helmet>

      {/* Navbar */}
      <Box
        as="nav"
        position="fixed"
        w="100%"
        zIndex={10}
        bg={useColorModeValue('white', 'gray.800')}
        boxShadow="sm"
        py={4}
      >
        <Container maxW="container.xl">
          <Flex justify="space-between" align="center">
            <HStack>
              {/* Logo Placeholder */}
              <Icon as={FaRobot} w={6} h={6} color={brandColor} />
              <Heading size="md" color={brandColor}>
                CalangoBot
              </Heading>
            </HStack>

            <HStack spacing={4}>
              <ColorModeToggle />
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Entrar
              </Button>
              <Button
                colorScheme="brand"
                variant="solid"
                onClick={() => navigate('/login')}
              >
                Testar Grátis
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxW="container.xl" pt={32} pb={20}>
        <Stack
          direction={{ base: 'column', md: 'row' }}
          spacing={10}
          align="center"
        >
          <VStack align="flex-start" spacing={6} flex={1}>
            <Heading
              as="h1"
              size="2xl"
              lineHeight="shorter"
              bgGradient="linear(to-r, brand.600, brand.400)"
              bgClip="text"
            >
              Evolua seus atendimentos com Inteligência Artificial
            </Heading>
            <Text fontSize="xl" color="gray.500">
              Agendamento automático, envio de catálogo visual e respostas inteligentes 24 horas por dia para o seu negócio nunca parar de vender.
            </Text>
            <Stack direction={{ base: 'column', sm: 'row' }} spacing={4} w="100%">
              <Button
                size="lg"
                colorScheme="brand"
                leftIcon={<FaWhatsapp />}
                onClick={() => navigate('/login')}
                px={8}
              >
                Começar Agora
              </Button>
              <Button
                size="lg"
                variant="outline"
                colorScheme="gray"
                onClick={() => window.open('/chat/TEST_BUSINESS_ID', '_blank')}
              >
                Ver Demonstração
              </Button>
            </Stack>
          </VStack>

          {/* Live Demo Visualization (Simulador de Chat) */}
          <Box flex={1} w="100%" id="demo">
            <Card
              bg={useColorModeValue('#e5ddd5', '#202c33')}
              borderRadius="xl"
              boxShadow="2xl"
              maxW="400px"
              mx="auto"
              overflow="hidden"
              border="8px solid"
              borderColor="gray.800"
            >
              <Box bg={useColorModeValue('#075e54', '#202c33')} p={3} color="white">
                <HStack>
                  <Avatar size="sm" src="https://bit.ly/broken-link" bg="gray.300" icon={<FaRobot />} />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold" fontSize="sm">CalangoBot Store</Text>
                    <Text fontSize="xs">Online agora</Text>
                  </VStack>
                </HStack>
              </Box>
              <CardBody p={4} minH="350px" display="flex" flexDirection="column" gap={3}>

                <ChatMessage isUser>Vocês têm esse tênis no tamanho 42?</ChatMessage>

                <ChatMessage>
                  <VStack align="start" spacing={2}>
                    <Box h="120px" w="100%" bg="gray.200" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
                      <Icon as={FaImages} boxSize={8} color="gray.400" />
                    </Box>
                    <Text>Sim! Temos o <b>Tênis Emerald Runner</b> em estoque. Olha a foto dele acima 👆</Text>
                  </VStack>
                </ChatMessage>

                <ChatMessage isUser>Top! Posso agendar pra provar amanhã às 14h?</ChatMessage>

                <ChatMessage>
                  ✅ <b>Agendamento confirmado!</b><br />
                  Te espero amanhã às 14:00. Já reservei o modelo pra você.
                </ChatMessage>

              </CardBody>
            </Card>
          </Box>
        </Stack>
      </Container>

      {/* Parceiros / Confiança */}
      <Box borderTopWidth={1} borderBottomWidth={1} borderColor={useColorModeValue('gray.100', 'gray.700')} py={8} bg={useColorModeValue('white', 'gray.800')}>
        <Container maxW="container.xl">
          <Text textAlign="center" color="gray.500" mb={6} fontSize="sm" fontWeight="bold" textTransform="uppercase">
            Empresas que confiam na nossa tecnologia
          </Text>
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={10} opacity={0.6} filter="grayscale(100%)">
            {/* Substitua por imagens reais de logos */}
            <PartnerPlaceholder name="Barbearia Silva" />
            <PartnerPlaceholder name="Clínica Bem Estar" />
            <PartnerPlaceholder name="Imobiliária Top" />
            <PartnerPlaceholder name="Studio Tattoo" />
            <PartnerPlaceholder name="Advocacia" />
          </SimpleGrid>
        </Container>
      </Box>

      {/* Como Funciona */}
      <HowItWorks />

      {/* Features Grid */}
      <Box py={20}>
        <Container maxW="container.xl">
          <VStack spacing={4} mb={12} textAlign="center">
            <Heading>Tudo que você precisa para automatizar</Heading>
            <Text color="gray.500" fontSize="lg">Ferramentas completas para transformar visitantes em clientes</Text>
          </VStack>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
            <FeatureCard
              icon={FaRobot}
              title="Cérebro de IA"
              text="Entende o contexto da conversa, gírias e áudios. Não é apenas um menu de opções, é uma conversa real."
            />
            <FeatureCard
              icon={FaCalendarCheck}
              title="Agendamento Automático"
              text="Sincronizado com sua agenda. O cliente escolhe o horário livre e o robô marca sozinho."
            />
            <FeatureCard
              icon={FaImages}
              title="Catálogo Visual"
              text="O cliente pediu foto? O robô envia imagens do seu produto na hora, direto do seu cadastro."
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* Para Quem é */}
      <TargetAudience />

      {/* Galeria de Telas (Screenshots) */}
      <Box bg={useColorModeValue('gray.100', 'gray.800')} py={20}>
        <Container maxW="container.xl">
          <VStack spacing={4} mb={12} textAlign="center">
            <Heading>Conheça a Plataforma por Dentro</Heading>
            <Text color="gray.500">Interface simples, limpa e focada em produtividade.</Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            <ScreenshotPlaceholder
              title="Dashboard Intuitivo"
              desc="Acompanhe atendimentos e métricas"
              src="/Dashboard-intuitivo.png"
            />
            <ScreenshotPlaceholder
              title="Gestão de Produtos"
              desc="Cadastre fotos e preços facilmente"
              src="/Gestao-de-produtos.png"
            />
            <ScreenshotPlaceholder
              title="Agenda Visual"
              desc="Controle total dos seus horários"
              src="/Agenda-visual.png"
            />
            <ScreenshotPlaceholder
              title="Configuração de IA"
              desc="Personalize a personalidade do seu robô"
              src="/Configuracao-de-IA.png"
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* Depoimentos */}
      <Container maxW="container.xl" py={20}>
        <Heading textAlign="center" mb={12}>O que nossos clientes dizem</Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
          <TestimonialCard
            name="Carlos Mendes"
            role="Tatuador"
            text="Antes eu perdia 2 horas por dia respondendo orçamento. Agora o CalangoBot faz tudo e já agenda. Minha agenda lotou!"
          />
          <TestimonialCard
            name="Ana Souza"
            role="Dona de Clínica"
            text="A função de enviar fotos dos procedimentos automaticamente é incrível. Os clientes adoram a rapidez."
          />
          <TestimonialCard
            name="Imobiliária Nova"
            role="Corretores"
            text="O melhor investimento do ano. O robô atende fim de semana e feriado, não perdemos mais nenhum lead."
          />
        </SimpleGrid>
      </Container>

      {/* Pricing Section */}
      <Box bg={useColorModeValue('white', 'gray.800')} py={20}>
        <Container maxW="container.xl">
          <VStack spacing={4} mb={10}>
            <Heading textAlign="center">Planos Simples e Transparentes</Heading>
            <Text color="gray.500" fontSize="lg">Escolha o plano ideal para o tamanho do seu negócio</Text>
          </VStack>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10}>
            <PricingCard
              title="Iniciante"
              price="Grátis"
              features={['Respostas Básicas de IA', 'Agendamento Manual', '5 Produtos no Catálogo', 'Suporte por Email']}
            />
            <PricingCard
              title="Profissional"
              price="R$ 97/mês"
              highlight
              features={['IA Contextual Avançada', 'Agendamento 100% Automático', '50 Produtos no Catálogo', 'Suporte Prioritário', 'Múltiplos Atendentes']}
            />
            <PricingCard
              title="Empresarial"
              price="R$ 297/mês"
              features={['Treinamento de IA Personalizado', 'Agendamentos Ilimitados', 'Catálogo Ilimitado', 'API de Integração', 'Gerente de Conta']}
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* Tabela Detalhada de Planos */}
      <Suspense fallback={<Box py={20} textAlign="center">Carregando...</Box>}>
        <PricingTable />
      </Suspense>

      {/* FAQ */}
      <FAQ />

      {/* Footer */}
      <Box bg={useColorModeValue('gray.900', 'black')} color="white" py={12}>
        <Container maxW="container.xl">
          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={8}>
            <VStack align="start">
              <HStack>
                <Icon as={FaRobot} color={brandColor} />
                <Heading size="md">CalangoBot</Heading>
              </HStack>
              <Text color="gray.400" fontSize="sm">
                A revolução do atendimento automático para empresas e pessoas.
              </Text>
            </VStack>

            <VStack align="start">
              <Text fontWeight="bold" mb={2}>Produto</Text>
              <Button variant="link" color="gray.400" size="sm">Funcionalidades</Button>
              <Button variant="link" color="gray.400" size="sm">Preços</Button>
              <Button variant="link" color="gray.400" size="sm">Integrações</Button>
            </VStack>

            <VStack align="start">
              <Text fontWeight="bold" mb={2}>Suporte</Text>
              <Button variant="link" color="gray.400" size="sm">Central de Ajuda</Button>
              <Button variant="link" color="gray.400" size="sm">Comunidade</Button>
              <Button variant="link" color="gray.400" size="sm">Status</Button>
            </VStack>

            <VStack align="start">
              <Text fontWeight="bold" mb={2}>Legal</Text>
              <Button variant="link" color="gray.400" size="sm">Privacidade</Button>
              <Button variant="link" color="gray.400" size="sm">Termos de Uso</Button>
            </VStack>
          </SimpleGrid>
          <Text textAlign="center" color="gray.500" fontSize="sm" mt={12}>
            &copy; {new Date().getFullYear()} CalangoBot Tecnologia. Todos os direitos reservados.
          </Text>
        </Container>
      </Box>
      
      {/* WIDGET FLUTUANTE DE CHAT */}
      <Box position="fixed" bottom="20px" right="20px" zIndex={9999} display="flex" flexDirection="column" alignItems="flex-end">

        {/* O IFRAME (Só aparece se showChat for true) */}
        {showChat && (
          <Box
            mb={4}
            borderRadius="xl"
            overflow="hidden"
            boxShadow="0 4px 12px rgba(0,0,0,0.15)"
            bg="white"
            // Animação simples de entrada
            animation="fadeIn 0.3s ease-in-out"
            sx={{
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'translateY(20px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' },
              }
            }}
          >
            <iframe
              src="/chat/6a0710aa1885a3378b1ffc98"
              width="350"
              height="600"
              style={{ border: 'none' }} // React usa objeto para style, não string
              title="CalangoBot Demo"
            />
          </Box>
        )}

        {/* O BOTÃO REDONDO (Abre/Fecha) */}
        <Button
          onClick={() => setShowChat(!showChat)}
          colorScheme="brand"
          size="lg"
          borderRadius="full"
          w="60px"
          h="60px"
          boxShadow="xl"
          _hover={{ transform: 'scale(1.05)' }}
          transition="all 0.2s"
        >
          <Icon as={showChat ? FaTimes : FaCommentDots} w={6} h={6} />
        </Button>
      </Box>
    </Box>
  );
};

// --- Componentes Auxiliares ---

const ChatMessage = ({ isUser, children }) => (
  <Flex justify={isUser ? "flex-end" : "flex-start"}>
    <Box
      bg={isUser ? "#dcf8c6" : "white"}
      color="black"
      p={2}
      px={3}
      borderRadius="lg"
      borderTopRightRadius={isUser ? "0" : "lg"}
      borderTopLeftRadius={isUser ? "lg" : "0"}
      maxW="85%"
      boxShadow="sm"
    >
      <Text fontSize="sm">{children}</Text>
    </Box>
  </Flex>
);

const FeatureCard = ({ icon, title, text }) => {
  return (
    <VStack
      bg={useColorModeValue('gray.50', 'gray.700')}
      p={8}
      borderRadius="xl"
      align="flex-start"
      spacing={4}
      boxShadow="md"
      _hover={{ transform: 'translateY(-5px)', transition: '0.3s' }}
    >
      <Icon as={icon} w={10} h={10} color="brand.500" />
      <Heading as="h3" size="md">{title}</Heading>
      <Text color="gray.500">{text}</Text>
    </VStack>
  );
};

const PricingCard = ({ title, price, features, highlight }) => {
  const borderColor = highlight ? 'brand.500' : 'transparent';
  const borderWidth = highlight ? '2px' : '1px';
  const scale = highlight ? '1.05' : '1';
  const shadow = highlight ? 'xl' : 'md';

  return (
    <Card
      borderWidth={borderWidth}
      borderColor={borderColor}
      transform={`scale(${scale})`}
      transition="transform 0.2s"
      boxShadow={shadow}
      position="relative"
    >
      {highlight && (
        <Box position="absolute" top="-12px" left="50%" transform="translateX(-50%)" bg="brand.500" color="white" px={3} py={1} borderRadius="full" fontSize="xs" fontWeight="bold">
          MAIS POPULAR
        </Box>
      )}
      <CardHeader textAlign="center">
        <Heading as="h3" size="md">{title}</Heading>
        <Heading size="2xl" mt={4}>{price}</Heading>
      </CardHeader>
      <CardBody>
        <List spacing={3}>
          {features.map((feature, index) => (
            <ListItem key={index} display="flex" alignItems="center">
              <ListIcon as={CheckIcon} color="green.500" />
              <Text fontSize="sm">{feature}</Text>
            </ListItem>
          ))}
        </List>
        <Button
          mt={8}
          w="100%"
          colorScheme="brand"
          variant={highlight ? 'solid' : 'outline'}
        >
          Escolher {title}
        </Button>
      </CardBody>
    </Card>
  );
};

const PartnerPlaceholder = ({ name }) => (
  <Flex align="center" justify="center" h="50px" bg="gray.100" borderRadius="md" fontWeight="bold" color="gray.400">
    {name}
  </Flex>
);

const ScreenshotPlaceholder = ({ title, desc, src }) => (
  <Box
    bg="white"
    borderRadius="xl"
    overflow="hidden"
    boxShadow="lg"
    border="1px solid"
    borderColor="gray.100"
    transition="all 0.3s"
    _hover={{ transform: 'translateY(-5px)', boxShadow: 'xl' }}
    group
  >
    {/* Área da Imagem */}
    <Box h="250px" w="100%" position="relative" bg="gray.100">
      <Image
        src={src}
        alt={title}
        objectFit="cover"
        objectPosition="top"
        w="100%"
        h="100%"
        width={600}
        height={400}
        loading="lazy"
      />

      {/* Overlay opcional ao passar o mouse */}
      <Box
        position="absolute"
        inset="0"
        bg="blackAlpha.400"
        opacity={0}
        _groupHover={{ opacity: 1 }}
        transition="0.3s"
      />
    </Box>

    {/* Descrição */}
    <Box p={5} textAlign="center" bg={useColorModeValue('white', 'gray.700')}>
      <Text fontWeight="bold" fontSize="lg" mb={1} color={useColorModeValue('gray.700', 'white')}>
        {title}
      </Text>
      <Text fontSize="sm" color="gray.500">
        {desc}
      </Text>
    </Box>
  </Box>
);

const TestimonialCard = ({ name, role, text }) => (
  <Stack bg={useColorModeValue('white', 'gray.700')} p={6} borderRadius="xl" boxShadow="lg" spacing={4}>
    <Text color="gray.500" fontStyle="italic">"{text}"</Text>
    <HStack spacing={4}>
      <Avatar name={name} src={`https://i.pravatar.cc/150?u=${name}`} />
      <Box>
        <Text fontWeight="bold">{name}</Text>
        <Text fontSize="sm" color="gray.500">{role}</Text>
      </Box>
      <Flex flex={1} justify="flex-end">
        {[...Array(5)].map((_, i) => (
          <StarIcon key={i} color="yellow.400" />
        ))}
      </Flex>
    </HStack>
  </Stack>
);

export default LandingPage;