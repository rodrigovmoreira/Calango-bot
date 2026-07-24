import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tenta carregar o .env de múltiplos caminhos (local + Docker)
const envPaths = [
  path.resolve(__dirname, '../../.env'),    // local: backend/config/../../.env → raiz do projeto
  path.resolve(process.cwd(), '.env'),      // Docker: WORKDIR/.env
];

let loaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loaded = true;
    break;
  }
}
if (!loaded) {
  dotenv.config(); // fallback: CWD/.env
}
