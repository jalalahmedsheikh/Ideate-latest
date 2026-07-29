import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

cloudinary.config({
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  cloud_name: process.env.CLOUD_NAME,
});

console.log('Cloud name:', process.env.CLOUD_NAME);
console.log('API Key:', process.env.API_KEY ? '✓ Set' : '✗ Missing');
console.log('API Secret:', process.env.API_SECRET ? '✓ Set' : '✗ Missing');

// Tiny 1x1 red PNG as base64
const base64Img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

try {
  console.log('\nUploading test image to Cloudinary...');
  const result = await cloudinary.uploader.upload(base64Img, {
    resource_type: 'auto',
    folder: 'ideate_profiles',
  });
  console.log('✅ SUCCESS! URL:', result.secure_url);
  console.log('   Public ID:', result.public_id);
} catch (err) {
  console.error('❌ FAILED:', err.message);
  if (err.http_code) console.error('   HTTP Code:', err.http_code);
}
