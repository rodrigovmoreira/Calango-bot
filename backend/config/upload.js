import multer from 'multer';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configura Firebase Admin
let serviceAccount;

try {
  if (process.env.FIREBASE_CREDENTIALS) {
    // Produção: JSON stringificado na variável de ambiente
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
  } else {
    // Desenvolvimento: Arquivo local
    serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-credentials.json'), 'utf8'));
  }

  // Inicializa apenas se ainda não estiver inicializado
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_BUCKET_URL // ex: "meu-app.appspot.com"
    });
  }
} catch (error) {
  console.error("⚠️ Erro ao configurar Firebase:", error.message);
  // Não quebra a aplicação, mas uploads falharão
}

// 2. Configura Multer para memória (necessário para o Sharp processar antes)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  }
});

// Exporta o 'upload' (middleware) e o 'bucket' (para salvar manualmente)
const bucket = admin.storage().bucket();

export { upload, bucket };
