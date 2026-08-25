/**
 * MIGRAÇÃO: Normalização de números de telefone
 * 
 * Converte o campo `phone` de TODOS os contatos do formato internacional 
 * (ex: 5511999999999) para o formato nacional (ex: 11999999999).
 * 
 * O campo `whatsappId` permanece intacto (5511999999999@c.us).
 * 
 * Uso:
 *   node backend/scripts/migratePhoneNumbers.js
 * 
 * Dry-run (apenas visualiza as mudanças sem aplicar):
 *   DRY_RUN=true node backend/scripts/migratePhoneNumbers.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { normalizePhone } from '../utils/phoneUtils.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/calango-bot';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function migratePhoneNumbers() {
  console.log(`🔧 Iniciando migração de números de telefone...`);
  console.log(`📌 Modo: ${DRY_RUN ? 'DRY-RUN (sem alterações)' : 'APLICAÇÃO REAL'}`);
  console.log(`📌 MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//<creds>@')}`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');
    
    const db = mongoose.connection.db;
    const contactsCollection = db.collection('contacts');
    
    // Busca TODOS os contatos (não apenas WhatsApp, mas qualquer um com phone)
    const allContacts = await contactsCollection.find({
      phone: { $exists: true, $ne: null, $type: 'string' }
    }).toArray();
    
    console.log(`📊 Total de contatos com phone: ${allContacts.length}`);
    
    const stats = {
      total: allContacts.length,
      changed: 0,
      unchanged: 0,
      skipped: 0,
      errors: 0,
    };
    
    const changes = [];
    
    for (const contact of allContacts) {
      try {
        const originalPhone = contact.phone;
        
        // Pula se já está vazio ou é @lid/@g.us
        if (!originalPhone || originalPhone.includes('@')) {
          stats.skipped++;
          continue;
        }
        
        const normalizedPhone = normalizePhone(originalPhone);
        
        if (normalizedPhone === originalPhone) {
          stats.unchanged++;
          continue;
        }
        
        changes.push({
          _id: contact._id,
          name: contact.name || 'N/A',
          oldPhone: originalPhone,
          newPhone: normalizedPhone,
        });
        
        stats.changed++;
        
        if (!DRY_RUN) {
          await contactsCollection.updateOne(
            { _id: contact._id },
            { $set: { phone: normalizedPhone } }
          );
        }
      } catch (err) {
        console.error(`❌ Erro no contato ${contact._id}: ${err.message}`);
        stats.errors++;
      }
    }
    
    // Exibe resumo
    console.log(`\n📋 RESUMO:`);
    console.log(`   Total processado: ${stats.total}`);
    console.log(`   🔄 Alterados: ${stats.changed}`);
    console.log(`   ✅ Já normalizados: ${stats.unchanged}`);
    console.log(`   ⏭️ Pulados (@lid, vazios): ${stats.skipped}`);
    console.log(`   ❌ Erros: ${stats.errors}`);
    
    // Exibe exemplos das mudanças
    if (changes.length > 0) {
      console.log(`\n📝 Exemplos de mudanças (${Math.min(10, changes.length)} de ${changes.length}):`);
      changes.slice(0, 10).forEach(c => {
        console.log(`   "${c.name}": ${c.oldPhone} → ${c.newPhone}`);
      });
    }
    
    if (DRY_RUN) {
      console.log(`\n⚠️  DRY-RUN: Nenhuma alteração foi aplicada.`);
      console.log(`   Execute sem DRY_RUN para aplicar:`);
      console.log(`   node backend/scripts/migratePhoneNumbers.js`);
    } else {
      console.log(`\n✅ Migração concluída com sucesso!`);
      console.log(`   ${stats.changed} contatos atualizados.`);
    }
    
    // Verifica inconsistências pós-migração
    if (!DRY_RUN && stats.changed > 0) {
      console.log(`\n🔍 Verificando consistência pós-migração...`);
      
      // Verifica se há contatos com mesmo phone após normalização (potenciais duplicados)
      const duplicates = await contactsCollection.aggregate([
        { $match: { phone: { $exists: true, $ne: null } } },
        { $group: { _id: '$phone', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
      ]).toArray();
      
      if (duplicates.length > 0) {
        console.log(`⚠️  ATENÇÃO: ${duplicates.length} números duplicados encontrados após migração:`);
        duplicates.slice(0, 5).forEach(d => {
          console.log(`   📞 ${d._id}: ${d.count} contatos (IDs: ${d.ids.join(', ')})`);
        });
        console.log(`   Recomendação: Mesclar contatos manualmente ou via script de deduplicação.`);
      } else {
        console.log(`   ✅ Nenhum número duplicado encontrado.`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

migratePhoneNumbers();
