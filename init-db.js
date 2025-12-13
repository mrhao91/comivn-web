
import mysql from 'mysql2';
import dotenv from 'dotenv';

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
    console.log("🔄 Đang kết nối tới MySQL...");
    
    connection.connect(err => {
        if (err) {
            console.error('❌ Lỗi kết nối:', err);
            process.exit(1);
        }
        console.log('✅ Kết nối thành công!');
    });

    // Add DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci to all tables
    const tableOptions = "DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    const queries = [
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
        `CREATE TABLE IF NOT EXISTS chapters (
            id VARCHAR(255) PRIMARY KEY,
            comicId VARCHAR(255),
            number FLOAT,
            title VARCHAR(255),
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comicId) REFERENCES comics(id) ON DELETE CASCADE
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS chapter_pages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            chapterId VARCHAR(255),
            imageUrl TEXT,
            pageNumber INT,
            FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS genres (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            slug VARCHAR(255),
            isShowHome BOOLEAN DEFAULT FALSE,
            metaTitle VARCHAR(255),
            metaDescription TEXT,
            metaKeywords TEXT
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS ads (
            id VARCHAR(255) PRIMARY KEY,
            position VARCHAR(50),
            imageUrl TEXT,
            linkUrl TEXT,
            isActive BOOLEAN DEFAULT TRUE,
            title VARCHAR(255)
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            theme_config JSON
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS static_pages (
            slug VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255),
            content LONGTEXT,
            metaTitle VARCHAR(255),
            metaDescription TEXT,
            metaKeywords TEXT
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'editor',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ${tableOptions}`,
        `CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            comicId VARCHAR(255),
            chapterId VARCHAR(255),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ${tableOptions}`,
        // Seed default Admin User if not exists
        `INSERT IGNORE INTO users (id, username, password, role) VALUES (1, 'admin', '123456', 'admin')`,
        // Seed default Theme Config
        `INSERT IGNORE INTO settings (id, theme_config) VALUES (1, '{}')`
    ];

    for (const query of queries) {
        await new Promise((resolve, reject) => {
            connection.query(query, (err) => {
                if (err) {
                    console.error('❌ Lỗi tạo bảng:', err.message);
                    // reject(err); // Không reject để tiếp tục chạy các query khác
                    resolve();
                } else {
                    console.log('✅ Query OK');
                    resolve();
                }
            });
        });
    }

    console.log("🎉 Hoàn tất khởi tạo Database!");
    connection.end();
};

createTables();
