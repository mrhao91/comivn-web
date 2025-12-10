
# Hướng Dẫn Cài Đặt Backend (Node.js + MySQL)

## 1. Cấu trúc thư mục trên Hosting
```
/server
  ├── .env
  ├── package.json
  ├── server.js
  ├── db.sql
  └── uploads/         (Tạo thư mục này để lưu ảnh upload)
```

## 2. File `package.json`
Thêm thư viện `multer` để hỗ trợ upload file.

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
    "jsonwebtoken": "^9.0.2",
    "body-parser": "^1.20.2",
    "multer": "^1.4.5-lts.1"
  }
}
```

## 3. Database (SQL) - Cập nhật đầy đủ
Chạy script sau trong phpMyAdmin để tạo toàn bộ bảng:

```sql
-- 1. Bảng Truyện (Comics)
CREATE TABLE IF NOT EXISTS comics (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE, 
    coverImage TEXT,
    author VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'Đang tiến hành',
    rating FLOAT DEFAULT 0,
    views INT DEFAULT 0,
    isRecommended BOOLEAN DEFAULT 0,
    metaTitle VARCHAR(255),
    metaDescription TEXT,
    metaKeywords TEXT,
    genres TEXT, -- Lưu dạng chuỗi JSON hoặc cách nhau dấu phẩy "Action,Adventure"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Bảng Chapters
CREATE TABLE IF NOT EXISTS chapters (
    id VARCHAR(255) PRIMARY KEY,
    comicId VARCHAR(255) NOT NULL,
    number FLOAT NOT NULL,
    title VARCHAR(255),
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comicId) REFERENCES comics(id) ON DELETE CASCADE
);

-- 3. Bảng Chapter Pages (Ảnh nội dung)
CREATE TABLE IF NOT EXISTS chapter_pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chapterId VARCHAR(255) NOT NULL,
    imageUrl TEXT NOT NULL,
    pageNumber INT NOT NULL,
    FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
);

-- 4. Bảng Thể Loại (Genres)
CREATE TABLE IF NOT EXISTS genres (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    isShowHome BOOLEAN DEFAULT 0
);

-- 5. Bảng Quảng Cáo (Ads)
CREATE TABLE IF NOT EXISTS ads (
    id VARCHAR(255) PRIMARY KEY,
    position VARCHAR(50) NOT NULL,
    imageUrl TEXT NOT NULL,
    linkUrl TEXT,
    isActive BOOLEAN DEFAULT 1,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng Bình Luận (Comments)
CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(255) PRIMARY KEY,
    comicId VARCHAR(255) NOT NULL,
    userName VARCHAR(255),
    content TEXT,
    rating INT DEFAULT 5,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    isApproved BOOLEAN DEFAULT 0
);

-- 7. Bảng Trang Tĩnh (Static Pages)
CREATE TABLE IF NOT EXISTS static_pages (
    slug VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT
);

-- 8. Bảng Cấu Hình (Settings/Theme)
-- Chỉ lưu 1 dòng duy nhất cho cấu hình hệ thống
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY DEFAULT 1,
    theme_config JSON
);
INSERT IGNORE INTO settings (id, theme_config) VALUES (1, '{}');
```

## 4. File `server.js` (API Endpoint Mẫu)

```javascript
// ... (Các phần cấu hình express, multer giữ nguyên như cũ)

// === API COMICS ===
app.get('/api/comics', (req, res) => {
    // Join với chapters để lấy số lượng chapter nếu cần, hoặc query đơn giản
    // Ở đây demo query đơn giản, FE tự xử lý chapters
    db.query('SELECT * FROM comics ORDER BY updated_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        const comics = results.map(c => ({
            ...c,
            genres: c.genres ? c.genres.split(',') : [],
            isRecommended: c.isRecommended === 1,
            chapters: [] // Cần query riêng hoặc join nếu muốn trả về luôn
        }));
        res.json(comics);
    });
});

app.post('/api/comics', authenticateToken, (req, res) => {
    const { id, title, slug, coverImage, author, status, genres, description, rating, views, isRecommended, metaTitle, metaDescription, metaKeywords } = req.body;
    
    const genresStr = Array.isArray(genres) ? genres.join(',') : genres;
    const isRecInt = isRecommended ? 1 : 0;

    const sql = `
        INSERT INTO comics (id, title, slug, coverImage, author, status, genres, description, rating, views, isRecommended, metaTitle, metaDescription, metaKeywords)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        title=?, slug=?, coverImage=?, author=?, status=?, genres=?, description=?, rating=?, views=?, isRecommended=?, metaTitle=?, metaDescription=?, metaKeywords=?
    `;
    
    const params = [
        id, title, slug, coverImage, author, status, genresStr, description, rating, views, isRecInt, metaTitle, metaDescription, metaKeywords,
        title, slug, coverImage, author, status, genresStr, description, rating, views, isRecInt, metaTitle, metaDescription, metaKeywords
    ];

    db.query(sql, params, (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Saved comic' });
    });
});

app.delete('/api/comics/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM comics WHERE id=?', [req.params.id], (err) => {
        if(err) return res.status(500).json(err);
        res.json({message: 'Deleted'});
    });
});

// === API SETTINGS (THEME & FOOTER) ===
app.get('/api/theme', (req, res) => {
    db.query('SELECT theme_config FROM settings WHERE id=1', (err, results) => {
        if(err) return res.status(500).json(err);
        if(results.length > 0 && results[0].theme_config) {
             res.json(JSON.parse(results[0].theme_config));
        } else {
             res.json({}); // Default empty
        }
    });
});

app.post('/api/theme', authenticateToken, (req, res) => {
    const configJson = JSON.stringify(req.body);
    db.query('INSERT INTO settings (id, theme_config) VALUES (1, ?) ON DUPLICATE KEY UPDATE theme_config=?', [configJson, configJson], (err) => {
        if(err) return res.status(500).json(err);
        res.json({message: 'Theme saved'});
    });
});

// ... (Các API Chapter, Upload, Ads giữ nguyên logic tương tự, chỉ cần đảm bảo SQL table tồn tại)
```
