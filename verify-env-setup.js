#!/usr/bin/env node

/**
 * verify-env-setup.js
 * 
 * Verifica se todas as variáveis de ambiente estão configuradas corretamente
 * para o upload funcionar no Calango Bot.
 * 
 * Uso: node verify-env-setup.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, text) {
  console.log(`${colors[color] || colors.reset}${text}${colors.reset}`);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log('green', `✅ ${description}: ${filePath}`);
    return true;
  } else {
    log('red', `❌ ${description}: ${filePath} NÃO ENCONTRADO`);
    return false;
  }
}

function checkEnvVariable(filepath, varName) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = content.match(regex);

    if (match && match[1]) {
      log('green', `  ✅ ${varName}=${match[1]}`);
      return true;
    } else {
      log('red', `  ❌ ${varName} não está configurada`);
      return false;
    }
  } catch (error) {
    log('red', `  ❌ Erro ao ler ${filepath}: ${error.message}`);
    return false;
  }
}

function main() {
  log('bold', '\n🔍 VERIFICAÇÃO DE CONFIGURAÇÃO DO UPLOAD\n');

  let allGood = true;

  // 1. Verificar arquivos backend
  log('cyan', '📂 Backend:');
  allGood &= checkFile(
    'c:\\Calango-bot\\backend\\.env',
    'Arquivo .env do backend'
  );
  if (fs.existsSync('c:\\Calango-bot\\backend\\.env')) {
    allGood &= checkEnvVariable('c:\\Calango-bot\\backend\\.env', 'REACT_APP_SQUAMATA_UPLOAD_API_URL');
    allGood &= checkEnvVariable('c:\\Calango-bot\\backend\\.env', 'REACT_APP_SQUAMATA_UPLOAD_API_KEY');
    allGood &= checkEnvVariable('c:\\Calango-bot\\backend\\.env', 'REACT_APP_FIREBASE_BUCKET');
  }

  // 2. Verificar arquivos frontend
  log('cyan', '\n📂 Frontend:');
  allGood &= checkFile(
    'c:\\Calango-bot\\frontend\\.env',
    'Arquivo .env do frontend'
  );
  if (fs.existsSync('c:\\Calango-bot\\frontend\\.env')) {
    allGood &= checkEnvVariable('c:\\Calango-bot\\frontend\\.env', 'REACT_APP_FIREBASE_BUCKET');
    allGood &= checkEnvVariable('c:\\Calango-bot\\frontend\\.env', 'REACT_APP_API_URL');
  }

  // 3. Verificar utilitários
  log('cyan', '\n🛠️ Utilitários:');
  allGood &= checkFile(
    'c:\\Calango-bot\\frontend\\src\\utils\\uploadHelper.js',
    'uploadHelper.js'
  );
  allGood &= checkFile(
    'c:\\Calango-bot\\backend\\routes\\businessRoutes.js',
    'businessRoutes.js'
  );

  // Resultado final
  log('cyan', '\n--- RESULTADO ---');
  if (allGood) {
    log('green', '✅ TODAS AS CONFIGURAÇÕES PARECEM CORRETAS!');
    log('yellow', '\n⚠️  NÃO ESQUEÇA: Reinicie o frontend com "npm start" após editar .env');
  } else {
    log('red', '❌ ALGUNS PROBLEMAS FORAM ENCONTRADOS!');
    log('yellow', '\n⚠️  Solução:');
    log('yellow', '  1. Crie/edite .env nos diretórios backend/ e frontend/');
    log('yellow', '  2. Adicione as variáveis necessárias');
    log('yellow', '  3. Reinicie os servidores (npm start no frontend, npm run dev no backend)');
  }

  log('cyan', '\n' + '='.repeat(60) + '\n');
}

main();
