
# Hướng Dẫn Deploy Backend (Kết nối Aiven & Cloudinary)

Bạn đã có file `server.js` trong mã nguồn. Tuy nhiên, Vercel chỉ chạy Frontend tốt nhất. Để chạy Backend (Node.js + MySQL), bạn nên dùng **Render.com** (Miễn phí).

## Bước 1: Chuẩn bị Source Code Backend
1. Tạo một thư mục mới trên máy tính của bạn, ví dụ tên là `comivn-backend`.
2. Copy file `server.js` (từ thư mục gốc hiện tại) vào thư mục `comivn-backend`.
3. Trong thư mục `comivn-backend`, tạo file `package.json` với nội dung sau:
```json
{
  "name": "comivn-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "cloudinary": "^1.41.0",
    "multer-storage-cloudinary": "^4.0.0"
  }
}
```
4. Đẩy thư mục `comivn-backend` này lên GitHub (tạo một repository riêng, ví dụ `comivn-api`).

## Bước 2: Deploy lên Render
1. Vào [Render.com](https://render.com/), chọn **New -> Web Service**.
2. Kết nối với repository `comivn-api` bạn vừa tạo.
3. Ở phần **Environment Variables** trên Render, bạn BẮT BUỘC phải điền các thông tin sau (Lấy từ ảnh Aiven và Cloudinary của bạn):

| Key | Value (Ví dụ - Hãy điền thật của bạn) |
| --- | --- |
| `DB_HOST` | `mysql-10cebc0d-mrhao91-c1e7.j.aivencloud.com` |
| `DB_PORT` | `10764` |
| `DB_USER` | `avnadmin` |
| `DB_PASSWORD` | `(Mật khẩu trong mục Aiven)` |
| `DB_NAME` | `defaultdb` |
| `CLOUDINARY_CLOUD_NAME` | `dqb06kbt1` |
| `CLOUDINARY_API_KEY` | `128754391968113` |
| `CLOUDINARY_API_SECRET` | `(Mật khẩu API Secret)` |

4. Nhấn **Deploy Web Service**.
5. Sau khi xong, Render sẽ cấp cho bạn một link, ví dụ: `https://comivn-api.onrender.com`.

## Bước 3: Kết nối Frontend với Backend
1. Quay lại trang **Vercel** nơi chứa Frontend của bạn.
2. Vào **Settings -> Environment Variables**.
3. Thêm biến: `VITE_API_URL` với giá trị là link Render vừa có (thêm `/api` ở cuối).
   - Ví dụ: `https://comivn-api.onrender.com/api`
4. Thêm biến: `VITE_USE_MOCK` với giá trị `false`.
5. Redeploy Vercel.

Lúc này Web của bạn sẽ lưu dữ liệu vào Aiven và ảnh vào Cloudinary!
