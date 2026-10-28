// Normaliza a base URL das APIs do ecossistema.
// As variáveis de ambiente (REACT_APP_API_URL / VITE_API_URL) apontam para o host,
// mas historicalmente receberam sufixo /api ou /api/vN. Removemos o sufixo para
// que os caminhos declarados no código (/api/v1/...) sejam a única fonte de verdade.
// Ver ADR 002 em Calango-docs/docs/ADRs.
const API_BASE_SUFFIX = /\/api(\/v\d+)?\/?$/;

export function normalizeApiBase(baseUrl = '') {
  return baseUrl.replace(/\/+$/, '').replace(API_BASE_SUFFIX, '');
}
