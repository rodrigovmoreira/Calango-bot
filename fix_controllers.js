import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(([from, to]) => {
    content = content.replaceAll(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/controllers/tagController.js', [
  ['const businessId = await getBusinessId(req.user.userId);', 'const businessId = req.user.activeBusinessId;'],
  ['const config = await BusinessConfig.findOne({ userId });', 'const config = await BusinessConfig.findById(req.user.activeBusinessId);'],
  ['const { userId } = req.user;', ''], // Might need manual touch, it is just extracting it.
]);

replaceInFile('backend/controllers/contactController.js', [
  ['const businessId = await getBusinessId(req.user.userId);', 'const businessId = req.user.activeBusinessId;'],
  ['const { userId } = req.user;', ''],
  ['const config = await BusinessConfig.findOne({ userId });', 'const config = await BusinessConfig.findById(req.user.activeBusinessId);'],
]);

replaceInFile('backend/controllers/dashboardController.js', [
  ['const userId = req.user.userId;', 'const businessId = req.user.activeBusinessId;'],
  ['const config = await BusinessConfig.findOne({ userId });', 'const config = await BusinessConfig.findById(businessId);']
]);

// WhatsappController still needs userId to match the WWebJS session logic if it's tied to userId instead of businessId. Let's check whatsappRoutes and whatsappController.
