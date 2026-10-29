import React from 'react';
import { Text } from '@chakra-ui/react';

// Rodapé de rastreabilidade (Roadmap 1, Ponto 5.3).
// Mostra autor e data da criação/alteração sem poluir a tela: quando não há
// informação de autoria (documentos anteriores ao Ponto 5), o componente não
// renderiza nada.
const formatarData = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const nomeDoUsuario = (usuario) => {
  if (!usuario) return null;
  if (typeof usuario === 'string') return null; // ObjectId não resolvido
  return usuario.name || usuario.email || null;
};

const AuditTrail = ({ documento, ...props }) => {
  if (!documento) return null;

  const criadoPor = nomeDoUsuario(documento.createdBy);
  const criadoEm = formatarData(documento.createdAt);
  const alteradoPor = nomeDoUsuario(documento.lastUpdatedBy);
  const alteradoEm = formatarData(documento.lastUpdatedAt ?? documento.updatedAt);
  const alteracaoAutomatica = documento.lastUpdatedOrigin === 'system' && alteradoEm;

  const partes = [];
  if (criadoPor || criadoEm) {
    partes.push(`Criado por ${criadoPor || '—'}${criadoEm ? ` em ${criadoEm}` : ''}`);
  }
  if (alteradoEm) {
    partes.push(
      alteracaoAutomatica
        ? `Última alteração automática em ${alteradoEm}`
        : `Última alteração por ${alteradoPor || '—'} em ${alteradoEm}`
    );
  }

  if (!partes.length) return null;

  return (
    <Text
      fontSize="xs"
      color="gray.500"
      borderTopWidth="1px"
      borderColor="inherit"
      pt={2}
      mt={2}
      {...props}
    >
      {partes.join(' · ')}
    </Text>
  );
};

export default AuditTrail;
