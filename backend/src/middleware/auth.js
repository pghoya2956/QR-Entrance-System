const jwt = require('jsonwebtoken');
const config = require('../config/backend.config');

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        // 쿠키에서도 토큰 확인
        const cookieToken = req.cookies?.authToken;
        if (!cookieToken) {
            return res.status(401).json({ error: '인증이 필요합니다' });
        }
        req.token = cookieToken;
    } else {
        req.token = token;
    }

    jwt.verify(req.token || token, config.auth.jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '유효하지 않은 토큰입니다' });
        }
        req.user = user;
        next();
    });
};

// 로그인 체크를 위한 미들웨어 (API가 아닌 정적 파일용)
const checkAuth = (req, res, next) => {
    // 로그인 페이지와 관련 리소스는 제외
    const publicPaths = ['/login.html', '/css/', '/js/login.js', '/js/config/', '/js/services/'];
    const isPublicPath = publicPaths.some(path => req.path.includes(path));
    
    if (isPublicPath) {
        return next();
    }

    const token = req.cookies?.authToken;
    
    if (!token) {
        return res.redirect('/login.html');
    }

    jwt.verify(token, config.auth.jwtSecret, (err) => {
        if (err) {
            return res.redirect('/login.html');
        }
        next();
    });
};

module.exports = {
    authenticateToken,
    checkAuth
};