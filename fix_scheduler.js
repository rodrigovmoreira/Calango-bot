import fs from 'fs';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  content = content.replaceAll("config.userId", "config._id");
  content = content.replaceAll("appt.userId", "appt.businessId");
  content = content.replaceAll("contact.userId", "contact.businessId");
  content = content.replaceAll("configByUserId", "configByBusinessId");
  content = content.replaceAll("appointmentsByUserId", "appointmentsByBusinessId");
  content = content.replaceAll("contactsByUserId", "contactsByBusinessId");
  content = content.replaceAll("userIds", "businessIds");
  content = content.replaceAll("userId: {", "businessId: {");
  content = content.replaceAll("uid", "bid");

  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('backend/services/scheduler.js');
