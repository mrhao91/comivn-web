// Safely access env variables
const env: any = import.meta.env || {};

// QUAN TRỌNG: Đặt là false để web kết nối tới Database thật
export const USE_MOCK_DATA = false;

// Xác định URL của API.
// Khi build cho production, nó sẽ lấy từ biến môi trường VITE_API_URL.
// Khi chạy dev, nó sẽ dùng proxy /v1.
export const API_BASE_URL = env.VITE_API_URL || '/v1';
