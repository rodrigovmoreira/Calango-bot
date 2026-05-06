import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(([from, to]) => {
    content = content.replaceAll(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/routes/campaignRoutes.js', [
  ['userId: req.user.userId', 'businessId: req.user.activeBusinessId'],
  ['BusinessConfig.findOne({ businessId: req.user.activeBusinessId })', 'BusinessConfig.findById(req.user.activeBusinessId)']
]);

replaceInFile('backend/routes/appointmentRoutes.js', [
  ['userId: req.user.userId', 'businessId: req.user.activeBusinessId']
]);

replaceInFile('backend/routes/contactRoutes.js', [
  ['BusinessConfig.findOne({ userId: req.user.userId })', 'BusinessConfig.findById(req.user.activeBusinessId)']
]);

// Para o CustomPrompt dentro de businessRoutes.js (se usar userId) - idealmente deveria usar businessId tb.
replaceInFile('backend/routes/businessRoutes.js', [
  ['userId: req.user.userId', 'businessId: req.user.activeBusinessId']
]);
