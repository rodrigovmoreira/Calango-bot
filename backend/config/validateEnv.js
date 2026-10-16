// ============================================================================
// Validação de Variáveis de Ambiente — Fail Fast (constitution.md)
// ----------------------------------------------------------------------------
// Se faltar uma variável obrigatória, o serviço QUEBRA no boot (nunca roda
// em estado zumbi). Importar e chamar APÓS o carregamento do .env.
// ============================================================================

// Variáveis obrigatórias para o funcionamento do serviço.
const REQUIRED_ENV_VARS = [
  'MONGO_URI',
  'JWT_SECRET_LOGIN', // chave compartilhada com o Squamata-Login (SSO)
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === ''
  );

  if (missing.length > 0) {
    console.error('💥 [Boot] Variáveis de ambiente obrigatórias ausentes:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('   Verifique o arquivo .env (use .env.example como modelo).');
    // Fail Fast: aborta o processo com código de erro.
    process.exit(1);
  }

  console.log('✅ [Boot] Validação de variáveis de ambiente: OK');
}

export default validateEnv;
