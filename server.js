
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
