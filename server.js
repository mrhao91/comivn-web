


const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { rmSync, unlinkSync, existsSync, readdirSync, statSync } = require('fs');
const crypto = require('crypto');

// Helper for MD5 hashing
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

// ==========================================
// 1. CẤU HÌNH SERVER & MÔI TRƯỜNG
// ==========================================
const PORT = process.env.PORT || 3000;
let UPLOAD_ROOT = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) {
    try { fs.mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch (e) { console.error("Lỗi tạo folder upload gốc:", e); }
}

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
let mysql = null;
let multer = null;
let sharp = null;

try { mysql = require('mysql2'); } catch(e) { console.warn("⚠️ Chưa cài mysql2"); }
try { multer = require('multer'); } catch(e) { console.warn("⚠️ Chưa cài multer"); }
try { sharp = require('sharp'); } catch(e) { console.warn("⚠️ Thư viện `sharp` chưa được cài. Chức năng nén ảnh sẽ bị vô hiệu hóa."); }


dotenv.config();
const app = express();
app.use(compression()); // Kích hoạt Gzip
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
app.disable('x-powered-by');
app.use('/uploads', express.static(UPLOAD_ROOT));

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
const logError = (context, err) => {
    const time = new Date().toISOString();
    const msg = `[${time}] [${context}] ${err.stack || err}\n`;
    console.error(msg);
    try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), msg); } catch (e) {}
};

const compressImageBuffer = async (inputBuffer) => {
    if (!sharp) return { buffer: inputBuffer, ext: '.jpg' }; // Fallback nếu sharp chưa cài
    try {
        const image = sharp(inputBuffer);
        const metadata = await image.metadata();

        // Không xử lý ảnh GIF động để giữ animation
        if (metadata.format === 'gif' && metadata.pages > 1) {
            return { buffer: inputBuffer, ext: '.gif' };
        }
        
        const originalExt = `.${metadata.format || 'jpg'}`;
        const maxDimensions = 1200;

        // Thay đổi kích thước ảnh nếu quá lớn
        if (metadata.width > maxDimensions || metadata.height > maxDimensions) {
            image.resize({
                width: maxDimensions,
                height: maxDimensions,
                fit: 'inside',
                withoutEnlargement: true,
            });
        }
        
        // Tạo các phiên bản nén để so sánh
        const candidates = [{ buffer: inputBuffer, ext: originalExt, size: inputBuffer.length }];

        // Phiên bản WebP (nén mạnh hơn)
        const webpBuffer = await image.webp({ quality: 70, reductionEffort: 6 }).toBuffer();
        candidates.push({ buffer: webpBuffer, ext: '.webp', size: webpBuffer.length });

        // Phiên bản JPEG (nén mạnh hơn), chỉ áp dụng nếu ảnh gốc không phải là ảnh có kênh alpha (PNG, GIF)
        if (metadata.format !== 'png' && metadata.format !== 'gif') {
            const jpegBuffer = await image.jpeg({ quality: 75, mozjpeg: true }).toBuffer();
            candidates.push({ buffer: jpegBuffer, ext: '.jpg', size: jpegBuffer.length });
        }

        // Tìm ra phiên bản có dung lượng nhỏ nhất
        const best = candidates.reduce((smallest, current) => current.size < smallest.size ? current : smallest);
        
        // Chỉ trả về phiên bản nén nếu nó thực sự nhỏ hơn bản gốc
        if (best.size < inputBuffer.length) {
            return { buffer: best.buffer, ext: best.ext };
        } else {
            return { buffer: inputBuffer, ext: originalExt };
        }

    } catch (error) {
        logError('SHARP_COMPRESSION', error);
        return { buffer: inputBuffer, ext: '.jpg' }; // Fallback khi có lỗi
    }
};

const getDirectorySize = (dirPath) => {
    let totalSize = 0;
    try {
        const files = readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = statSync(filePath);
            if (stats.isDirectory()) {
                totalSize += getDirectorySize(filePath);
            } else {
                totalSize += stats.size;
            }
        }
    } catch(e) {
        logError('GET_DIR_SIZE', e);
    }
    return totalSize;
};

const requestUrl = (url, options = {}, redirectCount = 0) => {
    return new Promise((resolve, reject) => {
        if (redirectCount > 10) return reject(new Error('Too many redirects'));
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch(e) { return reject(new Error('URL invalid: ' + url)); }
        
        const defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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
            if (res.statusCode !== 200) {
                 return reject(new Error(`Remote Server Error: ${res.statusCode}`));
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

api.post('/upload-url', authMiddleware, async (req, res) => {
    const { url, folder, chapterNumber, index } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    
    const subFolder = folder ? folder.replace(/[^a-z0-9-]/gi, '_') : 'general';
    const targetDir = path.join(UPLOAD_ROOT, subFolder);
    
    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const response = await requestUrl(url);
        if (response.buffer && response.statusCode === 200) {
            const { buffer: compressedBuffer, ext: newExt } = await compressImageBuffer(response.buffer);

            let filename;
            if (folder && chapterNumber != null && index != null) {
                filename = `${folder}-chap${chapterNumber}-${index}${newExt}`;
            } else {
                filename = `up-${Date.now()}-${Math.round(Math.random()*1E6)}${newExt}`;
            }

            const filepath = path.join(targetDir, filename);
            fs.writeFileSync(filepath, compressedBuffer);
            res.json({ success: true, url: `/uploads/${subFolder}/${filename}` });
        } else {
            res.status(400).json({ success: false, error: `HTTP ${response.statusCode}` });
        }
    } catch (error) {
        logError('UPLOAD_URL', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

if (multer) {
    const upload = multer({ storage: multer.memoryStorage() });
    api.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
        if (!req.file) return res.status(400).json({error: "No file"});
        
        try {
            const { buffer: compressedBuffer, ext: newExt } = await compressImageBuffer(req.file.buffer);

            const folder = req.query.folder || 'general';
            const subFolder = folder.replace(/[^a-z0-9-]/gi, '_');
            const targetDir = path.join(UPLOAD_ROOT, subFolder);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            let filename;
            const originalExt = path.extname(req.file.originalname);
            const baseName = path.basename(req.file.originalname, originalExt);

            if (req.query.overwrite === 'true' && !isNaN(parseInt(baseName))) {
                 filename = baseName + newExt;
            } else {
                const slug = req.query.folder;
                const chapNum = req.query.chapterNumber;
                const index = req.query.index;

                if (slug && chapNum != null && index != null) {
                    filename = `${slug}-chap${chapNum}-${index}${newExt}`;
                } else if (slug) {
                    filename = `cover${newExt}`;
                } else {
                    filename = `up-${Date.now()}-${Math.round(Math.random()*1E6)}${newExt}`;
                }
            }

            const filepath = path.join(targetDir, filename);
            fs.writeFileSync(filepath, compressedBuffer);
            
            res.json({ url: `/uploads/${subFolder}/${filename}` });

        } catch (error) {
            logError('UPLOAD_PROCESSING', error);
            res.status(500).json({ error: 'Failed to process image' });
        }
    });
}

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
        }).promise();

        // Tự động thêm cột 'permissions' nếu chưa có
        (async () => {
            try {
                const [rows] = await db.query(`
                    SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema = ? AND table_name = 'users' AND column_name = 'permissions'
                `, [process.env.DB_NAME]);

                if (rows[0].count === 0) {
                    console.log("⚠️ Cột 'permissions' không tồn tại. Đang thêm...");
                    await db.query('ALTER TABLE users ADD COLUMN permissions TEXT');
                    console.log("✅ Đã thêm cột 'permissions' vào bảng 'users'.");
                }
            } catch (e) { console.error("Lỗi khi kiểm tra/thêm cột 'permissions':", e); }
        })();

    } catch(e) { logError('DB_INIT', e); }
}

const safeQuery = (sql, params, res, callback) => {
    if (!db) return res.status(503).json({ error: "Không thể kết nối đến Database." });
    db.query(sql, params)
        .then(([result]) => callback(result))
        .catch(err => {
            logError('SQL_QUERY', err);
            return res.status(500).json({ error: err.message });
        });
};

// --- AUTH ---
api.post('/login', (req, res) => {
    const { username, password } = req.body;
    safeQuery('SELECT * FROM users WHERE username = ?', [username], res, (r) => {
        if (r.length && r[0].password == md5(password)) {
            const user = r[0];
            let permissions = [];
            try {
                if(user.permissions) permissions = JSON.parse(user.permissions);
            } catch(e){}
            res.json({ 
                success: true, 
                user: { id: user.id, username: user.username, role: user.role, permissions }, 
                token: 'fake-jwt-token-xyz' 
            });
        } else {
            res.json({ success: false, error: "Sai thông tin đăng nhập" });
        }
    });
});

api.get('/users', authMiddleware, (req, res) => {
    safeQuery('SELECT id, username, role, permissions FROM users', [], res, (r) => {
        const usersWithPermissions = r.map(u => {
            let permissions = [];
            if (u.permissions && typeof u.permissions === 'string') {
                try {
                    if (u.permissions.trim().startsWith('[')) {
                        permissions = JSON.parse(u.permissions);
                    }
                } catch (e) { console.error(e); }
            }
            return { ...u, permissions };
        });
        res.json(usersWithPermissions);
    });
});

api.post('/users', authMiddleware, (req, res) => {
    const { id, username, password, role, permissions } = req.body;
    const perms = JSON.stringify(permissions || []);

    if (id) {
        let query = 'UPDATE users SET username=?, role=?, permissions=?';
        const params = [username, role, perms];
        if (password) {
            query += ', password=?';
            params.push(md5(password));
        }
        query += ' WHERE id=?';
        params.push(id);
        safeQuery(query, params, res, () => res.json({ message: 'ok' }));
    } else {
        if (!password) return res.status(400).json({ error: "Password is required" });
        safeQuery('INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)', 
            [username, md5(password), role, perms], res, () => res.json({ message: 'ok' }));
    }
});

api.delete('/users/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM users WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' }));
});

// --- COMICS ---
api.get('/comics', (req, res) => {
    const sql = `
        SELECT c.*, 
        (SELECT COUNT(*) FROM chapters WHERE comicId = c.id) as chapterCount,
        (SELECT id FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as last_id, 
        (SELECT number FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as last_num, 
        (SELECT updatedAt FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as last_date 
        FROM comics c ORDER BY updated_at DESC`;

    safeQuery(sql, [], res, (r) => {
        res.json(r.map(c => ({
            ...c, 
            genres: c.genres ? c.genres.split(',') : [], 
            chapters: c.last_id ? [{id: c.last_id, number: c.last_num, updatedAt: c.last_date, title: `Chap ${c.last_num}`}] : [],
            chapterCount: c.chapterCount || 0
        })));
    });
});

api.get('/comics/:id', (req, res) => {
    safeQuery('SELECT * FROM comics WHERE id=? OR slug=?', [req.params.id, req.params.id], res, (r) => {
        if (!r.length) return res.status(404).json({message: '404'});
        const comic = r[0]; 
        comic.genres = comic.genres ? comic.genres.split(',') : [];
        safeQuery('SELECT * FROM chapters WHERE comicId=? ORDER BY number DESC', [comic.id], res, (ch) => { 
            comic.chapters = ch; 
            res.json(comic); 
        });
    });
});

api.post('/comics', authMiddleware, async (req, res) => {
    let { id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords } = req.body;
    if (slug) {
        const subFolder = slug.replace(/[^a-z0-9-]/gi, '_');
        const comicDir = path.join(UPLOAD_ROOT, subFolder);
        if (!fs.existsSync(comicDir)) {
            try { fs.mkdirSync(comicDir, { recursive: true }); } catch(e) {}
        }
    }
    const g = Array.isArray(genres) ? genres.join(',') : genres;
    const sql = `INSERT INTO comics (id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords) 
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) 
                 ON DUPLICATE KEY UPDATE title=?, slug=?, coverImage=?, author=?, status=?, genres=?, description=?, views=?, isRecommended=?, metaTitle=?, metaDescription=?, metaKeywords=?`;
    const p = [
        id, title, slug, coverImage, author, status, g, description, views||0, isRecommended?1:0, metaTitle, metaDescription, metaKeywords, 
        title, slug, coverImage, author, status, g, description, views||0, isRecommended?1:0, metaTitle, metaDescription, metaKeywords
    ];
    safeQuery(sql, p, res, () => res.json({message: 'ok'}));
});

api.delete('/comics/:id', authMiddleware, (req, res) => {
    safeQuery('SELECT slug FROM comics WHERE id=?', [req.params.id], res, (comicResult) => {
        if (comicResult.length > 0 && comicResult[0].slug) {
            const subFolder = comicResult[0].slug.replace(/[^a-z0-9-]/gi, '_');
            const comicDir = path.join(UPLOAD_ROOT, subFolder);
            try {
                if (existsSync(comicDir)) {
                    rmSync(comicDir, { recursive: true, force: true });
                }
            } catch (e) {
                logError('DELETE_COMIC_FOLDER', e);
            }
        }
        safeQuery('DELETE FROM comics WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' }));
    });
});

api.post('/comics/:id/view', (req, res) => {
    safeQuery('UPDATE comics SET views = views + 1 WHERE id=?', [req.params.id], res, () => {
        if (db) db.query('INSERT INTO daily_views (date, views) VALUES (CURRENT_DATE(), 1) ON DUPLICATE KEY UPDATE views = views + 1');
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
                safeQuery('INSERT INTO chapter_pages (chapterId, imageUrl, pageNumber) VALUES ?', [values], res, async () => {
                    try { await db.query('UPDATE comics SET updated_at=NOW() WHERE id=?', [comicId]); } catch(e){}
                    res.json({message: 'ok'});
                });
            } else {
                res.json({message: 'ok'});
            }
        });
    });
});

api.delete('/chapters/:id', authMiddleware, (req, res) => {
    safeQuery('SELECT imageUrl FROM chapter_pages WHERE chapterId=?', [req.params.id], res, (pages) => {
        pages.forEach(page => {
            if (page.imageUrl && page.imageUrl.startsWith('/uploads/')) {
                const imagePath = path.join(__dirname, page.imageUrl);
                try { if (existsSync(imagePath)) unlinkSync(imagePath); } catch (e) {}
            }
        });
        safeQuery('DELETE FROM chapters WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'}));
    });
});

api.get('/chapters/:id/pages', (req, res) => {
    safeQuery('SELECT * FROM chapter_pages WHERE chapterId=? ORDER BY pageNumber ASC', [req.params.id], res, (r) => res.json(r));
});

// --- GENRES ---
api.get('/genres', (req, res) => safeQuery('SELECT * FROM genres', [], res, r => res.json(r.map(g => ({...g, isShowHome: !!g.isShowHome})))));
api.post('/genres', authMiddleware, (req, res) => {
    const {id,name,slug,isShowHome} = req.body;
    safeQuery(`INSERT INTO genres (id,name,slug,isShowHome) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=?,slug=?,isShowHome=?`, [id,name,slug,isShowHome?1:0,name,slug,isShowHome?1:0], res, () => res.json({message:'ok'}));
});
api.delete('/genres/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM genres WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' }));
});

// --- MEDIA ---
api.get('/media/:path(*)?', authMiddleware, (req, res) => {
    const subPath = req.params.path || '';
    const currentDir = path.resolve(UPLOAD_ROOT, subPath);
    if (!currentDir.startsWith(path.resolve(UPLOAD_ROOT))) return res.status(403).json({ error: 'Access denied' });

    const getFiles = (dir, urlPrefix = '') => {
        let results = [];
        try {
            if (!fs.existsSync(dir)) return [];
            const list = fs.readdirSync(dir);
            list.sort((a, b) => {
                const statA = fs.statSync(path.join(dir, a));
                const statB = fs.statSync(path.join(dir, b));
                if (statA.isDirectory() && !statB.isDirectory()) return -1;
                if (!statA.isDirectory() && statB.isDirectory()) return 1;
                return a.localeCompare(b);
            });
            list.forEach(file => {
                const p = path.join(dir, file);
                const stat = fs.statSync(p);
                if (stat.isDirectory()) {
                    results.push({ name: file, url: '', size: 0, created: stat.birthtime, isDir: true });
                } else {
                    const fileUrl = path.join('/uploads', urlPrefix, file).replace(/\\/g, '/');
                    results.push({ name: file, url: fileUrl, size: stat.size, created: stat.birthtime, isDir: false });
                }
            });
        } catch(e) {}
        return results;
    };
    res.json(getFiles(currentDir, subPath));
});

api.delete('/media', authMiddleware, (req, res) => {
    const { filePath } = req.body;
    const p = path.resolve(UPLOAD_ROOT, filePath);
    if (!p.startsWith(path.resolve(UPLOAD_ROOT))) return res.status(403).json({ error: "Access denied" });
    if (fs.existsSync(p)) {
        if (fs.statSync(p).isDirectory()) return res.status(400).json({error: "Folders must be deleted via FTP"});
        fs.unlink(p, (err) => {
            if (err) return res.status(500).json({error: 'Failed to delete'});
            res.json({message: 'ok'});
        });
    } else res.status(404).json({error: 'not found'});
});

// --- ANALYTICS & STATS ---
api.get('/analytics', authMiddleware, (req, res) => {
    const sql = `SELECT 
        (SELECT SUM(views) FROM comics) as total, 
        (SELECT views FROM daily_views WHERE date = CURRENT_DATE()) as today,
        (SELECT SUM(views) FROM daily_views WHERE date >= CURDATE() - INTERVAL 30 DAY) as month
    `;
    safeQuery(sql, [], res, r => res.json({
        totalViews: r[0].total || 0,
        todayViews: r[0].today || 0,
        monthViews: r[0].month || 0
    }));
});

api.get('/analytics/daily-views', authMiddleware, (req, res) => {
    safeQuery('SELECT date, views FROM daily_views WHERE date >= CURDATE() - INTERVAL 30 DAY ORDER BY date ASC', [], res, r => res.json(r));
});

api.get('/system-stats', authMiddleware, async (req, res) => {
    let databaseRows = 0;
    let imageStorageUsed = 0;
    try {
        imageStorageUsed = getDirectorySize(UPLOAD_ROOT);
        if (db) {
            const [rows] = await db.query(`SELECT SUM(TABLE_ROWS) as totalRows FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`, [process.env.DB_NAME]);
            databaseRows = rows[0]?.totalRows || 0;
        }
    } catch (e) {}
    res.json({ imageStorageUsed, databaseRows, nodeVersion: process.version, platform: os.platform(), arch: os.arch() });
});

// --- REPORTS, ADS, THEME, COMMENTS, STATIC ---
api.get('/reports', authMiddleware, (req, res) => {
    safeQuery(`SELECT r.*, c.title as comicTitle, ch.title as chapterTitle FROM reports r LEFT JOIN comics c ON r.comicId = c.id LEFT JOIN chapters ch ON r.chapterId = ch.id ORDER BY r.created_at DESC`, [], res, r => res.json(r));
});
api.post('/reports', (req, res) => safeQuery('INSERT INTO reports (comicId, chapterId, message) VALUES (?, ?, ?)', [req.body.comicId, req.body.chapterId, req.body.message], res, () => res.json({message: 'ok'})));
api.delete('/reports/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM reports WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' })));

api.get('/ads', (req, res) => safeQuery('SELECT * FROM ads', [], res, r => res.json(r.map(a => ({...a, isActive: a.isActive === 1})))));
api.post('/ads', authMiddleware, (req, res) => {
    const { id, position, imageUrl, linkUrl, isActive, title } = req.body;
    safeQuery('INSERT INTO ads (id, position, imageUrl, linkUrl, isActive, title) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position=?, imageUrl=?, linkUrl=?, isActive=?, title=?', [id, position, imageUrl, linkUrl, isActive?1:0, title, position, imageUrl, linkUrl, isActive?1:0, title], res, () => res.json({ message: 'Saved' }));
});
api.delete('/ads/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM ads WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' })));

api.get('/theme', (req, res) => safeQuery('SELECT theme_config FROM settings WHERE id = 1', [], res, r => res.json(r.length > 0 ? JSON.parse(r[0].theme_config || '{}') : {})));
api.post('/theme', authMiddleware, (req, res) => safeQuery('UPDATE settings SET theme_config = ? WHERE id = 1', [JSON.stringify(req.body)], res, () => res.json({ message: 'ok' })));

api.get('/comments', (req, res) => {
    const sql = `SELECT c.*, co.title as comicTitle FROM comments c LEFT JOIN comics co ON c.comicId = co.id ORDER BY c.date DESC`;
    safeQuery(sql, [], res, (r) => res.json(r.map(c => ({...c, isApproved: c.isApproved === 1}))));
});
api.post('/comments', (req, res) => safeQuery('INSERT INTO comments (id, comicId, userName, content, date, isApproved, rating) VALUES (?, ?, ?, ?, ?, 0, ?)', [req.body.id, req.body.comicId, req.body.userName, req.body.content, req.body.date, req.body.rating], res, () => res.json({message: 'ok'})));
api.put('/comments/:id/approve', authMiddleware, (req, res) => safeQuery('UPDATE comments SET isApproved=1 WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'})));
api.delete('/comments/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM comments WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'})));

api.get('/static-pages', (req, res) => safeQuery('SELECT * FROM static_pages', [], res, r => res.json(r)));
api.get('/static-pages/:slug', (req, res) => safeQuery('SELECT * FROM static_pages WHERE slug = ?', [req.params.slug], res, r => r.length > 0 ? res.json(r[0]) : res.status(404).json({ error: 'Not found' })));
api.post('/static-pages', authMiddleware, (req, res) => {
    const { slug, title, content } = req.body;
    safeQuery(`INSERT INTO static_pages (slug, title, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE title=?, content=?`, [slug, title, content, title, content], res, () => res.json({ message: 'ok' }));
});
api.delete('/static-pages/:slug', authMiddleware, (req, res) => safeQuery('DELETE FROM static_pages WHERE slug = ?', [req.params.slug], res, () => res.json({ message: 'ok' })));

// --- LEECH ---
api.get('/leech-configs', authMiddleware, (req, res) => safeQuery('SELECT * FROM leech_config ORDER BY name', [], res, (r) => res.json(r.map(c => ({...c, uploadCoverImage: !!c.uploadCoverImage})))));
api.post('/leech-configs', authMiddleware, (req, res) => {
    const { id, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute } = req.body;
    const sql = `INSERT INTO leech_config (id, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=?, baseUrl=?, comicTitleSelector=?, comicCoverSelector=?, comicAuthorSelector=?, uploadCoverImage=?, comicDescriptionSelector=?, chapterLinkSelector=?, chapterImageSelector=?, imageSrcAttribute=?`;
    const params = [id, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage?1:0, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage?1:0, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute];
    safeQuery(sql, params, res, () => res.json({ message: 'ok' }));
});
api.delete('/leech-configs/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM leech_config WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' })));

api.post('/leech', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await requestUrl(url);
        if (response.statusCode === 200) res.json({ success: true, html: response.text });
        else res.json({ success: false, error: `HTTP ${response.statusCode}` });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

api.post('/proxy-image', authMiddleware, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    
    // An toàn hơn: chỉ cho phép proxy từ local uploads nếu cần
    if (url.startsWith('/uploads/')) {
        try {
            const relativePath = path.normalize(url.substring('/uploads/'.length)).replace(/^(\.\.[\/\\])+/, '');
            const filePath = path.join(UPLOAD_ROOT, relativePath);
            if (fs.existsSync(filePath)) {
                return res.sendFile(filePath);
            }
        } catch(e) { /* Fallback to remote fetch */ }
    }

    try {
        const response = await requestUrl(url);
        if (response.statusCode === 200) {
            res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
            res.send(response.buffer);
        } else {
            res.status(response.statusCode).send('Error');
        }
    } catch (error) {
        logError('PROXY_IMAGE', error);
        res.status(500).send(error.message);
    }
});

app.use('/v1', api);

// Handle robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  const content = `User-agent: *
Allow: /

Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`;
  res.send(content);
});


const staticPath = path.join(__dirname, 'dist');
app.use(express.static(staticPath));
app.get('*', (req, res) => res.sendFile(path.join(staticPath, 'index.html')));

http.createServer(app).listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
});