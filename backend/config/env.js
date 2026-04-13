import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega as variáveis do .env na raiz do projeto (Calango-bot/.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
