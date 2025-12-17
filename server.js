
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ==========================================
// 1. CẤU HÌNH SERVER & MÔI TRƯỜNG
// ==========================================
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Kiểm tra thư viện bắt buộc
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.error("❌ LỖI: Chưa tìm thấy thư mục 'node_modules'.");
    console.error("👉 HÃY CHẠY LỆNH: npm install");
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
let mysql = null;
let multer = null;

try { mysql = require('mysql2'); } catch(e) { console.warn("⚠️ Cảnh báo: Chưa cài mysql2"); }
try { multer = require('multer'); } catch(e) { console.warn("⚠️ Cảnh báo: Chưa cài multer"); }

dotenv.config();
const app = express();

// Tăng giới hạn body để upload ảnh lớn hoặc lưu text dài
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.disable('x-powered-by');

// ==========================================
// 2. CẤU HÌNH LOG & HELPER
// ==========================================
const logError = (context, err) => {
    const time = new Date().toISOString();
    const msg = `[${time}] [${context}] ${err.stack || err}\n`;
    console.error(msg);
    try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), msg); } catch (e) {}
};

// Hàm requestUrl CẢI TIẾN: Hỗ trợ Redirect + Gzip + Advanced Headers
const requestUrl = (url, options = {}, redirectCount = 0) => {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) return reject(new Error('Too many redirects'));

        // Default Browser-like Headers
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Connection': 'keep-alive'
        };

        const mergedHeaders = { ...defaultHeaders, ...options.headers };

        const lib = url.startsWith('http:') ? http : https;
        const parsedUrl = new URL(url);
        
        const reqOpts = {
            method: options.method || 'GET',
            headers: mergedHeaders,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search
        };

        const req = lib.request(reqOpts, (res) => {
            // Xử lý Redirect (301, 302, 307...)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let newUrl = res.headers.location;
                if (!newUrl.startsWith('http')) {
                    newUrl = new URL(newUrl, url).href;
                }
                console.log(`🔀 Redirecting to: ${newUrl}`);
                // Gọi đệ quy để follow redirect
                requestUrl(newUrl, options, redirectCount + 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            const encoding = res.headers['content-encoding'];
            let stream = res;
            
            if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
            else if (encoding === 'br') {
                // Node.js native zlib supports brotli since v10.16.0
                try { stream = res.pipe(zlib.createBrotliDecompress()); } catch(e) {}
            }

            let data = [];
            stream.on('data', chunk => data.push(chunk));
            stream.on('end', () => {
                const buffer = Buffer.concat(data);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    text: buffer.toString() // Mặc định UTF-8
                });
            });
            stream.on('error', (err) => reject(err));
        });
        
        req.on('error', err => reject(err));
        if (options.body) req.write(options.body);
        req.end();
    });
};

// ==========================================
// 3. CẤU HÌNH DATABASE & UPLOAD
// ==========================================

// Config Upload
let uploadMiddleware = null;
if (multer) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    app.use('/uploads', express.static(UPLOAD_DIR));
    
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOAD_DIR),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            const name = `img-${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`;
            cb(null, name);
        }
    });
    uploadMiddleware = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
}

// Config MySQL
let db = null;
if (mysql && process.env.DB_USER) {
    try {
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            charset: 'utf8mb4'
        };
        if (process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
             dbConfig.ssl = { rejectUnauthorized: false };
        }
        db = mysql.createPool(dbConfig);
        db.getConnection((err, conn) => { 
            if(!err) { console.log('✅ KẾT NỐI DATABASE THÀNH CÔNG!'); conn.release(); } 
            else logError('DB_INIT', new Error('Không thể kết nối Database: ' + err.message)); 
        });
    } catch(e) { logError('DB_CONFIG', e); }
}

const safeQuery = (sql, params, res, callback) => {
    if (!db) return res.status(503).json({ error: "Chưa kết nối Database" });
    db.query(sql, params, (err, result) => {
        if (err) {
            logError('SQL_QUERY', err);
            return res.status(500).json({ error: "Lỗi truy vấn: " + err.message });
        }
        callback(result);
    });
};

const authMiddleware = (req, res, next) => {
    const auth = req.headers['authorization'];
    if (auth && auth.split(' ')[1] === 'fake-jwt-token-xyz') next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// ==========================================
// 4. ĐỊNH NGHĨA API ROUTES
// ==========================================
const api = express.Router();

api.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// --- AUTH & UPLOAD ---
api.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!db) return res.status(503).json({ success: false, error: "Database chưa sẵn sàng" });
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, error: "Tài khoản không tồn tại" });
        const user = results[0];
        if (user.password == password) {
            res.json({ success: true, user: { id: user.id, username: user.username, role: user.role }, token: 'fake-jwt-token-xyz' });
        } else {
            res.json({ success: false, error: "Sai mật khẩu" });
        }
    });
});

api.post('/upload', authMiddleware, (req, res) => {
    if (!uploadMiddleware) return res.status(503).json({error: "Chức năng upload chưa cấu hình"});
    uploadMiddleware.single('image')(req, res, (err) => {
        if (err) return res.status(400).json({error: err.message});
        if (!req.file) return res.status(400).json({error: "Chưa chọn file"});
        res.json({ url: `/uploads/${req.file.filename}` });
    });
});

api.get('/media', authMiddleware, (req, res) => {
    if (!fs.existsSync(UPLOAD_DIR)) return res.json([]);
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) return res.json([]);
        const mediaList = files.map(file => {
            const stats = fs.statSync(path.join(UPLOAD_DIR, file));
            return { name: file, url: `/uploads/${file}`, size: stats.size, created: stats.birthtime };
        });
        res.json(mediaList);
    });
});

api.delete('/media/:filename', authMiddleware, (req, res) => {
    const filePath = path.join(UPLOAD_DIR, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => res.json({message: 'Deleted'}));
    else res.status(404).json({error: 'File not found'});
});

// --- COMICS ---
api.get('/comics', (req, res) => {
    const sql = `SELECT c.*, (SELECT id FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as latest_chap_id, (SELECT number FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as latest_chap_number, (SELECT updatedAt FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as latest_chap_date FROM comics c ORDER BY updated_at DESC`;
    safeQuery(sql, [], res, (results) => {
        const comics = results.map(c => ({
            ...c, genres: c.genres ? c.genres.split(',') : [], isRecommended: c.isRecommended === 1,
            chapters: c.latest_chap_id ? [{ id: c.latest_chap_id, number: c.latest_chap_number, updatedAt: c.latest_chap_date, title: `Chapter ${c.latest_chap_number}` }] : []
        }));
        res.json(comics);
    });
});

api.get('/comics/:id', (req, res) => {
    safeQuery('SELECT * FROM comics WHERE id=? OR slug=?', [req.params.id, req.params.id], res, (results) => {
        if (!results.length) return res.status(404).json({message: 'Not found'});
        const comic = results[0];
        comic.genres = comic.genres ? comic.genres.split(',') : [];
        comic.isRecommended = comic.isRecommended === 1;
        safeQuery('SELECT * FROM chapters WHERE comicId=? ORDER BY number DESC', [comic.id], res, (chapters) => {
            comic.chapters = chapters || [];
            res.json(comic);
        });
    });
});

api.post('/comics', authMiddleware, (req, res) => {
    const { id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords } = req.body;
    const genresStr = Array.isArray(genres) ? genres.join(',') : genres;
    const isRecInt = isRecommended ? 1 : 0;
    const sql = `INSERT INTO comics (id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=?, slug=?, coverImage=?, author=?, status=?, genres=?, description=?, views=?, isRecommended=?, metaTitle=?, metaDescription=?, metaKeywords=?`;
    const params = [id, title, slug, coverImage, author, status, genresStr, description, views || 0, isRecInt, metaTitle, metaDescription, metaKeywords, title, slug, coverImage, author, status, genresStr, description, views || 0, isRecInt, metaTitle, metaDescription, metaKeywords];
    safeQuery(sql, params, res, () => res.json({message: 'Saved'}));
});

api.delete('/comics/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM comics WHERE id=?', [req.params.id], res, () => res.json({message: 'Deleted'}));
});

// --- UPDATED VIEW TRACKING ---
api.post('/comics/:id/view', (req, res) => {
    // 1. Tăng view cho truyện
    safeQuery('UPDATE comics SET views = views + 1 WHERE id=?', [req.params.id], res, () => {
        // 2. Tăng view cho thống kê ngày (daily_views)
        if (db) {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            db.query('INSERT INTO daily_views (date, views) VALUES (?, 1) ON DUPLICATE KEY UPDATE views = views + 1', [today]);
        }
        res.json({message: 'View +1'});
    });
});

// --- NEW: ANALYTICS API ---
api.get('/analytics', authMiddleware, (req, res) => {
    if (!db) return res.json({ totalViews: 0, todayViews: 0, monthViews: 0 });

    const queries = {
        total: 'SELECT SUM(views) as total FROM comics',
        today: 'SELECT views FROM daily_views WHERE date = CURRENT_DATE',
        month: 'SELECT SUM(views) as month FROM daily_views WHERE MONTH(date) = MONTH(CURRENT_DATE) AND YEAR(date) = YEAR(CURRENT_DATE)'
    };

    db.query(queries.total, (err, totalRes) => {
        const totalViews = (totalRes && totalRes[0] && totalRes[0].total) || 0;
        
        db.query(queries.today, (err, todayRes) => {
            const todayViews = (todayRes && todayRes[0] && todayRes[0].views) || 0;
            
            db.query(queries.month, (err, monthRes) => {
                const monthViews = (monthRes && monthRes[0] && monthRes[0].month) || 0;
                res.json({ totalViews, todayViews, monthViews });
            });
        });
    });
});

// --- CHAPTERS ---
api.post('/chapters', authMiddleware, (req, res) => {
    const { id, comicId, number, title, pages } = req.body;
    safeQuery('INSERT INTO chapters (id, comicId, number, title) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE number=?, title=?', [id, comicId, number, title, number, title], res, () => {
        safeQuery('DELETE FROM chapter_pages WHERE chapterId=?', [id], res, () => {
            if (pages && pages.length > 0) {
                const values = pages.map(p => [id, p.imageUrl, p.pageNumber]);
                safeQuery('INSERT INTO chapter_pages (chapterId, imageUrl, pageNumber) VALUES ?', [values], res, () => {
                    safeQuery('UPDATE comics SET updated_at=NOW() WHERE id=?', [comicId], res, () => res.json({message: 'Saved'}));
                });
            } else res.json({message: 'Saved (no pages)'});
        });
    });
});

api.delete('/chapters/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM chapters WHERE id=?', [req.params.id], res, () => res.json({message: 'Deleted'}));
});

api.get('/chapters/:id/pages', (req, res) => {
    safeQuery('SELECT * FROM chapter_pages WHERE chapterId=? ORDER BY pageNumber ASC', [req.params.id], res, (r) => res.json(r));
});

// --- GENRES, ADS, THEME, STATIC, USERS, REPORTS, COMMENTS ---
// ... (Giữ nguyên logic CRUD cơ bản để code gọn, tập trung vào Leech)
api.get('/genres', (req, res) => safeQuery('SELECT * FROM genres', [], res, r => res.json(r.map(g => ({...g, isShowHome: g.isShowHome === 1})))));
api.post('/genres', authMiddleware, (req, res) => { const {id,name,slug,isShowHome} = req.body; safeQuery(`INSERT INTO genres (id,name,slug,isShowHome) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=?,slug=?,isShowHome=?`, [id,name,slug,isShowHome?1:0,name,slug,isShowHome?1:0], res, () => res.json({message:'Saved'})); });
api.delete('/genres/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM genres WHERE id=?', [req.params.id], res, () => res.json({message:'Deleted'})));

api.get('/ads', (req, res) => safeQuery('SELECT * FROM ads', [], res, r => res.json(r.map(a => ({...a, isActive: a.isActive === 1})))));
api.post('/ads', authMiddleware, (req, res) => { const {id,position,imageUrl,linkUrl,isActive,title} = req.body; safeQuery(`INSERT INTO ads (id,position,imageUrl,linkUrl,isActive,title) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE position=?,imageUrl=?,linkUrl=?,isActive=?,title=?`, [id,position,imageUrl,linkUrl,isActive?1:0,title,position,imageUrl,linkUrl,isActive?1:0,title], res, () => res.json({message:'Saved'})); });
api.delete('/ads/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM ads WHERE id=?', [req.params.id], res, () => res.json({message:'Deleted'})));

api.get('/theme', (req, res) => { if(!db) return res.json({}); db.query('SELECT theme_config FROM settings WHERE id=1', (e, r) => { if(e||!r.length) return res.json({}); try { res.json(JSON.parse(r[0].theme_config)); } catch { res.json({}); } }); });
api.post('/theme', authMiddleware, (req, res) => { const c = JSON.stringify(req.body); safeQuery(`INSERT INTO settings (id,theme_config) VALUES (1,?) ON DUPLICATE KEY UPDATE theme_config=?`, [c,c], res, () => res.json({message:'Saved'})); });

api.get('/static-pages', (req, res) => safeQuery('SELECT * FROM static_pages', [], res, r => res.json(r)));
api.get('/static-pages/:slug', (req, res) => safeQuery('SELECT * FROM static_pages WHERE slug=?', [req.params.slug], res, r => r.length ? res.json(r[0]) : res.status(404).json({message:'Not found'})));
api.post('/static-pages', authMiddleware, (req, res) => { const {slug,title,content} = req.body; safeQuery(`INSERT INTO static_pages (slug,title,content) VALUES (?,?,?) ON DUPLICATE KEY UPDATE title=?,content=?`, [slug,title,content,title,content], res, () => res.json({message:'Saved'})); });

api.get('/users', authMiddleware, (req, res) => safeQuery('SELECT id,username,role FROM users', [], res, r => res.json(r)));
api.post('/users', authMiddleware, (req, res) => { const {id,username,password,role} = req.body; if(!id) safeQuery('INSERT INTO users (username,password,role) VALUES (?,?,?)', [username,password,role], res, ()=>res.json({message:'Created'})); else if(password) safeQuery('UPDATE users SET username=?,password=?,role=? WHERE id=?', [username,password,role,id], res, ()=>res.json({message:'Updated'})); else safeQuery('UPDATE users SET username=?,role=? WHERE id=?', [username,role,id], res, ()=>res.json({message:'Updated'})); });
api.delete('/users/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM users WHERE id=?', [req.params.id], res, () => res.json({message:'Deleted'})));

api.get('/reports', authMiddleware, (req, res) => safeQuery(`SELECT r.*, c.title as comicTitle, ch.title as chapterTitle FROM reports r LEFT JOIN comics c ON r.comicId=c.id LEFT JOIN chapters ch ON r.chapterId=ch.id ORDER BY r.id DESC`, [], res, r => res.json(r)));
api.post('/reports', (req, res) => safeQuery('INSERT INTO reports (comicId,chapterId,message) VALUES (?,?,?)', [req.body.comicId, req.body.chapterId, req.body.message], res, () => res.json({message:'Sent'})));
api.delete('/reports/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM reports WHERE id=?', [req.params.id], res, () => res.json({message:'Deleted'})));

// --- UPDATED: COMMENTS WITH APPROVAL LOGIC ---

// Get comments (return all for Admin, UI filters for users)
api.get('/comments', (req, res) => {
    safeQuery(`SELECT c.*, co.title as comicTitle FROM comments c LEFT JOIN comics co ON c.comicId = co.id ORDER BY c.date DESC`, [], res, r => {
        // Map isApproved explicitly to boolean
        res.json(r.map(c => ({...c, isApproved: c.isApproved === 1})));
    });
});

// Post comment (Default isApproved = 0)
api.post('/comments', (req, res) => { 
    const {id,comicId,userName,content,date,rating} = req.body; 
    if(!db) return res.json({message:'Saved'}); 
    // Default isApproved = 0 (False)
    db.query(`INSERT INTO comments (id,comicId,userName,content,date,isApproved,rating) VALUES (?,?,?,?,?,0,?)`, [id,comicId,userName,content,date,rating], () => res.json({message:'Saved'})); 
});

// Approve Comment
api.put('/comments/:id/approve', authMiddleware, (req, res) => {
    const commentId = req.params.id;
    // 1. Approve
    safeQuery('UPDATE comments SET isApproved=1 WHERE id=?', [commentId], res, () => {
        // 2. Get comicId of this comment to recalculate rating
        db.query('SELECT comicId FROM comments WHERE id=?', [commentId], (err, results) => {
            if (err || results.length === 0) return res.json({message: 'Approved'});
            
            const comicId = results[0].comicId;
            
            // 3. Calculate new Average Rating for this comic (Only Approved Comments)
            db.query('SELECT AVG(rating) as avgRating FROM comments WHERE comicId=? AND isApproved=1', [comicId], (err, avgRes) => {
                 if (err) return res.json({message: 'Approved but failed to calc rating'});
                 
                 const newRating = (avgRes[0] && avgRes[0].avgRating) ? parseFloat(avgRes[0].avgRating.toFixed(1)) : 5;
                 
                 // 4. Update Comic Table
                 db.query('UPDATE comics SET rating=? WHERE id=?', [newRating, comicId], () => {
                     res.json({message: 'Approved & Rating Updated'});
                 });
            });
        });
    });
});

// Delete Comment
api.delete('/comments/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM comments WHERE id=?', [req.params.id], res, () => res.json({message:'Deleted'}));
});

// --- LEECH PROXY ---
api.post('/leech', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.json({ success: false, error: 'Thiếu URL' });
    
    try {
        const response = await requestUrl(url);
        
        // Phát hiện chặn Bot
        if (response.text.includes('Attention Required! | Cloudflare') || 
            response.text.includes('Just a moment...') || 
            response.text.includes('Checking your browser')) {
            return res.json({ 
                success: false, 
                error: 'Website này có bảo mật Cloudflare. Vui lòng copy HTML thủ công.',
                html: response.text // Gửi HTML về để user debug
            });
        }
        
        res.json({ success: true, html: response.text });
    } catch (error) {
        logError('LEECH', error);
        res.json({ success: false, error: error.message });
    }
});

app.use('/v1', api);

// Serve Frontend
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/v1')) return res.status(404).json({error: 'API not found'});
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send('Backend Server is Running! Upload "dist" folder to root to see Frontend.'));
}

app.listen(PORT, () => {
    console.log(`🚀 SERVER ĐANG CHẠY TẠI PORT: ${PORT}`);
});
