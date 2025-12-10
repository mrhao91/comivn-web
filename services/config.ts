
// Safely access env variables. In some environments import.meta.env might be undefined.
const env: any = import.meta.env || {};

// Set this to true to use local storage (Mock Data).
// Set this to false to use the Real Backend (Aiven + Cloudinary).
// IMPORTANT: Set VITE_USE_MOCK=false in your .env or Vercel Settings to go live.
export const USE_MOCK_DATA = env.VITE_USE_MOCK === 'false' ? false : true; 

// Base URL for the API.
// On Localhost: http://localhost:3000/api
// On Render/Production: https://your-app-name.onrender.com/api
export const API_BASE_URL = env.VITE_API_URL || 'http://localhost:3000/api';
