import api from '../services/api';

export async function uploadFileToFirebase(file, type = 'product') {
  try {
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${type}_${Date.now()}.${fileExtension}`;
    const contentType = 'image/jpeg';

    // 1. Pede URL assinada para upload ao backend
    const { data } = await api.post('/api/business/request-upload-url', {
      fileName,
      contentType
    });

    const { uploadUrl, filePath, downloadUrl } = data;

    if (!uploadUrl) {
      throw new Error('Backend não retornou uploadUrl');
    }

    // 2. Faz upload direto para Firebase
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`Firebase rejeitou upload (${uploadResponse.status})`);
    }

    // 3. Retorna URL de download (pública, sem assinatura)
    if (!downloadUrl) {
      throw new Error('Backend não retornou downloadUrl');
    }

    console.log('[uploadHelper] ✅ Upload realizado:', filePath);

    return {
      imageUrl: downloadUrl,
      filePath: filePath
    };
  } catch (error) {
    console.error('[uploadHelper] ❌ Erro:', error.message);
    throw error;
  }
}

export async function uploadMultipleFiles(files, type = 'product') {
  const uploadPromises = Array.from(files).map(file => 
    uploadFileToFirebase(file, type)
  );
  
  const results = await Promise.all(uploadPromises);
  return results.map(result => result.imageUrl);
}
