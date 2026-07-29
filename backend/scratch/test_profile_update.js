import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Step 1: Login to get token
const loginRes = await fetch('http://localhost:8000/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gmail.com', password: '123456' }),
});
const loginData = await loginRes.json();
const token = loginData.token;
if (!token) { console.error('❌ Login failed:', loginData.message); process.exit(1); }
console.log('✅ Logged in. Token acquired.');

// Step 2: Read the test PNG that was just uploaded back from Cloudinary
// Use a small local file if exists, otherwise create a tiny PNG buffer
const testImgPath = path.join(__dirname, 'test_pic.png');
let imgBuffer;
if (fs.existsSync(testImgPath)) {
  imgBuffer = fs.readFileSync(testImgPath);
} else {
  // Minimal 1x1 red PNG
  imgBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

// Step 3: Send multipart request exactly like Flutter does
const form = new FormData();
form.append('username', 'ahmed');
form.append('bio', 'Updated bio via API test');
form.append('category', 'Developer');
form.append('profilePhoto', imgBuffer, { filename: 'avatar.png', contentType: 'image/png' });

const updateRes = await fetch('http://localhost:8000/user/profile/update', {
  method: 'PUT',
  headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
  body: form,
});

const updateData = await updateRes.json();
if (updateRes.ok && updateData.success) {
  console.log('✅ Profile update SUCCESS!');
  console.log('   Username:', updateData.user.username);
  console.log('   Bio:', updateData.user.bio);
  console.log('   Profile Image:', updateData.user.profileImage);
} else {
  console.error('❌ Profile update FAILED:', updateData.message, updateData.detail || '');
}
