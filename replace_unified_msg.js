import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(([from, to]) => {
    content = content.replaceAll(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/messageHandler.js', [
  ['businessConfig.userId', 'businessConfig._id']
]);

replaceInFile('backend/services/campaignScheduler.js', [
  ['campaign.userId', 'campaign.businessId']
]);

replaceInFile('backend/services/scheduler.js', [
  // scheduler might pass userId or businessId
  // we'll need to check the code
]);
