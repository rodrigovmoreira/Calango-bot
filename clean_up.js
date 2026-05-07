import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(([from, to]) => {
    content = content.replaceAll(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/scripts/seedDemoData.js', [
  ['await BusinessConfig.findOne({ userId: user._id })', 'await BusinessConfig.findOne({ businessName: "Estúdio Tattoo" })'], // Best effort for seed
  ['new BusinessConfig({ userId: user._id })', 'new BusinessConfig({ businessName: "Estúdio Tattoo" })'],
  ['userId: user._id', 'businessId: businessConfig._id']
]);

replaceInFile('backend/scripts/verify_webhook_routing.js', [
  ['userId: user._id', '/* no userId */']
]);

// tests
replaceInFile('backend/tests/crm.test.js', [
  ['const config = await BusinessConfig.findOne({ userId });', 'const config = await BusinessConfig.findOne();']
]);
replaceInFile('backend/tests/import.test.js', [
  ['const config = await BusinessConfig.findOne({ userId });', 'const config = await BusinessConfig.findOne();']
]);
replaceInFile('backend/tests/tag_protection.test.js', [
  ['const config = await BusinessConfig.findOne({ userId });', 'const config = await BusinessConfig.findOne();']
]);
replaceInFile('backend/tests/integration/business_config_verification.test.js', [
  ['userId: userId', '/* removed userId */'],
  ['BusinessConfig.findOne({ userId: userId })', 'BusinessConfig.findOne()']
]);

replaceInFile('backend/tests/unit/campaignScheduler.test.js', [
  ['userId:', 'businessId:']
]);
replaceInFile('backend/tests/automation.test.js', [
  ['userId,', 'businessId: config._id,'],
  ['userId:', 'businessId:']
]);
