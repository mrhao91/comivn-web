
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const zlib = require('zlib');

// --- CẤU HÌNH ---
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// --- HELPER LOG ---
const logError = (err) => {
    const msg = `[${new Date().toISOString()}] ERROR: ${err.stack || err}\n`;
    console.error(msg);
    try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), msg); } catch (e) {}
};

// --- CORE REQUEST ---
const singleRequest = (url) => {
    return new Promise((resolve, reject) => {
        let parsedUrl;
        try { parsedUrl = new URL(url); } catch (e) { return reject(new Error('Invalid URL')); }

        // Random Modern User-Agent
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        ];
        const userAgent = agents[Math.floor(Math.random() * agents.length)];

        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': parsedUrl.origin // Fake Same-origin referrer
            }
        };

        const req = https.request(reqOptions, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let nextUrl = res.headers.location;
                if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).toString();
                return singleRequest(nextUrl).then(resolve).catch(reject);
            }

            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());
            else if (res.headers['content-encoding'] === 'deflate') stream = res.pipe(zlib.createInflate());

            let data = Buffer.alloc(0);
            stream.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
            stream.on('end', () => {
                const html = data.toString('utf8');
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ html, statusCode: res.statusCode });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
            stream.on('error', (e) => reject(e));
        });

        req.on('error', (e) => reject(e));
        req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
};

// --- CHIẾN THUẬT LEECH THÔNG MINH ---
const fetchUrl = async (targetUrl) => {
    const strategies = [
        { 
            name: 'Google Cache', 
            getUrl: (u) => `http://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(u)}&strip=0&vwsrc=0` 
        },
        { 
            name: 'Google Translate', 
            getUrl: (u) => `https://translate.google.com/translate?sl=vi&tl=vi&hl=vi&u=${encodeURIComponent(u)}&client=webapp` 
        },
        { 
            name: 'Direct', 
            getUrl: (u) => u 
        }
    ];

    let lastHtml = '';

    for (const strategy of strategies) {
        try {
            console.log(`[Leech] Strategy: ${strategy.name}...`);
            const result = await singleRequest(strategy.getUrl(targetUrl));
            lastHtml = result.html;
            
            if (result.html && (result.html.includes('challenge-platform') || result.html.includes('Cloudflare') || result.html.includes('Attention Required'))) {
                throw new Error("Cloudflare Challenge Detected");
            }
            
            if (result.html && (result.html.includes('<html') || result.html.includes('<!DOCTYPE'))) {
                return result.html;
            }
            throw new Error("Invalid HTML content");
        } catch (e) {
            console.warn(`[Leech] ${strategy.name} Failed: ${e.message}`);
        }
    }
    
    // Nếu thất bại hết, trả về HTML cuối cùng để debug (có thể là trang lỗi)
    if(lastHtml) return lastHtml;
    throw new Error("Không thể truy cập trang nguồn (Bị chặn hoàn toàn).");
};

// --- SERVER SETUP ---
const startServer = () => {
    if (!fs.existsSync(path.join(__dirname, 'node_modules'))) throw new Error("Missing node_modules");

    const express = require('express');
    const cors = require('cors');
    const dotenv = require('dotenv');
    let mysql, multer;
    try { mysql = require('mysql2'); } catch(e) {}
    try { multer = require('multer'); } catch(e) {}

    dotenv.config();
    const app = express();

    app.disable('etag');
    app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Config Upload & DB
    let upload = null;
    if (multer) {
        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        app.use('/uploads', express.static(UPLOAD_DIR));
        const storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, UPLOAD_DIR),
            filename: (req, file, cb) => cb(null, `img-${Date.now()}-${Math.round(Math.random()*1E9)}${path.extname(file.originalname)||'.jpg'}`)
        });
        upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
    }

    let db;
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
                charset: 'utf8mb4'
            };
            if (process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') dbConfig.ssl = { rejectUnauthorized: false };
            db = mysql.createPool(dbConfig);
            db.getConnection((err, conn) => { if(!err) { console.log('✅ DB Connected'); conn.release(); } else console.error('DB Error:', err.message); });
        } catch(e) { console.error(e); }
    }

    const safeQuery = (sql, params, res, callback) => {
        if (!db) return res.status(503).json({ error: "No DB" });
        db.query(sql, params, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            callback(result);
        });
    };
    const authMiddleware = (req, res, next) => {
        const auth = req.headers['authorization'];
        if (auth && auth.split(' ')[1] === 'fake-jwt-token-xyz') next();
        else res.status(401).json({ error: 'Unauthorized' });
    };

    const api = express.Router();
    api.get('/health', (req, res) => res.json({ status: 'ok' }));
    
    // --- BASIC CRUD ROUTES ---
    api.post('/login', (req, res) => { const { username, password } = req.body; if (!db) return res.status(503).json({ success: false, error: "No DB" }); db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => { if (err || results.length === 0) return res.json({ success: false, error: "Sai tài khoản" }); const user = results[0]; if (user.password == password) res.json({ success: true, user: { id: user.id, username: user.username, role: user.role }, token: 'fake-jwt-token-xyz' }); else res.json({ success: false, error: "Sai mật khẩu" }); }); });
    api.post('/upload', authMiddleware, (req, res) => { if(!upload)return res.status(503).json({error:"No upload"}); upload.single('image')(req,res,(e)=>{if(e||!req.file)return res.status(400).json({error:e?e.message:'No file'}); res.json({url:`/uploads/${req.file.filename}`})}); });
    api.get('/media', authMiddleware, (req, res) => { if(!fs.existsSync(UPLOAD_DIR))return res.json([]); fs.readdir(UPLOAD_DIR,(e,f)=>{res.json(e?[]:f.map(x=>({name:x,url:`/uploads/${x}`,size:0,created:new Date()})))}) });
    api.delete('/media/:filename', authMiddleware, (req,res)=>{const p=path.join(UPLOAD_DIR,req.params.filename); if(fs.existsSync(p))fs.unlink(p,()=>res.json({message:'Deleted'})); else res.status(404).json({error:'Not found'})});
    api.get('/comics', (req,res)=>safeQuery(`SELECT c.*,(SELECT id FROM chapters WHERE comicId=c.id ORDER BY number DESC LIMIT 1) as latest_chap_id,(SELECT number FROM chapters WHERE comicId=c.id ORDER BY number DESC LIMIT 1) as latest_chap_number,(SELECT updatedAt FROM chapters WHERE comicId=c.id ORDER BY number DESC LIMIT 1) as latest_chap_date FROM comics c ORDER BY updated_at DESC`,[],res,r=>{res.json(r.map(c=>({...c,genres:c.genres?c.genres.split(','):[],isRecommended:c.isRecommended===1,chapters:c.latest_chap_id?[{id:c.latest_chap_id,number:c.latest_chap_number,updatedAt:c.latest_chap_date,title:`Chapter ${c.latest_chap_number}`}]:[]})))}));
    api.get('/comics/:id', (req,res)=>safeQuery('SELECT * FROM comics WHERE id=? OR slug=?',[req.params.id,req.params.id],res,r=>{if(!r.length)return res.status(404).json({message:'Not found'});const c=r[0];c.genres=c.genres?c.genres.split(','):[];c.isRecommended=c.isRecommended===1;safeQuery('SELECT * FROM chapters WHERE comicId=? ORDER BY number DESC',[c.id],res,ch=> {c.chapters=ch||[];res.json(c)})}));
    api.post('/comics', authMiddleware, (req,res)=>{const{id,title,slug,coverImage,author,status,genres,description,views,isRecommended,metaTitle,metaDescription,metaKeywords}=req.body;const g=Array.isArray(genres)?genres.join(','):genres;const ir=isRecommended?1:0;safeQuery(`INSERT INTO comics (id,title,slug,coverImage,author,status,genres,description,views,isRecommended,metaTitle,metaDescription,metaKeywords) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?,slug=?,coverImage=?,author=?,status=?,genres=?,description=?,views=?,isRecommended=?,metaTitle=?,metaDescription=?,metaKeywords=?`,[id,title,slug,coverImage,author,status,g,description,views||0,ir,metaTitle,metaDescription,metaKeywords,title,slug,coverImage,author,status,g,description,views||0,ir,metaTitle,metaDescription,metaKeywords],res,()=>res.json({message:'Saved'}))});
    api.delete('/comics/:id', authMiddleware, (req,res)=>safeQuery('DELETE FROM comics WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));
    api.post('/chapters', authMiddleware, (req,res)=>{const{id,comicId,number,title,pages}=req.body;safeQuery('INSERT INTO chapters (id,comicId,number,title) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE number=?,title=?',[id,comicId,number,title,number,title],res,()=>{safeQuery('DELETE FROM chapter_pages WHERE chapterId=?',[id],res,()=>{if(pages?.length){const v=pages.map(p=>[id,p.imageUrl,p.pageNumber]);safeQuery('INSERT INTO chapter_pages (chapterId,imageUrl,pageNumber) VALUES ?',[v],res,()=>{safeQuery('UPDATE comics SET updated_at=NOW() WHERE id=?',[comicId],res,()=>res.json({message:'Saved'}))})}else res.json({message:'Saved'})})})});
    api.delete('/chapters/:id', authMiddleware, (req,res)=>safeQuery('DELETE FROM chapters WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));
    api.get('/chapters/:id/pages', (req,res)=>safeQuery('SELECT * FROM chapter_pages WHERE chapterId=? ORDER BY pageNumber ASC',[req.params.id],res,r=>res.json(r)));
    api.get('/genres', (req,res)=>safeQuery('SELECT * FROM genres',[],res,r=>res.json(r.map(g=>({...g,isShowHome:g.isShowHome===1})))));
    api.post('/genres', authMiddleware, (req,res)=>{const{id,name,slug,isShowHome,metaTitle,metaDescription,metaKeywords}=req.body;const s=isShowHome?1:0;safeQuery('INSERT INTO genres (id,name,slug,isShowHome,metaTitle,metaDescription,metaKeywords) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=?,slug=?,isShowHome=?,metaTitle=?,metaDescription=?,metaKeywords=?',[id,name,slug,s,metaTitle,metaDescription,metaKeywords,name,slug,s,metaTitle,metaDescription,metaKeywords],res,()=>res.json({message:'Saved'}))});
    api.delete('/genres/:id', authMiddleware, (req,res)=>safeQuery('DELETE FROM genres WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));
    api.get('/ads', (req,res)=>safeQuery('SELECT * FROM ads',[],res,r=>res.json(r.map(a=>({...a,isActive:a.isActive===1})))));
    api.post('/ads', authMiddleware, (req,res)=>{const{id,position,imageUrl,linkUrl,isActive,title}=req.body;const a=isActive?1:0;safeQuery('INSERT INTO ads (id,position,imageUrl,linkUrl,isActive,title) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE position=?,imageUrl=?,linkUrl=?,isActive=?,title=?',[id,position,imageUrl,linkUrl,a,title,position,imageUrl,linkUrl,a,title],res,()=>res.json({message:'Saved'}))});
    api.delete('/ads/:id', authMiddleware, (req,res)=>safeQuery('DELETE FROM ads WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));
    api.get('/theme', (req,res)=>safeQuery('SELECT theme_config FROM settings WHERE id=1',[],res,r=>res.json(r.length&&r[0].theme_config?(typeof r[0].theme_config==='string'?JSON.parse(r[0].theme_config):r[0].theme_config):{})));
    api.post('/theme', authMiddleware, (req,res)=>{const c=JSON.stringify(req.body);safeQuery('INSERT INTO settings (id,theme_config) VALUES (1,?) ON DUPLICATE KEY UPDATE theme_config=?',[c,c],res,()=>res.json({message:'Saved'}))});
    api.get('/static-pages', (req,res)=>safeQuery('SELECT * FROM static_pages',[],res,r=>res.json(r)));
    api.get('/static-pages/:slug', (req,res)=>safeQuery('SELECT * FROM static_pages WHERE slug=?',[req.params.slug],res,r=>{if(!r.length)return res.status(404).json({message:'Not found'});res.json(r[0])}));
    api.post('/static-pages', authMiddleware, (req,res)=>{const{slug,title,content,metaTitle,metaDescription,metaKeywords}=req.body;safeQuery('INSERT INTO static_pages (slug,title,content,metaTitle,metaDescription,metaKeywords) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?,content=?,metaTitle=?,metaDescription=?,metaKeywords=?',[slug,title,content,metaTitle,metaDescription,metaKeywords,title,content,metaTitle,metaDescription,metaKeywords],res,()=>res.json({message:'Saved'}))});
    api.get('/users', authMiddleware, (req,res)=>safeQuery('SELECT id,username,role,created_at FROM users',[],res,r=>res.json(r)));
    api.post('/users', authMiddleware, (req,res)=>{const{id,username,password,role}=req.body;if(!id)safeQuery('INSERT INTO users (username,password,role) VALUES (?,?,?)',[username,password,role],res,()=>res.json({message:'Saved'}));else{if(password)safeQuery('UPDATE users SET username=?,password=?,role=? WHERE id=?',[username,password,role,id],res,()=>res.json({message:'Saved'}));else safeQuery('UPDATE users SET username=?,role=? WHERE id=?',[username,role,id],res,()=>res.json({message:'Saved'}));}});
    api.delete('/users/:id', authMiddleware, (req,res)=>safeQuery('DELETE FROM users WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));
    api.get('/reports', authMiddleware, (req,res)=>safeQuery(`SELECT r.*,c.title as comicTitle,ch.title as chapterTitle FROM reports r LEFT JOIN comics c ON r.comicId=c.id LEFT JOIN chapters ch ON r.chapterId=ch.id ORDER BY r.id DESC`,[],res,r=>res.json(r)));
    api.post('/reports', (req,res)=>safeQuery('INSERT INTO reports (comicId,chapterId,message) VALUES (?,?,?)',[req.body.comicId,req.body.chapterId,req.body.message],res,()=>res.json({message:'Sent'})));
    api.delete('/reports/:id', authMiddleware, (req,res)=>safeQuery('DELETE FROM reports WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));
    api.get('/comments', (req,res)=>res.json([]));

    // === LEECH API: GLOBAL SCAN (Version 3.0) ===
    api.post('/leech/scan', authMiddleware, async (req, res) => {
        const { url } = req.body;
        if (!url || !url.includes('truyenqq')) return res.status(400).json({ error: 'URL không hợp lệ' });

        try {
            const html = await fetchUrl(url);
            
            // 1. Metadata Parsing
            const getMeta = (p) => { const m = html.match(new RegExp(`<meta property="${p}" content="(.*?)"`)); return m ? m[1] : ''; };
            
            let coverImage = getMeta('og:image');
            // Clean Google Proxy URL in Cover Image
            if (coverImage.includes('googleusercontent') && coverImage.includes('u=')) {
                 const u = new URL(coverImage);
                 if (u.searchParams.get('u')) coverImage = u.searchParams.get('u');
            }

            const title = getMeta('og:title').replace(/ - Chapter \d+$/, '').replace(/ - TruyenQQ.+$/, '').trim();
            const description = getMeta('og:description');
            
            const chapters = [];

            // 2. Chapter Parsing Logic
            
            // Strategy 1: Mobile Select (Chuẩn nhất nếu có)
            const selectMatch = html.match(/<select[^>]*class="[^"]*select-reading[^"]*"[^>]*>([\s\S]*?)<\/select>/);
            if (selectMatch) {
                const optionRegex = /<option[^>]+value="([^"]+)"[^>]*>([^<]+)<\/option>/g;
                let m;
                while ((m = optionRegex.exec(selectMatch[1])) !== null) {
                    let chapUrl = m[1];
                    if (!chapUrl.startsWith('http')) chapUrl = `https://truyenqq.com.vn${chapUrl}`;
                    chapters.push({
                        url: chapUrl,
                        title: m[2].trim(),
                        number: parseFloat(m[2].match(/(\d+(\.\d+)?)/)?.[0] || '0')
                    });
                }
            }

            // Strategy 2: URL Pattern Scan (Chiến thuật mới - Bỏ qua cấu trúc HTML, quét thẳng vào href)
            // Tìm tất cả các link có dạng: .../chap-123 hoặc .../chapter-123
            if (chapters.length === 0) {
                 // Regex giải thích: Tìm href có chứa "chap-" hoặc "chapter-" hoặc "chuong-" theo sau là số
                 const urlPatternRegex = /<a[^>]+href=["']([^"']*(?:chapter|chap|chuong)-(\d+(\.\d+)?)[^"']*)["'][^>]*>(.*?)<\/a>/gi;
                 let m;
                 while ((m = urlPatternRegex.exec(html)) !== null) {
                    let href = m[1];
                    let numberStr = m[2]; // Số chapter lấy từ URL (chuẩn hơn lấy từ text)
                    let rawText = m[4];

                    // Clean URL Proxy
                    if (href.includes('googleusercontent') && href.includes('u=')) {
                         const u = new URL(href);
                         if (u.searchParams.get('u')) href = u.searchParams.get('u');
                    } else if (!href.startsWith('http')) {
                         href = `https://truyenqq.com.vn${href}`;
                    }

                    // Tự tạo title nếu text bị lỗi
                    let text = rawText.replace(/<[^>]+>/g, '').trim();
                    if (!text) text = `Chapter ${numberStr}`;

                    // Loại bỏ trùng lặp
                    if (!chapters.some(c => c.url === href)) {
                        chapters.push({
                            url: href,
                            title: text,
                            number: parseFloat(numberStr)
                        });
                    }
                 }
            }

            if (chapters.length === 0) {
                // Debug info: Trả về một đoạn HTML ngắn để xem lỗi là gì
                const debugHtml = html.substring(0, 500).replace(/</g, '&lt;');
                throw new Error(`Không tìm thấy chapter. HTML Preview: ${debugHtml}...`);
            }

            res.json({ success: true, data: { title, coverImage, description, chapters: chapters.reverse() } });
        } catch (error) {
            console.error("Leech Scan Error:", error);
            res.status(500).json({ error: 'Lỗi: ' + error.message });
        }
    });

    api.post('/leech/chapter', authMiddleware, async (req, res) => {
        const { url } = req.body;
        try {
            const html = await fetchUrl(url);
            
            const images = [];
            // Regex bắt cả data-src và src phòng trường hợp proxy load sẵn
            const imgRegex = /<img[^>]+(data-src|src)="([^">]+)"[^>]*class="[^"]*lazy[^"]*"/g;
            let match;
            while ((match = imgRegex.exec(html)) !== null) {
                let imgUrl = match[2];
                if (imgUrl.includes('googleusercontent') && imgUrl.includes('u=')) {
                     const u = new URL(imgUrl);
                     if (u.searchParams.get('u')) imgUrl = u.searchParams.get('u');
                }
                if (!images.includes(imgUrl)) images.push(imgUrl);
            }

            if(images.length === 0) {
                // Fallback: Tìm mọi ảnh trong div chapter-content
                const contentMatch = html.match(/<div class="chapter_content">([\s\S]*?)<\/div>/);
                if (contentMatch) {
                     const simpleImgRegex = /src="([^"]+)"/g;
                     let m;
                     while ((m = simpleImgRegex.exec(contentMatch[1])) !== null) {
                         images.push(m[1]);
                     }
                }
            }
            
            // Fallback 2: Quét toàn bộ ảnh lớn (trên 50kb logic - khó check nhưng có thể check đuôi)
            if (images.length === 0) {
                 const anyImgRegex = /<img[^>]+src="([^"]+)"/g;
                 let m;
                 while ((m = anyImgRegex.exec(html)) !== null) {
                     const u = m[1];
                     if (u.includes('truyenqq') && !u.includes('logo') && !u.includes('icon')) {
                         images.push(u);
                     }
                 }
            }

            if(images.length === 0) throw new Error("Không tìm thấy ảnh truyện");
            res.json({ success: true, images });
        } catch (error) {
            console.error("Leech Chapter Error:", error);
            res.status(500).json({ error: 'Lỗi: ' + error.message });
        }
    });

    app.use('/v1', api);

    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    } else {
        app.get('/', (req, res) => res.send('Backend OK. Dist folder missing.'));
    }

    app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
};

try { startServer(); } catch (err) { logError(err); http.createServer((q, r) => { r.end(`Server Error: ${err.message}`); }).listen(PORT); }
