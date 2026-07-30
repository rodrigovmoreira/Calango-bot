/**
 * UTILITÁRIO CENTRALIZADO DE NORMALIZAÇÃO DE TELEFONE
 * 
 * Resolve o problema de inconsistência de formato de telefone entre:
 * - Extração do WhatsApp (@c.us internacional)  
 * - Cadastro manual (formato nacional)
 * - Importação CSV
 * 
 * REGRA: O campo `phone` no banco SEMPRE armazena o formato NACIONAL (sem código de país).
 * O campo `whatsappId` armazena o formato internacional completo para envio de mensagens.
 * 
 * Brasil:  phone = "11999999999" (DDD + 9 dígitos) | whatsappId = "5511999999999@c.us"
 */

// Códigos de país conhecidos (chave: código, valor: dígitos do número nacional)
const COUNTRY_CODES = {
  '55': 11,  // Brasil: DDD(2) + número(9) = 11 dígitos
  '1':  10,  // EUA/Canadá: area(3) + número(7) = 10 dígitos
  '351': 9,  // Portugal
  '34':  9,  // Espanha
  '54':  10, // Argentina
  '56':  9,  // Chile
  '52':  10, // México
  '57':  10, // Colômbia
  '33':  9,  // França
  '44':  10, // Reino Unido
  '49':  11, // Alemanha
  '39':  10, // Itália
};

/**
 * Detecta e extrai o código de país de um número internacional (apenas dígitos)
 * @param {string} digits - Número contendo apenas dígitos
 * @returns {{ countryCode: string, nationalNumber: string } | null}
 */
function detectCountryCode(digits) {
  // Tenta os códigos mais longos primeiro (ex: 351 antes de 3)
  const sortedCodes = Object.keys(COUNTRY_CODES).sort((a, b) => b.length - a.length);
  
  for (const code of sortedCodes) {
    if (digits.startsWith(code)) {
      const expectedLen = COUNTRY_CODES[code];
      const nationalPart = digits.slice(code.length);
      // Verifica se o número nacional tem o tamanho esperado
      if (nationalPart.length === expectedLen) {
        return { countryCode: code, nationalNumber: nationalPart };
      }
      // Para números com 9º dígito podem ter tamanhos diferentes
      if (code === '55' && nationalPart.length >= 10 && nationalPart.length <= 11) {
        return { countryCode: code, nationalNumber: nationalPart };
      }
    }
  }
  return null;
}

/**
 * Normaliza um telefone para o formato nacional (SEM código de país).
 * 
 * @param {string} rawPhone - Telefone em qualquer formato (5511999999999, +5511999999999, 11999999999, etc.)
 * @returns {string} - Número nacional limpo (apenas dígitos, sem código de país)
 * 
 * Exemplos:
 *   normalizePhone('5511999999999')      → '11999999999'
 *   normalizePhone('+55 11 99999-9999')  → '11999999999'
 *   normalizePhone('5511999999999@c.us') → '11999999999'
 *   normalizePhone('11999999999')        → '11999999999'
 *   normalizePhone('1234567890')         → '1234567890' (sem código de país detectável)
 */
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  
  // Se contém @lid ou @g.us, preserva intacto (identificadores do WhatsApp que não são números)
  if (rawPhone.includes('@lid') || rawPhone.includes('@g.us')) {
    return rawPhone;
  }
  
  // Remove tudo que não for dígito
  const digits = rawPhone.replace(/\D/g, '');
  
  if (digits.length < 8) return digits; // Muito curto para ter código de país
  
  // Tenta detectar e remover código de país
  const detected = detectCountryCode(digits);
  if (detected) {
    return detected.nationalNumber;
  }
  
  // Se não detectou código de país conhecido, retorna como está
  return digits;
}

/**
 * Converte um número nacional para o formato de ID do WhatsApp.
 * 
 * @param {string} nationalPhone - Número nacional (ex: '11999999999')
 * @param {string} countryCode - Código do país (default: '55' para Brasil)
 * @returns {string} - WhatsApp ID (ex: '5511999999999@c.us')
 */
function toWhatsAppId(nationalPhone, countryCode = '55') {
  const clean = String(nationalPhone).replace(/\D/g, '');
  return `${countryCode}${clean}@c.us`;
}

/**
 * Extrai o número do país do WhatsApp ID.
 * Útil para detectar país quando se tem apenas o @c.us.
 * 
 * @param {string} waId - ID do WhatsApp (ex: '5511999999999@c.us')
 * @returns {{ countryCode: string, nationalNumber: string, waId: string }}
 */
function parseWhatsAppId(waId) {
  if (!waId) return { countryCode: '55', nationalNumber: '', waId: '' };
  
  const clean = waId.split('@')[0].replace(/\D/g, '');
  const detected = detectCountryCode(clean);
  
  return {
    countryCode: detected?.countryCode || '55',
    nationalNumber: detected?.nationalNumber || clean,
    waId: waId,
  };
}

export {
  normalizePhone,
  toWhatsAppId,
  parseWhatsAppId,
  detectCountryCode,
  COUNTRY_CODES,
};
