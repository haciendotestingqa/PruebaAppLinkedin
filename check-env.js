// Script temporal para verificar variables de entorno
require('dotenv').config();

console.log('=== CREDENCIALES ACTUALES EN .env ===');
console.log('UPWORK_EMAIL:', process.env.UPWORK_EMAIL ? `"${process.env.UPWORK_EMAIL}"` : 'UNDEFINED');
console.log('UPWORK_PASSWORD:', process.env.UPWORK_PASSWORD ? `"${process.env.UPWORK_PASSWORD}"` : 'UNDEFINED');
console.log('GOOGLE_EMAIL:', process.env.GOOGLE_EMAIL ? `"${process.env.GOOGLE_EMAIL}"` : 'UNDEFINED');
console.log('GOOGLE_PASSWORD:', process.env.GOOGLE_PASSWORD ? `"${process.env.GOOGLE_PASSWORD}"` : 'UNDEFINED');
