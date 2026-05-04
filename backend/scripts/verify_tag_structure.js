
import mongoose from 'mongoose';
import * as wwebjsService from '../services/wwebjsService.js';
import * as tagService from '../services/tagService.js';
import * as tagController from '../controllers/tagController.js';
import Tag from '../models/Tag.js';

// Run this script from backend/

async function runVerification() {
    try {
        console.log('--- Verifying wwebjsService ---');
        // Removed createLabel as it was removed from the service
        const requiredWwebjsMethods = ['getLabels', 'updateLabel', 'deleteLabel', 'setChatLabels', 'getChatLabels'];
        requiredWwebjsMethods.forEach(method => {
            if (typeof wwebjsService[method] !== 'function') {
                console.error(`❌ wwebjsService missing method: ${method}`);
                process.exit(1);
            } else {
                console.log(`✅ ${method} exists`);
            }
        });

        console.log('\n--- Verifying tagService ---');
        const requiredTagServiceMethods = ['syncWithWhatsapp', 'createTag', 'updateTag', 'deleteTag'];
        requiredTagServiceMethods.forEach(method => {
            if (typeof tagService[method] !== 'function') {
                console.error(`❌ tagService missing method: ${method}`);
                process.exit(1);
            } else {
                console.log(`✅ ${method} exists`);
            }
        });

        console.log('\n--- Verifying tagController ---');
        const requiredControllerMethods = ['syncTags', 'createTag', 'updateTag', 'deleteTag'];
        requiredControllerMethods.forEach(method => {
            if (typeof tagController[method] !== 'function') {
                console.error(`❌ tagController missing method: ${method}`);
                process.exit(1);
            } else {
                console.log(`✅ ${method} exists`);
            }
        });

        console.log('\n--- Verifying Tag Model ---');
        const tagSchema = Tag.schema.paths;
        if (!tagSchema.whatsappId) {
            console.error('❌ Tag model missing whatsappId field');
            process.exit(1);
        }
        console.log('✅ whatsappId field exists');

        console.log('\n✅ ALL CHECKS PASSED');
        process.exit(0);

    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

runVerification();
