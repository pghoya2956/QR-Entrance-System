const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 이벤트 설정 환경변수
const EVENT_ID = process.env.EVENT_ID || 'default-event';
const EVENT_NAME = process.env.EVENT_NAME || '기본 이벤트';
const CSV_FIELDS = process.env.CSV_FIELDS || '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간';
const CSV_REQUIRED = process.env.CSV_REQUIRED || '등록번호,고객명,회사명,이메일';

// 환경변수 검증
if (!process.env.EVENT_ID) {
  console.warn('WARNING: EVENT_ID가 설정되지 않았습니다. 기본값을 사용합니다.');
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 이벤트 정보 엔드포인트
app.get('/api/info', (req, res) => {
  res.json({
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    port: PORT,
    csvFields: CSV_FIELDS.split(',').map(field => field.trim()),
    requiredFields: CSV_REQUIRED.split(',').map(field => field.trim()),
    version: '2.0.0' // 멀티 이벤트 버전
  });
});

// API 라우트만 제공 (정적 파일 서빙 제거)
const qrRoutes = require('./routes/qr');
const checkinRoutes = require('./routes/checkin');
const adminRoutes = require('./routes/admin');

app.use('/api/qr', qrRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/admin', adminRoutes);

// 루트 경로 접근 시 API 정보 반환
app.get('/', (req, res) => {
  res.json({
    service: 'QR Event Backend',
    eventId: EVENT_ID,
    eventName: EVENT_NAME,
    version: '2.0.0',
    endpoints: [
      '/api/info',
      '/api/qr/*',
      '/api/checkin/*',
      '/api/admin/*'
    ]
  });
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log(`🚀 이벤트: ${EVENT_NAME} (${EVENT_ID})`);
  console.log(`📍 포트: ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📋 CSV 필드: ${CSV_FIELDS.split(',').length}개`);
  console.log('=================================');
});