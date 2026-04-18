export async function uploadFileToFirebase(file, type = 'product') {
  try {
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${type}_${Date.now()}.${fileExtension}`;
    const contentType = file.type || 'image/jpeg';

    const uploadApiUrl = process.env.REACT_APP_SQUAMATA_UPLOAD_API_URL;
    const uploadApiKey = process.env.REACT_APP_SQUAMATA_UPLOAD_API_KEY;
    const bucketName = process.env.REACT_APP_FIREBASE_BUCKET;

    if (!uploadApiUrl || !uploadApiKey) {
      throw new Error('Configurações do Squamata Upload ausentes no .env');
    }

    // 1. Pede URL assinada direto para o Squamata-upload
    const response = await fetch(`${uploadApiUrl}/generate-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': uploadApiKey
      },
      body: JSON.stringify({ fileName, contentType })
    });

    if (!response.ok) throw new Error(`Erro no Squamata Upload: ${response.statusText}`);

    const data = await response.json();
    const { uploadUrl, filePath } = data;

    if (!uploadUrl) throw new Error('Squamata Upload não retornou uploadUrl');

    // 2. Faz upload direto para Firebase
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file
    });

    if (!uploadResponse.ok) throw new Error(`Firebase rejeitou upload (${uploadResponse.status})`);

    // 3. Monta a URL pública de download
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;

    console.log('[uploadHelper] ✅ Upload realizado:', filePath);
    return { imageUrl: downloadUrl, filePath: filePath };
  } catch (error) {
    console.error('[uploadHelper] ❌ Erro:', error.message);
    throw error;
  }
}

export async function uploadMultipleFiles(files, type = 'product') {
  const uploadPromises = Array.from(files).map(file => uploadFileToFirebase(file, type));
  const results = await Promise.all(uploadPromises);
  return results.map(result => result.imageUrl);
}