// Safely access env variables
// FIX: Cast `import.meta` to `any` to resolve TypeScript error 'Property 'env' does not exist on type 'ImportMeta''.
const env: any = (import.meta as any).env || {};

// QUAN TRỌNG: Đặt là false để web kết nối tới Database thật
export const USE_MOCK_DATA = false;

// Xác định URL của API.
// Khi build cho production, nó sẽ lấy từ biến môi trường VITE_API_URL.
// Khi chạy dev, nó sẽ dùng proxy /v1.
export const API_BASE_URL = env.VITE_API_URL || '/v1';