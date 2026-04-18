import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin if not already initialized
let bucket;

try {
  if (!admin.apps.length) {
    let serviceAccount;
    
    if (process.env.FIREBASE_CREDENTIALS) {
      // Production: JSON stringified in environment variable
      serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    } else {
      // Development: Local file
      const credPath = path.join(__dirname, '../config/firebase-credentials.json');
      serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.REACT_APP_FIREBASE_BUCKET
    });
  }
  
  bucket = admin.storage().bucket();
} catch (error) {
  console.error('⚠️ Error initializing Firebase for firebaseHelper:', error.message);
}

/**
 * Deletes a file from Firebase Storage given its public URL.
 * @param {string} imageUrl - The full public URL of the image.
 * @returns {Promise<void>}
 */
export const deleteFromFirebase = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // Extract path from URL
    // Format: https://storage.googleapis.com/BUCKET_NAME/PATH/TO/FILE
    // OR: https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/PATH%2FTO%2FFILE?alt=media...

    let filePath = '';

    if (imageUrl.includes('storage.googleapis.com')) {
       // Standard GCS URL
       const parts = imageUrl.split('/');
       // parts[0] = https:
       // parts[1] =
       // parts[2] = storage.googleapis.com
       // parts[3] = BUCKET_NAME
       // parts[4...] = FILE_PATH
       filePath = parts.slice(4).join('/');
    } else if (imageUrl.includes('firebasestorage.googleapis.com')) {
       // Firebase Storage URL
       const urlObj = new URL(imageUrl);
       const pathName = urlObj.pathname; // /v0/b/BUCKET_NAME/o/PATH
       const encodedPath = pathName.substring(pathName.indexOf('/o/') + 3);
       filePath = decodeURIComponent(encodedPath);
    } else {
       console.warn('Unknown URL format for deletion:', imageUrl);
       return;
    }

    if (filePath) {
        console.log(`🗑️ Deleting from Firebase: ${filePath}`);
        await bucket.file(filePath).delete();
    }

  } catch (error) {
    // Ignore "Not Found" errors (404), throw others
    if (error.code !== 404) {
        console.error('Error deleting from Firebase:', error);
    } else {
        console.warn('File not found in Firebase, skipping:', imageUrl);
    }
  }
};
