import fs from 'fs';

const filePath = 'backend/routes/businessRoutes.js';
let content = fs.readFileSync(filePath, 'utf-8');

// Apenas substituir a busca do BusinessConfig para usar activeBusinessId
content = content.replace(/BusinessConfig\.findOne\(\{ userId: req\.user\.userId \}\)/g, 'BusinessConfig.findById(req.user.activeBusinessId)');
content = content.replace(/const query = \{ userId: req\.user\.userId \};/g, 'const query = { _id: req.user.activeBusinessId };');
content = content.replace(/\{ userId: req\.user\.userId \}, \/\/ Busca pelo dono/g, '{ _id: req.user.activeBusinessId }, // Busca pelo negocio');

// Para CustomPrompt, usar businessId se existir, senão pular por agora
// Para Campaign, Contact, Tag, etc. em outros arquivos:

fs.writeFileSync(filePath, content, 'utf-8');
