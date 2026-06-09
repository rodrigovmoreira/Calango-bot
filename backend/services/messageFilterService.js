import Contact from '../models/Contact.js';
import { getTagNames } from './tagService.js';

/**
 * Checks if the current time is within the operating hours defined in the business configuration.
 * @param {Object} businessConfig
 * @returns {boolean}
 */
export function isWithinOperatingHours(businessConfig) {
    if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) return false;
    if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening) return true;

    const timeZone = businessConfig.operatingHours.timezone || 'America/Sao_Paulo';

    // Use Intl.DateTimeFormat for robust timezone handling down to the second
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);

    const nowH = getPart('hour');
    const nowM = getPart('minute');
    const nowS = getPart('second');

    // Convert everything to Total Seconds for precision comparison
    const currentTotalSeconds = nowH * 3600 + nowM * 60 + nowS;

    const [openH, openM] = businessConfig.operatingHours.opening.split(':').map(Number);
    const [closeH, closeM] = businessConfig.operatingHours.closing.split(':').map(Number);

    const openTotalSeconds = openH * 3600 + (openM || 0) * 60;
    const closeTotalSeconds = closeH * 3600 + (closeM || 0) * 60;

    console.log(`🕒 OpHours Check (${timeZone}): Now=${nowH}:${nowM}:${nowS} (${currentTotalSeconds}s) | Range=[${openTotalSeconds}, ${closeTotalSeconds})`);

    return currentTotalSeconds >= openTotalSeconds && currentTotalSeconds < closeTotalSeconds;
}

/**
 * Evaluates message filters (Handover, Global Disabled, Audience, Operating Hours).
 * PURE FUNCTION: Does not mutate state or DB.
 * Returns early when a condition fails.
 *
 * @param {Object} contact
 * @param {Object} businessConfig
 * @param {string} channel
 * @returns {Object} { shouldProcess: boolean, blockReason: string | null }
 */
export function evaluateMessageFilters(contact, businessConfig, channel) {
    // 1. Handover
    if (contact && contact.isHandover) {
        return { shouldProcess: false, blockReason: 'handover' };
    }

    // 2. Global Disabled
    if (businessConfig.aiGlobalDisabled) {
        return { shouldProcess: false, blockReason: 'global' };
    }

    // 3. Audience Filter
    if (channel !== 'web') {
        const aiMode = businessConfig.aiResponseMode || 'all';

        if (aiMode === 'new_contacts') {
            if (contact) {
                const hasPriorHistory = contact.totalMessages > 0;
                const isOld = (Date.now() - new Date(contact.createdAt).getTime()) > 24 * 60 * 60 * 1000;
                if (hasPriorHistory || isOld) {
                    return { shouldProcess: false, blockReason: 'audience' };
                }
            }
            // If !contact, it's new, so pass.
        } else if (aiMode === 'whitelist') {
            const contactTags = getTagNames(contact ? contact.tags : []);
            const whitelist = getTagNames(businessConfig.aiWhitelistTags || []);
            const hasTag = contactTags.some(t => whitelist.includes(t));
            if (!hasTag) {
                return { shouldProcess: false, blockReason: 'audience' };
            }
        } else if (aiMode === 'blacklist') {
            const blacklist = getTagNames(businessConfig.aiBlacklistTags || []);
            if (blacklist.length > 0) {
                const contactTags = getTagNames(contact ? contact.tags : []);
                const hasBadTag = contactTags.some(t => blacklist.includes(t));
                if (hasBadTag) {
                    return { shouldProcess: false, blockReason: 'audience' };
                }
            }
        }
    }

    // 4. Operating Hours
    if (!isWithinOperatingHours(businessConfig)) {
        return { shouldProcess: false, blockReason: 'hours' };
    }

    return { shouldProcess: true, blockReason: null };
}

/**
 * Handles database updates or side-effects for messages that were blocked.
 *
 * @param {string} blockReason
 * @param {Object} contact
 * @param {Object} businessConfig
 */
export async function handleBlockedMessage(blockReason, contact, businessConfig) {
    if (blockReason === 'handover' && contact) {
        // 🛑 TRAVA DE SEGURANÇA: Desativa a cobrança automática se o humano assumiu
        if (contact.followUpActive) {
            await Contact.updateOne({ _id: contact._id }, { $set: { followUpActive: false } });
        }
    }
}
