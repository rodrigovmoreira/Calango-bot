// services/menuService.js
import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
  optionNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  subOptions: [{
    number: String,
    text: String,
    handler: String // 'text', 'function', 'redirect'
  }],
  isActive: { type: Boolean, default: true }
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

class MenuService {
  constructor() {
    this.initializeDefaultMenus();
  }

  async initializeDefaultMenus() {
    const defaultMenus = [
      {
        optionNumber: '1',
        title: 'Falar com atendente',
        description: 'Conexão com atendente humano',
        subOptions: [
          { number: '1', text: 'Voltar ao menu principal', handler: 'text' },
          { number: '2', text: 'Deixar número para retorno', handler: 'function' }
        ]
      },
      // ... outros menus padrão
    ];

    for (const menu of defaultMenus) {
      await MenuItem.updateOne(
        { optionNumber: menu.optionNumber },
        { $set: menu },
        { upsert: true }
      );
    }
  }

  async getMainMenu() {
    const activeMenus = await MenuItem.find({ isActive: true }).sort('optionNumber');
    let menuText = "🤖 *Atendimento Moreira Bot* 🤖\n\n";
    menuText += "Por favor, escolha uma opção:\n";
    
    activeMenus.forEach(menu => {
      menuText += `${menu.optionNumber}️⃣ - ${menu.title}\n`;
    });
    
    menuText += "\nDigite apenas o *número* da opção desejada.";
    return menuText;
  }

  async getMenuForOption(optionNumber) {
    const menu = await MenuItem.findOne({ optionNumber });
    if (!menu) return this.getMainMenu();

    let menuText = `📌 *${menu.title}*:\n\n`;
    menuText += `${menu.description}\n\n`;

    menu.subOptions.forEach(opt => {
      menuText += `${opt.number} - ${opt.text}\n`;
    });

    return menuText;
  }

  async addNewMenuOption(menuData) {
    const newMenu = new MenuItem(menuData);
    return await newMenu.save();
  }
}

const menuService = new MenuService();
export default menuService;
// --- QUICK REPLIES ENGINE (V2) ---
import { sendUnifiedMessage } from './responseService.js';
import { saveMessage } from './message.js';
import { callDeepSeek } from './aiService.js';

const humanPauseMap = new Map();
export const HUMAN_PAUSE_TIME = 30 * 60 * 1000;

export function setHumanPause(uniqueKey, duration = HUMAN_PAUSE_TIME) {
    humanPauseMap.set(uniqueKey, Date.now() + duration);
}

export function checkHumanPause(uniqueKey) {
    const pauseUntil = humanPauseMap.get(uniqueKey);
    if (pauseUntil && Date.now() < pauseUntil) {
        return true;
    }
    return false;
}

export async function processQuickReplies({ userMessage, businessConfig, activeBusinessId, from, provider, uniqueKey, channel, cleanFromForDb, resolve }) {
    if (businessConfig.menuOptions && businessConfig.menuOptions.length > 0) {
        const lowerMsg = userMessage.toLowerCase();
        const matchedOption = businessConfig.menuOptions.find(opt => {
            const keywords = opt.keyword.split(',').map(k => k.trim().toLowerCase());
            return keywords.some(k => k && lowerMsg.includes(k));
        });

        if (matchedOption) {
            let finalResponse = matchedOption.response;

            if (matchedOption.useAI) {
                const menuPrompt = `
${businessConfig.prompts.chatSystem}
---
INSTRUÇÃO: O usuário perguntou sobre "${matchedOption.keyword}".
A informação oficial é: "${matchedOption.response}".
Responda de forma natural usando APENAS a informação oficial.
Cliente: ${userMessage}`;

                try {
                    finalResponse = await callDeepSeek([
                        { role: "user", content: menuPrompt }
                    ], activeBusinessId);
                } catch (e) { console.error("Erro IA Menu:", e); }
            }

            if (matchedOption.requiresHuman) {
                setHumanPause(uniqueKey, HUMAN_PAUSE_TIME);
            }

            if (channel === 'web' && resolve) {
                resolve({ text: finalResponse });
            } else {
                await sendUnifiedMessage(from, finalResponse, provider, businessConfig._id);
            }
            await saveMessage(cleanFromForDb, 'bot', finalResponse, 'text', null, activeBusinessId, channel, null, from);
            return true;
        }
    }
    return false;
}
