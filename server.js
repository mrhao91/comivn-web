
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

// XÁC ĐỊNH THƯ MỤC UPLOAD GỐC
let UPLOAD_ROOT = path.join(__dirname, 'uploads');

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

// NEW: Function to get directory size recursively
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

// API: Tải ảnh leech từ URL về host
api.post('/upload-url', authMiddleware, async (req, res) => {
    const { url, folder, chapterNumber, index } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });
    
    const subFolder = folder ? folder.replace(/[^a-z0-9-]/gi, '_') : 'general';
    const targetDir = path.join(UPLOAD_ROOT, subFolder);
    
    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const response = await requestUrl(url, { headers: { Referer: url } });
        if (response.buffer && response.statusCode === 200) {
            const contentType = response.headers['content-type'] || '';
            let ext = '.jpg';
            if (contentType.includes('image/png')) ext = '.png';
            else if (contentType.includes('image/webp')) ext = '.webp';
            
            let filename;
            if (folder && chapterNumber != null && index != null) {
                filename = `${folder}-chap${chapterNumber}-${index}${ext}`;
            } else if (folder) {
                filename = `cover${ext}`;
            } else {
                filename = `up-${Date.now()}-${Math.round(Math.random()*1E6)}${ext}`;
            }

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

// API: Upload ảnh từ máy tính
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
            const slug = req.query.folder;
            const chapNum = req.query.chapterNumber;
            const index = req.query.index;

            if (slug && chapNum != null && index != null) {
                cb(null, `${slug}-chap${chapNum}-${index}${ext}`);
            } else if (slug) {
                cb(null, `cover${ext}`);
            } else {
                cb(null, `up-${Date.now()}-${Math.round(Math.random()*1E6)}${ext}`);
            }
        }
    });
    const upload = multer({ storage });
    api.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
        if (!req.file) return res.status(400).json({error: "No file"});
        const folder = req.query.folder || 'general';
        const subFolder = folder.replace(/[^a-z0-9-]/gi, '_');
        res.json({ url: `/uploads/${subFolder}/${req.file.filename}` });
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
        }).promise(); // Use promise wrapper

        // NEW: Self-healing DB schema
        (async () => {
            try {
                const [rows] = await db.query(`
                    SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE table_schema = ? AND table_name = 'users' AND column_name = 'permissions'
                `, [process.env.DB_NAME]);

                if (rows[0].count === 0) {
                    console.log("⚠️  Cột 'permissions' không tồn tại. Đang tự động thêm vào bảng 'users'...");
                    await db.query('ALTER TABLE users ADD COLUMN permissions TEXT');
                    console.log("✅  Đã thêm cột 'permissions' thành công.");
                }
            } catch (e) {
                console.error("❌ Lỗi khi kiểm tra/thêm cột 'permissions':", e);
            }
        })();

    } catch(e) { logError('DB_INIT', e); }
}

const safeQuery = (sql, params, res, callback) => {
    if (!db) return res.status(503).json({ error: "No DB Connection" });
    db.query(sql, params)
        .then(([result]) => callback(result))
        .catch(err => {
            logError('SQL', err);
            return res.status(500).json({ error: err.message });
        });
};

// --- AUTH ---
api.post('/login', (req, res) => {
    const { username, password } = req.body;
    safeQuery('SELECT * FROM users WHERE username = ?', [username], res, (r) => {
        if (r.length && r[0].password == md5(password)) {
            const user = r[0];
            const permissions = user.permissions ? JSON.parse(user.permissions) : [];
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


// --- USERS ---
api.get('/users', authMiddleware, (req, res) => {
    safeQuery('SELECT id, username, role, permissions FROM users', [], res, (r) => {
        const usersWithPermissions = r.map(u => {
            let permissions = [];
            if (u.permissions && typeof u.permissions === 'string') {
                try {
                    // Only parse if it looks like a valid JSON array to avoid errors with empty strings
                    if (u.permissions.trim().startsWith('[')) {
                        permissions = JSON.parse(u.permissions);
                    }
                } catch (e) {
                    console.error(`[Server] Failed to parse permissions for user ${u.id}:`, u.permissions);
                    // Keep permissions as empty array on failure
                }
            }
            return { ...u, permissions };
        });
        res.json(usersWithPermissions);
    });
});

api.post('/users', authMiddleware, (req, res) => {
    const { id, username, password, role, permissions } = req.body;
    const perms = JSON.stringify(permissions || []);

    if (id) { // Update
        let query = 'UPDATE users SET username=?, role=?, permissions=?';
        const params = [username, role, perms];
        if (password) {
            query += ', password=?';
            params.push(md5(password));
        }
        query += ' WHERE id=?';
        params.push(id);
        safeQuery(query, params, res, () => res.json({ message: 'ok' }));
    } else { // Insert
        if (!password) return res.status(400).json({ error: "Password is required for new user" });
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
    const originalBody = { ...req.body };
    let { id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords } = req.body;

    if (id) {
        try {
            const [rows] = await db.query('SELECT title, author, coverImage, description, slug FROM comics WHERE id = ?', [id]);
            if (rows.length > 0) {
                const existing = rows[0];
                title = (existing.title && existing.title.trim() !== '') ? existing.title : title;
                author = (existing.author && existing.author.trim() !== '') ? existing.author : author;
                coverImage = (existing.coverImage && existing.coverImage.trim() !== '') ? existing.coverImage : coverImage;
                description = (existing.description && existing.description.trim() !== '') ? existing.description : description;
                if (title === existing.title) {
                    slug = existing.slug;
                }
            }
        } catch (e) {
            logError('COMIC_FETCH_FOR_UPDATE', e);
        }
    }

    if (slug) {
        const subFolder = slug.replace(/[^a-z0-9-]/gi, '_');
        const comicDir = path.join(UPLOAD_ROOT, subFolder);
        if (!fs.existsSync(comicDir)) {
            try { fs.mkdirSync(comicDir, { recursive: true }); } catch(e) {}
        }
    }

    const g = Array.isArray(genres) ? genres.join(',') : genres;
    const sql = `INSERT INTO comics (id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?, slug=?, coverImage=?, author=?, status=?, genres=?, description=?, views=?, isRecommended=?, metaTitle=?, metaDescription=?, metaKeywords=?`;
    const p = [id, title, slug, coverImage, author, status, g, description, views||0, isRecommended?1:0, metaTitle, metaDescription, metaKeywords, title, slug, coverImage, author, status, g, description, views||0, isRecommended?1:0, metaTitle, metaDescription, metaKeywords];
    
    try {
        await db.query(sql, p);
        res.json({message: 'ok'});
    } catch(err) {
        logError('SQL_SAVE_COMIC', err);
        res.status(500).json({ error: err.message });
    }
});

api.delete('/comics/:id', authMiddleware, (req, res) => {
    safeQuery('SELECT slug FROM comics WHERE id=?', [req.params.id], res, (comicResult) => {
        if (comicResult.length > 0 && comicResult[0].slug) {
            const comicDir = path.join(UPLOAD_ROOT, comicResult[0].slug);
            try {
                if (existsSync(comicDir)) {
                    rmSync(comicDir, { recursive: true, force: true });
                }
            } catch (e) { logError('DELETE_COMIC_FOLDER', e); }
        }
        safeQuery('DELETE FROM comics WHERE id=?', [req.params.id], res, () => {
            safeQuery('DELETE FROM chapters WHERE comicId=?', [req.params.id], res, () => res.json({message: 'ok'}));
        });
    });
});

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
                try {
                    if (existsSync(imagePath)) unlinkSync(imagePath);
                } catch (e) { logError('DELETE_CHAPTER_IMAGE', e); }
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
    // Normalize and resolve to prevent traversal attacks
    const currentDir = path.resolve(UPLOAD_ROOT, subPath);

    // Security check: Ensure the resolved path is within UPLOAD_ROOT
    if (!currentDir.startsWith(path.resolve(UPLOAD_ROOT))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const getFiles = (dir, urlPrefix = '') => {
        let results = [];
        try {
            if (!fs.existsSync(dir)) {
                return [];
            }
            const list = fs.readdirSync(dir);
            
            // Sort to show folders first, then by name
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
                if (stat && stat.isDirectory()) {
                    results.push({ name: file, url: '', size: 0, created: stat.birthtime, isDir: true });
                } else {
                    const fileUrl = path.join('/uploads', urlPrefix, file).replace(/\\/g, '/');
                    results.push({ name: file, url: fileUrl, size: stat.size, created: stat.birthtime, isDir: false });
                }
            });
        } catch(e) {
            logError('GET_MEDIA', e);
        }
        return results;
    };
    res.json(getFiles(currentDir, subPath));
});

api.delete('/media', authMiddleware, (req, res) => {
    const { filePath } = req.body;
    if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
    }

    const p = path.resolve(UPLOAD_ROOT, filePath);

    if (!p.startsWith(path.resolve(UPLOAD_ROOT))) {
        return res.status(403).json({ error: "Access denied" });
    }

    if (fs.existsSync(p)) {
        const s = fs.statSync(p);
        if (s.isDirectory()) {
            return res.status(400).json({error: "Phải xóa qua FTP/File Manager"});
        }
        fs.unlink(p, (err) => {
            if (err) {
                 logError('DELETE_MEDIA', err);
                return res.status(500).json({error: 'Failed to delete file'});
            }
            res.json({message: 'ok'});
        });
    } else {
        res.status(404).json({error: 'not found'});
    }
});


// --- ANALYTICS ---
api.get('/analytics', authMiddleware, (req, res) => {
    if (!db) return res.json({ totalViews: 0, todayViews: 0, monthViews: 0 });
    db.query('SELECT (SELECT SUM(views) FROM comics) as total, (SELECT views FROM daily_views WHERE date = CURRENT_DATE) as today, (SELECT SUM(views) FROM daily_views WHERE MONTH(date) = MONTH(CURRENT_DATE)) as month').then(([[r]]) => {
        res.json({ totalViews: r.total || 0, todayViews: r.today || 0, monthViews: r.month || 0 });
    }).catch(err => res.status(500).json(err));
});

// NEW: SYSTEM STATS
api.get('/system-stats', authMiddleware, async (req, res) => {
    let databaseRows = 0;
    let imageStorageUsed = 0;
    try {
        imageStorageUsed = getDirectorySize(UPLOAD_ROOT);
        if (db) {
            const [rows] = await db.query(
                `SELECT SUM(TABLE_ROWS) as totalRows 
                 FROM INFORMATION_SCHEMA.TABLES 
                 WHERE TABLE_SCHEMA = ?`, 
                [process.env.DB_NAME]
            );
            databaseRows = rows[0]?.totalRows || 0;
        }
    } catch (e) {
        logError('SYSTEM_STATS', e);
    }
    
    let packageJson = {};
    let lockJson = {};
    try {
        packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    } catch(e) {}
    try {
        lockJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package-lock.json'), 'utf-8'));
    } catch(e) {}
    
    res.json({
        imageStorageUsed,
        databaseRows,
        nodeVersion: process.version,
        reactVersion: packageJson.dependencies?.react?.replace('^', '') || lockJson.packages?.['node_modules/react']?.version || 'N/A',
        viteVersion: packageJson.devDependencies?.vite?.replace('^', '') || lockJson.packages?.['node_modules/vite']?.version || 'N/A',
        platform: os.platform(),
        arch: os.arch()
    });
});


// --- REPORTS ---
api.get('/reports', authMiddleware, (req, res) => {
    const sql = `SELECT r.*, c.title as comicTitle, ch.title as chapterTitle FROM reports r LEFT JOIN comics c ON r.comicId = c.id LEFT JOIN chapters ch ON r.chapterId = ch.id ORDER BY r.created_at DESC`;
    safeQuery(sql, [], res, (r) => res.json(r));
});
api.post('/reports', (req, res) => {
    safeQuery('INSERT INTO reports (comicId, chapterId, message) VALUES (?, ?, ?)', [req.body.comicId, req.body.chapterId, req.body.message], res, () => res.json({message: 'ok'}));
});
api.delete('/reports/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM reports WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' }));
});

// --- ADS ---
api.get('/ads', (req, res) => safeQuery('SELECT * FROM ads', [], res, r => res.json(r.map(a => ({...a, isActive: a.isActive === 1})))));
api.post('/ads', authMiddleware, (req, res) => {
    const { id, position, imageUrl, linkUrl, isActive, title } = req.body;
    const active = isActive ? 1 : 0;
    const sql = 'INSERT INTO ads (id, position, imageUrl, linkUrl, isActive, title) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE position=?, imageUrl=?, linkUrl=?, isActive=?, title=?';
    const params = [id, position, imageUrl, linkUrl, active, title, position, imageUrl, linkUrl, active, title];
    safeQuery(sql, params, res, () => res.json({ message: 'Saved' }));
});
api.delete('/ads/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM ads WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' }));
});

// --- THEME ---
api.get('/theme', (req, res) => {
    safeQuery('SELECT theme_config FROM settings WHERE id = 1', [], res, (results) => {
        if (results.length > 0) {
            try {
                const theme = JSON.parse(results[0].theme_config || '{}');
                res.json(theme);
            } catch (e) { res.json({}); }
        } else { res.json({}); }
    });
});

api.post('/theme', authMiddleware, (req, res) => {
    const themeConfig = JSON.stringify(req.body);
    safeQuery('UPDATE settings SET theme_config = ? WHERE id = 1', [themeConfig], res, () => {
        res.json({ message: 'ok' });
    });
});

// --- COMMENTS ---
api.get('/comments', (req, res) => {
    const sql = `SELECT c.*, co.title as comicTitle FROM comments c LEFT JOIN comics co ON c.comicId = co.id ORDER BY c.date DESC`;
    safeQuery(sql, [], res, (r) => {
        res.json(r.map(c => ({...c, isApproved: c.isApproved === 1})));
    });
});

api.post('/comments', (req, res) => {
    const { id, comicId, userName, content, date, rating } = req.body;
    safeQuery('INSERT INTO comments (id, comicId, userName, content, date, isApproved, rating) VALUES (?, ?, ?, ?, ?, 0, ?)', [id, comicId, userName, content, date, rating], res, () => res.json({message: 'ok'}));
});

api.put('/comments/:id/approve', authMiddleware, (req, res) => {
    safeQuery('UPDATE comments SET isApproved=1 WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'}));
});
api.delete('/comments/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM comments WHERE id=?', [req.params.id], res, () => res.json({message: 'ok'}));
});

// --- STATIC PAGES ---
api.get('/static-pages', (req, res) => safeQuery('SELECT * FROM static_pages', [], res, r => res.json(r)));
api.get('/static-pages/:slug', (req, res) => {
    safeQuery('SELECT * FROM static_pages WHERE slug = ?', [req.params.slug], res, r => {
        if (r.length > 0) res.json(r[0]);
        else res.status(404).json({ error: 'Not found' });
    });
});
api.post('/static-pages', authMiddleware, (req, res) => {
    const { slug, title, content, metaTitle, metaDescription, metaKeywords } = req.body;
    if (!slug || !title) return res.status(400).json({ error: 'Slug and title are required' });
    const sql = `INSERT INTO static_pages (slug, title, content, metaTitle, metaDescription, metaKeywords) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=?, content=?, metaTitle=?, metaDescription=?, metaKeywords=?`;
    const params = [slug, title, content, metaTitle, metaDescription, metaKeywords, title, content, metaTitle, metaDescription, metaKeywords];
    safeQuery(sql, params, res, () => res.json({ message: 'ok' }));
});

api.delete('/static-pages/:slug', authMiddleware, (req, res) => {
    const { slug } = req.params;
    if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
    }
    
    if (!db) return res.status(503).json({ error: "No DB Connection" });

    db.query('DELETE FROM static_pages WHERE slug = ?', [slug])
        .then(([result]) => {
            if (result.affectedRows > 0) {
                res.json({ message: 'ok' });
            } else {
                res.status(404).json({ error: 'Page not found' });
            }
        })
        .catch(err => {
            logError('SQL_DELETE_STATIC_PAGE', err);
            return res.status(500).json({ error: err.message });
        });
});


// --- LEECH CONFIGS ---
api.get('/leech-configs', authMiddleware, (req, res) => {
    safeQuery('SELECT * FROM leech_config ORDER BY name', [], res, (r) => {
        res.json(r.map(c => ({...c, uploadCoverImage: !!c.uploadCoverImage})));
    });
});

api.post('/leech-configs', authMiddleware, (req, res) => {
    const { id, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute } = req.body;
    const sql = `INSERT INTO leech_config (id, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=?, baseUrl=?, comicTitleSelector=?, comicCoverSelector=?, comicAuthorSelector=?, uploadCoverImage=?, comicDescriptionSelector=?, chapterLinkSelector=?, chapterImageSelector=?, imageSrcAttribute=?`;
    const params = [id, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage ? 1 : 0, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute, name, baseUrl, comicTitleSelector, comicCoverSelector, comicAuthorSelector, uploadCoverImage ? 1 : 0, comicDescriptionSelector, chapterLinkSelector, chapterImageSelector, imageSrcAttribute];
    safeQuery(sql, params, res, () => res.json({ message: 'ok' }));
});

api.delete('/leech-configs/:id', authMiddleware, (req, res) => {
    safeQuery('DELETE FROM leech_config WHERE id=?', [req.params.id], res, () => res.json({ message: 'ok' }));
});

// --- LEECH PROXY ---
api.post('/leech', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Missing URL' });
    }
    try {
        const response = await requestUrl(url, { headers: { Referer: url } });
        if (response.statusCode === 200) {
            res.json({ success: true, html: response.text });
        } else {
            let errorMsg = `HTTP Error ${response.statusCode}`;
            if (response.statusCode === 403 || response.statusCode === 503) {
                 errorMsg += ' (Possibly blocked by Cloudflare/Bot protection)';
                 // Also return the partial HTML if available
                 return res.json({ success: false, error: errorMsg, html: response.text });
            }
            res.json({ success: false, error: errorMsg });
        }
    } catch (error) {
        logError('LEECH', error);
        res.json({ success: false, error: error.message });
    }
});

// ==========================================
// 4. SERVE FRONTEND & START SERVER
// ==========================================
app.use('/v1', api);

// Serve static files from the 'dist' directory
const staticPath = path.join(__dirname, 'dist');
app.use(express.static(staticPath));

// For any other request, serve index.html for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

http.createServer(app).listen(PORT, () => {
    console.log(`🚀 Server is listening on http://localhost:${PORT}`);
    if (!db) {
        console.warn('⚠️  Database is NOT connected. API will not work correctly.');
        console.warn('👉  Check your .env file and ensure MySQL is running.');
    }
});
