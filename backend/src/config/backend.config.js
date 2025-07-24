const path = require('path');
const fs = require('fs');

// 데이터 디렉토리 생성
const dataDir = path.join(__dirname, '../data');
const backupsDir = path.join(dataDir, 'backups');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

module.exports = {
    // 서버 설정
    server: {
        port: process.env.PORT || 5001,
        host: '0.0.0.0'
    },

    // 인증 설정
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'qr-entrance-secret-key-2025',
        adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
        passwordSalt: process.env.PASSWORD_SALT || 'qr-entrance-salt-2025',
        tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
        cookieMaxAge: 24 * 60 * 60 * 1000 // 24시간
    },

    // 데이터베이스 설정
    database: {
        path: path.join(dataDir, 'attendees.db'),
        backupPath: backupsDir
    },

    // 백업 설정
    backup: {
        enabled: process.env.BACKUP_ENABLED !== 'false',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 매일 02:00
        retention: parseInt(process.env.BACKUP_RETENTION || '30'), // 30일
        onStart: process.env.BACKUP_ON_START === 'true'
    },

    // CORS 설정
    cors: {
        origin: function(origin, callback) {
            // 개발 환경에서는 모든 origin 허용
            const allowedOrigins = [
                'http://localhost:8080',
                'http://localhost:80',
                'http://localhost:3000',
                'http://localhost'
            ];
            
            // origin이 없는 경우 (같은 출처) 또는 허용된 origin인 경우
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else if (process.env.NODE_ENV === 'development') {
                // 개발 환경에서는 모든 origin 허용
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['set-cookie']
    },

    // QR 코드 설정
    qr: {
        size: 300,
        errorCorrectionLevel: 'M'
    }
};