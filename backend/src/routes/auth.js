const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/backend.config');

const router = express.Router();

// 비밀번호 해싱 함수
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password + config.auth.passwordSalt).digest('hex');
};

// 로그인
router.post('/login', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: '비밀번호를 입력해주세요' });
    }

    // 환경변수의 초기 비밀번호와 비교
    const hashedPassword = hashPassword(password);
    const expectedHash = hashPassword(config.auth.adminPassword);

    if (hashedPassword !== expectedHash) {
        return res.status(401).json({ error: '비밀번호가 일치하지 않습니다' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
        { 
            role: 'admin',
            loginTime: new Date().toISOString()
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry }
    );

    // 쿠키 설정
    res.cookie('authToken', token, {
        httpOnly: true,
        secure: false, // 개발 환경에서는 false로 설정
        sameSite: 'lax', // Safari 호환성을 위해 'lax'로 변경
        maxAge: 24 * 60 * 60 * 1000, // 24시간
        path: '/' // 명시적 경로 설정
    });

    res.json({ 
        success: true, 
        token,
        expiresIn: config.auth.tokenExpiry 
    });
});

// 로그아웃
router.post('/logout', (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true });
});

// 인증 상태 확인
router.get('/check', (req, res) => {
    const token = req.cookies?.authToken || req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }

    jwt.verify(token, config.auth.jwtSecret, (err, decoded) => {
        if (err) {
            return res.status(401).json({ authenticated: false });
        }
        
        res.json({ 
            authenticated: true,
            user: {
                role: decoded.role,
                loginTime: decoded.loginTime
            }
        });
    });
});

module.exports = router;