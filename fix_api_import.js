import fs from 'fs';

let teamTabPath = 'frontend/src/components/dashboard-tabs/TeamTab.jsx';
let invitePagePath = 'frontend/src/pages/InvitePage.jsx';

function fixImport(path) {
    if (fs.existsSync(path)) {
        let content = fs.readFileSync(path, 'utf8');
        content = content.replace(/import { api } from '\.\.\/\.\.\/services\/api';/, "import api from '../../services/api';");
        content = content.replace(/import { api } from '\.\.\/services\/api';/, "import api from '../services/api';");
        fs.writeFileSync(path, content, 'utf8');
    }
}

fixImport(teamTabPath);
fixImport(invitePagePath);
