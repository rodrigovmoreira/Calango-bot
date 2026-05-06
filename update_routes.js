import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, searchRegex, replaceFunc) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = content.replace(searchRegex, replaceFunc);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.js')) {
      // General replacement for activeBusinessId lookup
      replaceInFile(fullPath, /SystemUser\.findById\(req\.user\.userId\)/g, "SystemUser.findById(req.user.userId)");

      // This logic will be a bit complex to automate entirely safely using regex.
      // Let's create a simpler middleware or helper.
    }
  }
}

// We won't run this script, it's just a sandbox idea. Let's do it file by file or with a helper function since the businessId is now easily available.
