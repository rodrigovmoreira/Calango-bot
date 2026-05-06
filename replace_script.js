import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Substituir consultas por userId para consultas por activeBusinessId
  // Em BusinessConfig: { userId: req.user.userId } => { _id: req.user.activeBusinessId }
  // O ideal é verificar manualmente, vamos usar sed onde sabemos q é seguro.
}
