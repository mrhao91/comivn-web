
// Safely access env variables
const env: any = import.meta.env || {};

// QUAN TRỌNG: Đặt là false để web kết nối tới Database thật
export const USE_MOCK_DATA = false;

// Đường dẫn API chuẩn. Server.js phải lắng nghe ở /v1
export const API_BASE_URL = '/v1';
