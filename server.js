
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Cấu hình Database (Aiven MySQL)
const db = mysql.createPool({
    host: process.env.DB_HOST,       // Lấy từ Aiven (VD: mysql-10cebc0d...)
    user: process.env.DB_USER,       // Lấy từ Aiven (VD: avnadmin)
    password: process.env.DB_PASSWORD, // Lấy từ Aiven
    database: process.env.DB_NAME || 'defaultdb',
    port: process.env.DB_PORT || 10764,
    ssl: {
        rejectUnauthorized: false // Aiven yêu cầu SSL
    },
    waitForConnections: true,
    connectionLimit: 5, // Giới hạn connection cho gói Free
    queueLimit: 0
});

// Kiểm tra kết nối DB
db.getConnection((err, connection) => {
    if (err) {
        console.error('Lỗi kết nối Database:', err);
    } else {
        console.log('Đã kết nối thành công tới Aiven MySQL!');
        connection.release();
    }
});

// 2. Cấu hình Cloudinary (Lưu ảnh)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'comivn_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});
const upload = multer({ storage: storage });

// Middleware xác thực Admin đơn giản
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    if (token === 'fake-jwt-token-xyz') next(); // Trong thực tế nên dùng JWT verify
    else res.sendStatus(403);
};

// === API ROUTES ===

// Upload ảnh
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: req.file.path });
});

// --- COMICS ---
app.get('/api/comics', (req, res) => {
    db.query('SELECT * FROM comics ORDER BY updated_at DESC', (err, results) => {
        if (err) { console.error(err); return res.status(500).json(err); }
        // Format dữ liệu cho khớp với Frontend
        const comics = results.map(c => ({
            ...c,
            genres: c.genres ? c.genres.split(',') : [],
            isRecommended: c.isRecommended === 1,
            // Để đơn giản, chapters sẽ load chi tiết sau hoặc join bảng nếu cần tối ưu
            chapters: [] 
        }));
        res.json(comics);
    });
});

app.get('/api/comics/:id', (req, res) => {
    const comicSql = 'SELECT * FROM comics WHERE id = ?';
    const chapterSql = 'SELECT * FROM chapters WHERE comicId = ? ORDER BY number DESC';
    
    db.query(comicSql, [req.params.id], (err, comicRes) => {
        if (err || comicRes.length === 0) return res.status(404).json({message: 'Not found'});
        
        const comic = comicRes[0];
        comic.genres = comic.genres ? comic.genres.split(',') : [];
        comic.isRecommended = comic.isRecommended === 1;

        db.query(chapterSql, [req.params.id], (err, chapRes) => {
            comic.chapters = chapRes || [];
            res.json(comic);
        });
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
        if (err) { console.error(err); return res.status(500).json(err); }
        res.json({ message: 'Saved comic' });
    });
});

app.delete('/api/comics/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM comics WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Deleted' });
    });
});

// --- CHAPTERS ---
app.post('/api/chapters', authenticateToken, (req, res) => {
    const { id, comicId, number, title, pages } = req.body;
    
    // 1. Lưu Chapter info
    const sqlChap = `INSERT INTO chapters (id, comicId, number, title) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE number=?, title=?`;
    db.query(sqlChap, [id, comicId, number, title, number, title], (err) => {
        if (err) { console.error(err); return res.status(500).json(err); }

        // 2. Lưu Pages (Xóa cũ thêm mới)
        db.query('DELETE FROM chapter_pages WHERE chapterId = ?', [id], (err) => {
             if (pages && pages.length > 0) {
                 const pageValues = pages.map(p => [id, p.imageUrl, p.pageNumber]);
                 db.query('INSERT INTO chapter_pages (chapterId, imageUrl, pageNumber) VALUES ?', [pageValues], (err) => {
                     if (err) return res.status(500).json(err);
                     // Update thời gian truyện
                     db.query('UPDATE comics SET updated_at = NOW() WHERE id = ?', [comicId]);
                     res.json({ message: 'Chapter saved' });
                 });
             } else {
                 res.json({ message: 'Chapter saved (no pages)' });
             }
        });
    });
});

app.delete('/api/chapters/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM chapters WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Deleted' });
    });
});

app.get('/api/chapters/:id/pages', (req, res) => {
    db.query('SELECT * FROM chapter_pages WHERE chapterId = ? ORDER BY pageNumber ASC', [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// --- GENRES ---
app.get('/api/genres', (req, res) => {
    db.query('SELECT * FROM genres', (err, results) => {
        if (err) return res.status(500).json(err);
        const genres = results.map(g => ({...g, isShowHome: g.isShowHome === 1}));
        res.json(genres);
    });
});

app.post('/api/genres', authenticateToken, (req, res) => {
    const { id, name, slug, isShowHome } = req.body;
    const show = isShowHome ? 1 : 0;
    const sql = 'INSERT INTO genres (id, name, slug, isShowHome) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=?, slug=?, isShowHome=?';
    db.query(sql, [id, name, slug, show, name, slug, show], (err) => {
        if (err) return res.status(500).json(err);
        res.json({message: 'Saved'});
    });
});

app.delete('/api/genres/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM genres WHERE id=?', [req.params.id], (err) => {
        if(err) return res.status(500).json(err);
        res.json({message: 'Deleted'});
    });
});

// --- ADS ---
app.get('/api/ads', (req, res) => {
    db.query('SELECT * FROM ads', (err, results) => {
        if (err) return res.status(500).json(err);
        const ads = results.map(a => ({...a, isActive: a.isActive === 1}));
        res.json(ads);
    });
});

app.post('/api/ads', authenticateToken, (req, res) => {
    const { id, position, imageUrl, linkUrl, isActive, title } = req.body;
    const active = isActive ? 1 : 0;
    const sql = 'INSERT INTO ads (id, position, imageUrl, linkUrl, isActive, title) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position=?, imageUrl=?, linkUrl=?, isActive=?, title=?';
    db.query(sql, [id, position, imageUrl, linkUrl, active, title, position, imageUrl, linkUrl, active, title], (err) => {
        if (err) return res.status(500).json(err);
        res.json({message: 'Saved'});
    });
});

app.delete('/api/ads/:id', authenticateToken, (req, res) => {
    db.query('DELETE FROM ads WHERE id=?', [req.params.id], (err) => {
        if(err) return res.status(500).json(err);
        res.json({message: 'Deleted'});
    });
});

// --- SETTINGS / THEME ---
app.get('/api/theme', (req, res) => {
    db.query('SELECT theme_config FROM settings WHERE id=1', (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length > 0 && results[0].theme_config) {
            // MySQL JSON columns return object directly in some drivers, or string in others
            let config = results[0].theme_config;
            if (typeof config === 'string') config = JSON.parse(config);
            res.json(config);
        } else {
            res.json({});
        }
    });
});

app.post('/api/theme', authenticateToken, (req, res) => {
    const configJson = JSON.stringify(req.body);
    db.query('INSERT INTO settings (id, theme_config) VALUES (1, ?) ON DUPLICATE KEY UPDATE theme_config=?', [configJson, configJson], (err) => {
        if (err) return res.status(500).json(err);
        res.json({message: 'Saved'});
    });
});

// Chạy Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});
