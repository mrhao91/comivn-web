
import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// --- CONFIG & INIT ---
dotenv.config();

// Khởi tạo biến môi trường an toàn
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS mở rộng để tránh lỗi kết nối từ frontend
app.use(cors({ origin: '*', optionsSuccessStatus: 200 }));
// IMPORTANT: Increase limit for big payloads and strict JSON parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Tạo thư mục uploads (Bọc Try-Catch để tránh crash server nếu không có quyền)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        console.log('📂 Created uploads directory at:', UPLOAD_DIR);
    }
    // Serve file ảnh tĩnh
    app.use('/uploads', express.static(UPLOAD_DIR));
} catch (err) {
    console.error("⚠️ Lỗi tạo thư mục uploads:", err.message);
}

// 2. Cấu hình Multer (Lưu ảnh)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Đảm bảo thư mục tồn tại trước khi lưu
        if (!fs.existsSync(UPLOAD_DIR)) {
             try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch(e){}
        }
        cb(null, UPLOAD_DIR); 
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '.jpg';
        // Tên file đơn giản, không dấu tiếng Việt
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `img-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// --- DATABASE SETUP ---
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4', // BẮT BUỘC: Hỗ trợ tiếng Việt Emoji và ký tự đặc biệt
    timezone: '+07:00' // Giờ Việt Nam
};

if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
    dbConfig.ssl = { rejectUnauthorized: false };
}

let db;
const connectToDatabase = () => {
    if (!process.env.DB_USER) {
        console.warn("⚠️ Chưa cấu hình DB_USER. Database sẽ không hoạt động.");
        return;
    }
    try {
        db = mysql.createPool(dbConfig);
        db.getConnection((err, conn) => {
            if(err) console.error('❌ [DB] Lỗi kết nối:', err.message);
            else { 
                console.log('✅ [DB] Đã kết nối thành công'); 
                // Ensure charset per session
                conn.query("SET NAMES utf8mb4");
                conn.release(); 
            }
        });
    } catch (e) {
        console.error("❌ [DB] Exception:", e.message);
    }
};

const authMiddleware = (req, res, next) => {
    const auth = req.headers['authorization'];
    const token = auth && auth.split(' ')[1];
    if (token === 'fake-jwt-token-xyz') next();
    else res.status(401).json({ error: 'Unauthorized' });
};

const safeQuery = (sql, params, res, callback) => {
    if (!db) return res.status(503).json({ error: "Database not connected" });
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error("Query Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        callback(result);
    });
};

// --- API ROUTES ---
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => res.json({ status: 'ok', storage: 'local-disk' }));

// Auth
apiRouter.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!db) return res.status(503).json({ success: false, error: "DB Error" });
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) return res.json({ success: false, error: "Sai thông tin đăng nhập" });
        const user = results[0];
        if (user.password == password) res.json({ success: true, user: { id: user.id, username: user.username, role: user.role }, token: 'fake-jwt-token-xyz' });
        else res.json({ success: false, error: "Sai mật khẩu" });
    });
});

// Upload API
apiRouter.post('/upload', authMiddleware, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error("Multer Error:", err);
            return res.status(500).json({ error: `Lỗi Upload: ${err.message}` });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Không nhận được file ảnh.' });
        }
        // Trả về đường dẫn
        const relativeUrl = `/uploads/${req.file.filename}`;
        res.json({ url: relativeUrl });
    });
});

// CRUD API
apiRouter.get('/comics', (req, res) => {
    const sql = `
        SELECT c.*, 
        (SELECT id FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as latest_chap_id,
        (SELECT number FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as latest_chap_number,
        (SELECT updatedAt FROM chapters WHERE comicId = c.id ORDER BY number DESC LIMIT 1) as latest_chap_date
        FROM comics c 
        ORDER BY updated_at DESC
    `;
    safeQuery(sql, [], res, (results) => {
        const comics = results.map(c => ({
            ...c,
            genres: c.genres ? c.genres.split(',') : [],
            isRecommended: c.isRecommended === 1,
            // Map flat fields back to chapters array structure expected by frontend
            chapters: c.latest_chap_id ? [{
                id: c.latest_chap_id,
                number: c.latest_chap_number,
                updatedAt: c.latest_chap_date,
                title: `Chapter ${c.latest_chap_number}`
            }] : [] 
        }));
        res.json(comics);
    });
});

apiRouter.get('/comics/:id', (req, res) => {
    const p = req.params.id;
    safeQuery('SELECT * FROM comics WHERE id=? OR slug=?', [p, p], res, (comics) => {
        if (comics.length === 0) return res.status(404).json({message: 'Not found'});
        const comic = comics[0];
        comic.genres = comic.genres ? comic.genres.split(',') : [];
        comic.isRecommended = comic.isRecommended===1;
        safeQuery('SELECT * FROM chapters WHERE comicId=? ORDER BY number DESC', [comic.id], res, (chaps) => {
            comic.chapters = chaps || [];
            res.json(comic);
        });
    });
});
apiRouter.post('/comics', authMiddleware, (req, res) => {
    const { id, title, slug, coverImage, author, status, genres, description, views, isRecommended, metaTitle, metaDescription, metaKeywords } = req.body;
    const gStr = Array.isArray(genres) ? genres.join(',') : genres;
    const isRec = isRecommended ? 1 : 0;
    const sql = `INSERT INTO comics (id,title,slug,coverImage,author,status,genres,description,views,isRecommended,metaTitle,metaDescription,metaKeywords) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?,slug=?,coverImage=?,author=?,status=?,genres=?,description=?,views=?,isRecommended=?,metaTitle=?,metaDescription=?,metaKeywords=?`;
    const p = [id,title,slug,coverImage,author,status,gStr,description,views,isRec,metaTitle,metaDescription,metaKeywords,title,slug,coverImage,author,status,gStr,description,views,isRec,metaTitle,metaDescription,metaKeywords];
    safeQuery(sql, p, res, () => res.json({message: 'Saved'}));
});
apiRouter.delete('/comics/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM comics WHERE id=?',[req.params.id],res, ()=>res.json({message:'Deleted'})));

// Chapters
apiRouter.post('/chapters', authMiddleware, (req, res) => {
    const { id, comicId, number, title, pages } = req.body;
    safeQuery('INSERT INTO chapters (id,comicId,number,title) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE number=?,title=?', [id,comicId,number,title,number,title], res, () => {
        safeQuery('DELETE FROM chapter_pages WHERE chapterId=?', [id], res, () => {
            if (pages?.length > 0) {
                const vals = pages.map(p => [id, p.imageUrl, p.pageNumber]);
                safeQuery('INSERT INTO chapter_pages (chapterId,imageUrl,pageNumber) VALUES ?', [vals], res, () => {
                    safeQuery('UPDATE comics SET updated_at=NOW() WHERE id=?', [comicId], res, () => res.json({message:'Saved'}));
                });
            } else res.json({message:'Saved'});
        });
    });
});
apiRouter.delete('/chapters/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM chapters WHERE id=?',[req.params.id],res, ()=>res.json({message:'Deleted'})));
apiRouter.get('/chapters/:id/pages', (req, res) => safeQuery('SELECT * FROM chapter_pages WHERE chapterId=? ORDER BY pageNumber ASC', [req.params.id], res, (r)=>res.json(r)));

// Genres & Ads & Theme
apiRouter.get('/genres', (req, res) => safeQuery('SELECT * FROM genres', [], res, r => res.json(r.map(g=>({...g, isShowHome:g.isShowHome===1})))));
apiRouter.post('/genres', authMiddleware, (req,res) => { const {id,name,slug,isShowHome,metaTitle,metaDescription,metaKeywords}=req.body; const s=isShowHome?1:0; safeQuery('INSERT INTO genres (id,name,slug,isShowHome,metaTitle,metaDescription,metaKeywords) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=?,slug=?,isShowHome=?,metaTitle=?,metaDescription=?,metaKeywords=?',[id,name,slug,s,metaTitle,metaDescription,metaKeywords,name,slug,s,metaTitle,metaDescription,metaKeywords],res,()=>res.json({message:'Saved'})); });
apiRouter.delete('/genres/:id', authMiddleware, (req,res) => safeQuery('DELETE FROM genres WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));

apiRouter.get('/ads', (req, res) => safeQuery('SELECT * FROM ads', [], res, r => res.json(r.map(a=>({...a, isActive:a.isActive===1})))));
apiRouter.post('/ads', authMiddleware, (req,res) => { const {id,position,imageUrl,linkUrl,isActive,title}=req.body; const a=isActive?1:0; safeQuery('INSERT INTO ads (id,position,imageUrl,linkUrl,isActive,title) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE position=?,imageUrl=?,linkUrl=?,isActive=?,title=?',[id,position,imageUrl,linkUrl,a,title,position,imageUrl,linkUrl,a,title],res,()=>res.json({message:'Saved'})); });
apiRouter.delete('/ads/:id', authMiddleware, (req,res) => safeQuery('DELETE FROM ads WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));

apiRouter.get('/theme', (req,res) => safeQuery('SELECT theme_config FROM settings WHERE id=1',[],res,(r)=>res.json(r.length&&r[0].theme_config ? (typeof r[0].theme_config==='string'?JSON.parse(r[0].theme_config):r[0].theme_config):{})));
apiRouter.post('/theme', authMiddleware, (req,res) => { const c=JSON.stringify(req.body); safeQuery('INSERT INTO settings (id,theme_config) VALUES (1,?) ON DUPLICATE KEY UPDATE theme_config=?',[c,c],res,()=>res.json({message:'Saved'})); });

apiRouter.get('/static-pages', (req,res)=>safeQuery('SELECT * FROM static_pages',[],res,(r)=>res.json(r)));
apiRouter.get('/static-pages/:slug', (req,res)=>safeQuery('SELECT * FROM static_pages WHERE slug=?',[req.params.slug],res,(r)=>{if(r.length===0)return res.status(404).json({message:'Not found'});res.json(r[0])}));
apiRouter.post('/static-pages', authMiddleware, (req,res)=>{const{slug,title,content,metaTitle,metaDescription,metaKeywords}=req.body; safeQuery('INSERT INTO static_pages (slug,title,content,metaTitle,metaDescription,metaKeywords) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?,content=?,metaTitle=?,metaDescription=?,metaKeywords=?',[slug,title,content,metaTitle,metaDescription,metaKeywords,title,content,metaTitle,metaDescription,metaKeywords],res,()=>res.json({message:'Saved'}));});

apiRouter.get('/users', authMiddleware, (req, res) => safeQuery('SELECT id, username, role, created_at FROM users', [], res, r => res.json(r)));
apiRouter.post('/users', authMiddleware, (req, res) => { const {id,username,password,role}=req.body; if(!id) { safeQuery('INSERT INTO users (username,password,role) VALUES (?,?,?)',[username,password,role],res,()=>res.json({message:'Saved'})); } else { if(password) safeQuery('UPDATE users SET username=?,password=?,role=? WHERE id=?',[username,password,role,id],res,()=>res.json({message:'Saved'})); else safeQuery('UPDATE users SET username=?,role=? WHERE id=?',[username,role,id],res,()=>res.json({message:'Saved'})); }});
apiRouter.delete('/users/:id', authMiddleware, (req, res) => safeQuery('DELETE FROM users WHERE id=?',[req.params.id],res,()=>res.json({message:'Deleted'})));

apiRouter.get('/comments', (req, res) => res.json([]));

app.use('/v1', apiRouter);

// Frontend Fallback (Rất quan trọng để tránh 404 khi f5)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
    // Nếu chưa có dist, trả về text để biết server đã chạy
    app.get('/', (req, res) => res.send('Backend đã chạy ổn định! Hãy upload thư mục dist để hiển thị web.'));
}

// Global Error Handler (Chặn crash server)
app.use((err, req, res, next) => {
    console.error("🔥 Server Error:", err.stack);
    res.status(500).send('Something broke!');
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    connectToDatabase();
});
