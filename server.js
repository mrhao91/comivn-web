
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ==========================================
// 1. CẤU HÌNH SERVER & MÔI TRƯỜNG
// ==========================================
const PORT = process.env.PORT || 3000;

// XÁC ĐỊNH THƯ MỤC UPLOAD GỐC (Ưu tiên dist/uploads trên cPanel)
let UPLOAD_ROOT = path.join(__dirname, 'uploads');
if (fs.existsSync(path.join(__dirname, 'dist'))) {
    UPLOAD_ROOT = path.join(__dirname, 'dist', 'uploads');
}

if (!fs.existsSync(UPLOAD_ROOT)) {
    try { fs.mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch (e) { console.error("Lỗi tạo folder upload gốc:", e); }
}

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
let mysql = null;
let multer = null;

try { mysql = require('mysql2'); } catch(e) { console.warn("⚠️ Chưa cài mysql2"); }
try { multer = require('multer'); } catch(e) { console.warn("⚠️ Chưa cài multer"); }

dotenv.config();
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.disable('x-powered-by');

app.use('/uploads', express.static(UPLOAD_ROOT));

// ==========================================
// 2. HELPER FUNCTIONS (Request & Bypass)
// ==========================================
const logError = (context, err) => {
    const time = new Date().toISOString();
    const msg = `[${time}] [${context}] ${err.stack || err}\n`;
    console.error(msg);
    try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), msg); } catch (e) {}
};

const requestUrl = (url, options = {}, redirectCount = 0) => {
    return new Promise((resolve, reject) => {
        if (redirectCount > 10) return reject(new Error('Too many redirects'));
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch(e) { return reject(new Error('URL invalid: ' + url)); }
        
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': parsedUrl.origin + '/',
            'Connection': 'keep-alive',
            'Accept-Language': 'vi-VN,vi;q=0.9'
        };
        
        const mergedHeaders = { ...defaultHeaders, ...options.headers };
        const lib = url.startsWith('http:') ? http : https;
        
        const req = lib.request({
            method: options.method || 'GET',
            headers: mergedHeaders,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            timeout: 25000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let newUrl = res.headers.location;
                if (!newUrl.startsWith('http')) newUrl = new URL(newUrl, url).href;
                return requestUrl(newUrl, options, redirectCount + 1).then(resolve).catch(reject);
            }
            const encoding = res.headers['content-encoding'];
            let stream = res;
            if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
            else if (encoding === 'br') { try { stream = res.pipe(zlib.createBrotliDecompress()); } catch(e) {} }
            
            let data = [];
            stream.on('data', chunk => data.push(chunk));
            stream.on('end', () => {
                const buffer = Buffer.concat(data);
                resolve({ statusCode: res.statusCode, headers: res.headers, buffer: buffer, text: buffer.toString('utf8') });
            });
            stream.on('error', (err) => reject(err));
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.on('error', err => reject(err));
        if (options.body) req.write(options.body);
        req.end();
    });
};

// ==========================================
// 3. API ROUTES
// ==========================================
const api = express.Router();

const authMiddleware = (req, res, next) => {
    const auth = req.headers['authorization'];
    if (auth && auth.split(' ')[1] === 'fake-jwt-token-xyz') next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// API: Tải ảnh leech từ URL về thư mục riêng của truyện
api.post('/upload-url', authMiddleware, async (req, res) => {
    const { url, folder } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    
    // Tên thư mục: uploads/[folder] (slug truyện)
    const subFolder = folder ? folder.replace(/[^a-z0-9-]/gi, '_') : 'general';
    const targetDir = path.join(UPLOAD_ROOT, subFolder);
    
    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const response = await requestUrl(url);
        if (response.buffer && response.statusCode === 200) {
            const contentType = response.headers['content-type'] || '';
            let ext = '.jpg';
            if (contentType.includes('image/png')) ext = '.png';
            else if (contentType.includes('image/webp')) ext = '.webp';
            
            const filename = `img-${Date.now()}-${Math.round(Math.random()*1E6)}${ext}`;
            const filepath = path.join(targetDir, filename);
            
            fs.writeFileSync(filepath, response.buffer);
            res.json({ success: true, url: `/uploads/${subFolder}/${filename}` });
        } else {
            res.status(400).json({ success: false, error: `HTTP ${response.statusCode}` });
        }
    } catch (error) {
        logError('UPLOAD_URL', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Upload ảnh từ máy tính vào thư mục riêng
if (multer) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const folder = req.query.folder || 'general';
            const subFolder = folder.replace(/[^a-z0-9-]/gi, '_');
            const targetDir = path.join(UPLOAD_ROOT, subFolder);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            cb(null, targetDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, `up-${Date.now()}-${Math.round(Math.random()*1E6)}${ext}`);
        }
    });
    const upload = multer({ storage });
    api.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
        if (!req.file) return res.status(400).json({error: "No file"});
        const folder = req.query.folder || 'general';
        res.json({ url: `/uploads/${folder}/${req.file.filename}` });
    });
}

// Database Connection
let db = null;
if (mysql && process.env.DB_USER) {
    try {
        db = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            charset: 'utf8mb4'
        });
    } catch(e) { logError('DB_INIT', e); }
}

const safeQuery = (sql, params, res, callback) => {
    if (!db) return res.status(503).json({ error: "No DB Connection" });
    db.query(sql, params, (err, result) => {
        if (err) { logError('SQL', err); return res.status(500).json({ error: err.message }); }
        callback(result);
    });
};

// --- AUTH ---
api.post('/login', (req, res) => {
    const { username, password } = req.body;
    safeQuery('SELECT * FROM users WHERE username = ?', [username], res, (r) => {
        if (r.length && r[0].password == password) res.json({ success: true, user: { id: r[0].id, username: r[0].username, role: r[0].role }, token: 'fake-jwt-token-xyz' });
        else res.json({ success: false, error: "Sai thông tin đăng nhập" });
    });
});

// --- COMICS ---
api.get('/comics', (req, res) => {
    const sql = `SELECT c.*, (SELECT id FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as last_id, (SELECT number FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as last_num, (SELECT updatedAt FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as last_date FROM comics c ORDER BY updated_at DESC`;
    safeQuery(sql, [], res, (r) => res.json(r.map(c => ({...c, genres: c.genres ? c.genres.split(',') : [], chapters: c.last_id ? [{id: c.last_id, number: c.last_num, updatedAt: c.last_date, title: `Chap ${c.last_num}`}] : []}))));
});

api.get('/comics/:id', (req, res) => {
    safeQuery('SELECT * FROM comics WHERE id=? OR slug=?', [req.params.id, req.params.id], res, (r) => {
        if (!r.length) return res.status(404).json({message: '404'});
        const comic = r[0]; comic.genres = comic.genres ? comic.genres.split(',') : [];
        safeQuery('SELECT * FROM chapters WHERE comicId=? ORDER BY number DESC', [comic.id], res, (ch) => { comic.chapters = ch; res.json(comic); });
    });
});

api.post('/comics', authMiddleware, (req, res) => {
    const { id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords } = req.body;
    
    // TÍNH NĂNG MỚI: TỰ ĐỘNG TẠO THƯ MỤC THEO SLUG TRÊN SERVER
    if (slug) {
        const subFolder = slug.replace(/[^a-z0-9-]/gi, '_');
        const comicDir = path.join(UPLOAD_ROOT, subFolder);
        if (!fs.existsSync(comicDir)) {
            try { 
                fs.mkdirSync(comicDir, { recursive: true }); 
                console.log(`✅ Đã tạo thư mục truyện: ${subFolder}`);
            } catch(e) { console.error("❌ Lỗi tạo thư mục truyện:", e); }
        }
    }

    const g = Array.isArray(genres) ? genres.join(',') : genres;
    const sql = `INSERT INTO comics (id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?, slug=?, coverImage=?, author=?, status=?, genres=?, description=?, views=?, isRecommended=?, metaTitle=?, metaDescription=?, metaKeywords=?`;
    const p = [id, title, slug, coverImage, author, status, g, description, views||0, isRecommended?1:0, metaTitle, metaDescription, metaKeywords, title, slug, coverImage, author, status, g, description, views||0, isRecommended?1:0, metaTitle, metaDescription, metaKeywords];
    safeQuery(sql, p, res, () => res.json({message: 'ok'}));
});

api.delete('/comics/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM comics WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'})));

api.post('/comics/:id/view', (req, res) => {
    safeQuery('UPDATE comics SET views = views + 1 WHERE id=?', [req.params.id], res, () => {
        if (db) db.query('INSERT INTO daily_views (date, views) VALUES (CURRENT_DATE, 1) ON DUPLICATE KEY UPDATE views = views + 1');
        res.json({message: 'ok'});
    });
});

// --- CHAPTERS ---
api.post('/chapters', authMiddleware, (req, res) => {
    const { id, comicId, number, title, pages } = req.body;
    safeQuery('INSERT INTO chapters (id, comicId, number, title) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE number=?, title=?', [id, comicId, number, title, number, title], res, () => {
        safeQuery('DELETE FROM chapter_pages WHERE chapterId=?', [id], res, () => {
            if (pages && pages.length) {
                const values = pages.map(p => [id, p.imageUrl, p.pageNumber]);
                safeQuery('INSERT INTO chapter_pages (chapterId, imageUrl, pageNumber) VALUES ?', [values], res, () => {
                    db.query('UPDATE comics SET updated_at=NOW() WHERE id=?', [comicId]);
                    res.json({message: 'ok'});
                });
            } else res.json({message: 'ok'});
        });
    });
});

api.delete('/chapters/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM chapters WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'})));
api.get('/chapters/:id/pages', (req, res) => safeQuery('SELECT * FROM chapter_pages WHERE chapterId=? ORDER BY pageNumber ASC', [req.params.id], res, (r) => res.json(r)));

// --- GENRES ---
api.get('/genres', (req, res) => safeQuery('SELECT * FROM genres', [], res, r => res.json(r.map(g => ({...g, isShowHome: !!g.isShowHome})))));
api.post('/genres', authMiddleware, (req, res) => {
    const {id,name,slug,isShowHome} = req.body;
    safeQuery(`INSERT INTO genres (id,name,slug,isShowHome) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=?,slug=?,isShowHome=?`, [id,name,slug,isShowHome?1:0,name,slug,isShowHome?1:0], res, () => res.json({message:'ok'}));
});

// --- MEDIA ---
api.get('/media', authMiddleware, (req, res) => {
    const getFiles = (dir, prefix = '') => {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const p = path.join(dir, file);
            const stat = fs.statSync(p);
            if (stat && stat.isDirectory()) {
                results.push({ name: file, url: `/uploads/${prefix}${file}`, size: 0, created: stat.birthtime, isDir: true });
                // We don't recurse here to keep UI flat but we could
            } else {
                results.push({ name: file, url: `/uploads/${prefix}${file}`, size: stat.size, created: stat.birthtime, isDir: false });
            }
        });
        return results;
    };
    try {
        res.json(getFiles(UPLOAD_ROOT));
    } catch(e) { res.json([]); }
});

api.delete('/media/:f', authMiddleware, (req, res) => {
    const p = path.join(UPLOAD_ROOT, req.params.f);
    if (fs.existsSync(p)) {
        const s = fs.statSync(p);
        if (s.isDirectory()) res.status(400).json({error: "Phải xóa qua FTP/File Manager"});
        else fs.unlink(p, () => res.json({message: 'ok'}));
    } else res.status(404).json({error: 'not found'});
});

// --- ANALYTICS ---
api.get('/analytics', authMiddleware, (req, res) => {
    if (!db) return res.json({ totalViews: 0, todayViews: 0, monthViews: 0 });
    db.query('SELECT (SELECT SUM(views) FROM comics) as total, (SELECT views FROM daily_views WHERE date = CURRENT_DATE) as today, (SELECT SUM(views) FROM daily_views WHERE MONTH(date) = MONTH(CURRENT_DATE)) as month', (err, r) => {
        if (err) return res.status(500).json(err);
        res.json({ totalViews: r[0].total || 0, todayViews: r[0].today || 0, monthViews: r[0].month || 0 });
    });
});

// --- REPORTS ---
api.get('/reports', authMiddleware, (req, res) => {
    const sql = `SELECT r.*, c.title as comicTitle, ch.title as chapterTitle FROM reports r LEFT JOIN comics c ON r.comicId = c.id LEFT JOIN chapters ch ON r.chapterId = ch.id ORDER BY r.created_at DESC`;
    safeQuery(sql, [], res, r => res.json(r));
});
api.post('/reports', (req, res) => safeQuery('INSERT INTO reports (comicId, chapterId, message) VALUES (?, ?, ?)', [req.body.comicId, req.body.chapterId, req.body.message], res, () => res.json({message: 'ok'})));

// --- ADS ---
api.get('/ads', (req, res) => safeQuery('SELECT * FROM ads', [], res, r => res.json(r.map(a => ({...a, isActive: a.isActive === 1})))));
api.post('/ads', authMiddleware, (req, res) => {
    const { id, position, imageUrl, linkUrl, isActive, title } = req.body;
    const active = isActive ? 1 : 0;
    const sql = 'INSERT INTO ads (id, position, imageUrl, linkUrl, isActive, title) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position=?, imageUrl=?, linkUrl=?, isActive=?, title=?';
    db.query(sql, [id, position, imageUrl, linkUrl, active, title, position, imageUrl, linkUrl, active, title], (err) => {
        if (err) return res.status(500).json(err);
        res.json({message: 'Saved'});
    });
});

// --- COMMENTS ---
api.get('/comments', (req, res) => {
    const sql = `SELECT c.*, co.title as comicTitle FROM comments c LEFT JOIN comics co ON c.comicId = co.id ORDER BY c.date DESC`;
    safeQuery(sql, [], res, r => res.json(r.map(c => ({...c, isApproved: c.isApproved === 1}))));
});
api.post('/comments', (req, res) => safeQuery('INSERT INTO comments (id, comicId, userName, content, date, isApproved, rating) VALUES (?, ?, ?, ?, ?, 0, ?)', [req.body.id, req.body.comicId, req.body.userName, req.body.content, req.body.date, req.body.rating], res, () => res.json({message: 'ok'})));
api.put('/comments/:id/approve', authMiddleware, (req, res) => safeQuery('UPDATE comments SET isApproved=1 WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'})));
api.delete('/comments/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM comments WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'})));

// --- LEECH PROXY ---
api.post('/leech', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.json({ success: false, error: 'missing url' });
    try {
        const response = await requestUrl(url);
        // Phát hiện Cloudflare
        if (response.text.includes('Attention Required!') || response.text.includes('Just a moment...') || response.text.includes('Checking your browser')) {
            return res.json({ success: false, error: 'Cloudflare protected', html: response.text });
        }
        res.json({ success: true, html: response.text });
    } catch (error) {
        logError('LEECH_API', error);
        res.json({ success: false, error: error.message });
    }
});

app.use('/v1', api);

// Serve Frontend
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/v1')) return res.status(404).json({error: '404'});
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send('Backend Server is Running!'));
}

app.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT}`));
