import fs from 'fs';

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(([from, to]) => {
    content = content.replaceAll(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/models/Campaign.js', [
  ['userId: {', 'businessId: {'],
  ["ref: 'SystemUser'", "ref: 'BusinessConfig'"]
]);

replaceInFile('backend/models/Appointment.js', [
  ['userId: {', 'businessId: {'],
  ["ref: 'SystemUser'", "ref: 'BusinessConfig'"],
  ['{ userId: 1,', '{ businessId: 1,']
]);

replaceInFile('backend/models/CustomPrompt.js', [
  ['userId: {', 'businessId: {'],
  ["ref: 'SystemUser'", "ref: 'BusinessConfig'"],
  ['{ userId: 1,', '{ businessId: 1,']
]);
