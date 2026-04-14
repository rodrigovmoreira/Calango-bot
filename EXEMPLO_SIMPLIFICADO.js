/**
 * EXEMPLO SIMPLIFICADO: Upload Squamata no Calango Bot
 * 
 * Padrão: Seguindo exatamente o Calango Food
 * Máxima simplicidade, sem complexidades desnecessárias
 */

// ============================================
// 1. BACKEND: businessRoutes.js
// ============================================

// POST /api/business/request-upload-url
// Retorna URLs para upload e download
export const requestUploadUrl = async (req, res) => {
  const { fileName, contentType } = req.body;

  // Chama Squamata
  const response = await axios.post(
    `${process.env.SQUAMATA_API_URL}/generate-upload-url`,
    { fileName, contentType },
    { headers: { 'Authorization': process.env.SQUAMATA_API_KEY } }
  );

  // Constrói URL pública para download (sem assinatura)
  const bucketName = process.env.FIREBASE_BUCKET_URL;
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(response.data.filePath)}?alt=media`;

  res.json({
    uploadUrl: response.data.uploadUrl,      // Assinada para PUT
    filePath: response.data.filePath,        // Caminho do arquivo
    downloadUrl: downloadUrl                 // Pública para GET
  });
};

// ============================================
// 2. FRONTEND: uploadHelper.js
// ============================================

export async function uploadFileToFirebase(file, type = 'product') {
  try {
    const fileName = `${type}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;

    // 1. Pede URL assinada
    const { data } = await api.post('/api/business/request-upload-url', {
      fileName,
      contentType: 'image/jpeg'
    });

    const { uploadUrl, downloadUrl } = data;

    // 2. Faz upload direto
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: file
    });

    if (!response.ok) {
      throw new Error(`Firebase: ${response.status}`);
    }

    // 3. Retorna URL de download (pública)
    console.log('[uploadHelper] ✅ Upload realizado');
    return { imageUrl: downloadUrl, filePath: data.filePath };
  } catch (error) {
    console.error('[uploadHelper] ❌', error.message);
    throw error;
  }
}

// ============================================
// 3. FRONTEND: CatalogTab.jsx
// ============================================

const handleImageUpload = async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  setIsUploading(true);
  try {
    const newUrls = await uploadMultipleFiles(files, 'products');
    setNewProduct(prev => ({
      ...prev,
      imageUrls: [...(prev.imageUrls || []), ...newUrls]
    }));
    toast({ title: `${newUrls.length} imagens enviadas!`, status: 'success' });
  } catch (error) {
    toast({ title: 'Erro ao enviar imagem', description: error.message, status: 'error' });
  } finally {
    setIsUploading(false);
  }
};

// ============================================
// 4. COMO USAR
// ============================================

/**
 * 1. User seleciona arquivo no input
 * 2. handleImageUpload é chamado
 * 3. uploadMultipleFiles é executado:
 *    a. Pede URL assinada ao backend
 *    b. Faz PUT direto no Firebase
 *    c. Retorna URL pública da imagem
 * 4. Estado local é atualizado
 * 5. Imagem aparece no preview
 * 6. Quando salva, URL é persistida no DB
 */

// ============================================
// 5. DIFERENÇAS SIGNIFICATIVAS
// ============================================

/**
 * ❌ ANTES (Complexo):
 * - signedUrlHelper.js com Firebase Admin SDK
 * - URLs assinadas que expiram em 7 dias
 * - Backend intermediário desnecessário
 * - ~150 linhas de código
 * 
 * ✅ DEPOIS (Simples):
 * - Sem helpers customizados
 * - URLs públicas que nunca expiram
 * - Backend apenas proxia Squamata
 * - ~40 linhas de código
 * - Segue padrão Calango Food
 */
