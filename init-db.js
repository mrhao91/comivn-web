

const mysql = require('mysql2');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Helper for MD5 hashing
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    charset: 'utf8mb4'
};

if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
    dbConfig.ssl = { rejectUnauthorized: false };
}

const connection = mysql.createConnection(dbConfig);

const createTables = async () => {
    console.log("🔄 Đang kết nối MySQL...");
    
    connection.connect(err => {
        if (err) {
            console.error('❌ Kết nối thất bại:', err);
            process.exit(1);
        }
        console.log('✅ Đã kết nối!');
    });

    const tableOptions = "DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    const queries = [
        // Bảng Truyện
        `CREATE TABLE IF NOT EXISTS comics (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255),
            coverImage TEXT,
            author VARCHAR(255),
            status VARCHAR(50),
            genres TEXT,
            description LONGTEXT,
            views INT DEFAULT 0,
            isRecommended BOOLEAN DEFAULT FALSE,
            metaTitle VARCHAR(255),
            metaDescription TEXT,
            metaKeywords TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX(slug)
        ) ${tableOptions}`,

        // Bảng Chapter
        `CREATE TABLE IF NOT EXISTS chapters (
            id VARCHAR(255) PRIMARY KEY,
            comicId VARCHAR(255),
            number FLOAT,
            title VARCHAR(255),
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comicId) REFERENCES comics(id) ON DELETE CASCADE,
            INDEX(comicId, number)
        ) ${tableOptions}`,

        // Bảng Ảnh Chapter
        `CREATE TABLE IF NOT EXISTS chapter_pages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            chapterId VARCHAR(255),
            imageUrl TEXT,
            pageNumber INT,
            FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
        ) ${tableOptions}`,

        // Bảng Thể loại
        `CREATE TABLE IF NOT EXISTS genres (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            slug VARCHAR(255),
            isShowHome BOOLEAN DEFAULT FALSE
        ) ${tableOptions}`,

        // Bảng Quảng cáo
        `CREATE TABLE IF NOT EXISTS ads (
            id VARCHAR(255) PRIMARY KEY,
            position VARCHAR(50),
            imageUrl TEXT,
            linkUrl TEXT,
            isActive BOOLEAN DEFAULT TRUE,
            title VARCHAR(255),
            scriptCode TEXT
        ) ${tableOptions}`,

        // Bảng Cấu hình Giao diện
        `CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            theme_config LONGTEXT
        ) ${tableOptions}`,

        // Bảng Trang tĩnh
        `CREATE TABLE IF NOT EXISTS static_pages (
            slug VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255),
            content LONGTEXT
        ) ${tableOptions}`,

        // Bảng Admin User
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'editor',
            permissions TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ${tableOptions}`,

        // Bảng Báo cáo lỗi
        `CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            comicId VARCHAR(255),
            chapterId VARCHAR(255),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ${tableOptions}`,

        // Bảng Bình luận
        `CREATE TABLE IF NOT EXISTS comments (
            id VARCHAR(255) PRIMARY KEY,
            comicId VARCHAR(255),
            userName VARCHAR(255),
            content TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            isApproved TINYINT(1) DEFAULT 0,
            rating FLOAT DEFAULT 5
        ) ${tableOptions}`,

        // Bảng Thống kê lượt xem theo ngày
        `CREATE TABLE IF NOT EXISTS daily_views (
            date DATE PRIMARY KEY,
            views INT DEFAULT 0
        ) ${tableOptions}`,

        // Bảng Cấu hình Leech
        `CREATE TABLE IF NOT EXISTS leech_config (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            baseUrl VARCHAR(255),
            comicTitleSelector VARCHAR(255),
            comicCoverSelector VARCHAR(255),
            comicAuthorSelector VARCHAR(255),
            uploadCoverImage BOOLEAN DEFAULT FALSE,
            comicDescriptionSelector VARCHAR(255),
            chapterLinkSelector VARCHAR(255),
            chapterImageSelector VARCHAR(255),
            imageSrcAttribute VARCHAR(255)
        ) ${tableOptions}`,

        // Dữ liệu mẫu Admin với mật khẩu MD5
        `INSERT IGNORE INTO users (id, username, password, role, permissions) VALUES (1, 'admin', '${md5('123456')}', 'admin', NULL)`,
        
        // Dữ liệu mẫu Settings
        `INSERT IGNORE INTO settings (id, theme_config) VALUES (1, '{}')`
    ];

    for (const query of queries) {
        await new Promise((resolve) => {
            const tableName = query.match(/CREATE TABLE IF NOT EXISTS `?(\w+)`?/);
            const queryName = tableName ? `Tạo bảng ${tableName[1]}` : 'Chèn dữ liệu';

            connection.query(query, (err) => {
                if (err) console.error(`❌ Lỗi [${queryName}]:`, err.message);
                else console.log(`✅ [${queryName}] OK`);
                resolve();
            });
        });
    }

    console.log("🎉 Cài đặt Database hoàn tất!");
    connection.end();
};

createTables();