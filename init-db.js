
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    charset: 'utf8mb4'
};

if (process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
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
            description TEXT,
            views INT DEFAULT 0,
            isRecommended BOOLEAN DEFAULT FALSE,
            metaTitle VARCHAR(255),
            metaDescription TEXT,
            metaKeywords TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ${tableOptions}`,

        // Bảng Chapter
        `CREATE TABLE IF NOT EXISTS chapters (
            id VARCHAR(255) PRIMARY KEY,
            comicId VARCHAR(255),
            number FLOAT,
            title VARCHAR(255),
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comicId) REFERENCES comics(id) ON DELETE CASCADE
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
            isShowHome BOOLEAN DEFAULT FALSE,
            metaTitle VARCHAR(255),
            metaDescription TEXT,
            metaKeywords TEXT
        ) ${tableOptions}`,

        // Bảng Quảng cáo
        `CREATE TABLE IF NOT EXISTS ads (
            id VARCHAR(255) PRIMARY KEY,
            position VARCHAR(50),
            imageUrl TEXT,
            linkUrl TEXT,
            isActive BOOLEAN DEFAULT TRUE,
            title VARCHAR(255)
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
            content LONGTEXT,
            metaTitle VARCHAR(255),
            metaDescription TEXT,
            metaKeywords TEXT
        ) ${tableOptions}`,

        // Bảng Admin User
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'editor',
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

        // Bảng Bình luận (Đảm bảo bảng này được tạo)
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

        // Dữ liệu mẫu Admin
        `INSERT IGNORE INTO users (id, username, password, role) VALUES (1, 'admin', '123456', 'admin')`,
        
        // Dữ liệu mẫu Settings
        `INSERT IGNORE INTO settings (id, theme_config) VALUES (1, '{}')`
    ];

    for (const query of queries) {
        await new Promise((resolve) => {
            connection.query(query, (err) => {
                if (err) console.error('❌ Lỗi query:', err.message);
                else console.log('✅ Query OK');
                resolve();
            });
        });
    }

    console.log("🎉 Cài đặt Database hoàn tất!");
    connection.end();
};

createTables();
