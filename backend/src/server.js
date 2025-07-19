const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 데이터 서비스 선택 (DB 또는 CSV)
const USE_DATABASE = process.env.USE_DATABASE !== 'false'; // 기본값: true
let dataService;

// 데이터 서비스 초기화
async function initializeDataService() {
  if (USE_DATABASE) {
    dataService = require('./services/dbService');
    // DB 초기화 대기
    await dataService.initPromise;
    console.log('✅ SQLite 데이터베이스 서비스 준비 완료');
  } else {
    dataService = require('./services/csvService');
    console.log('✅ CSV 파일 서비스 사용');
  }
  
  // 전역 데이터 서비스 설정
  global.dataService = dataService;
}

// 데이터 서비스 초기화 실행
initializeDataService().catch(err => {
  console.error('❌ 데이터 서비스 초기화 실패:', err);
  process.exit(1);
});

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
    version: '2.0.0', // 멀티 이벤트 버전
    dataMode: USE_DATABASE ? 'database' : 'csv'
  });
});

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dataService: USE_DATABASE ? 'SQLite' : 'CSV',
    event: {
      id: EVENT_ID,
      name: EVENT_NAME
    }
  };

  // 백업 상태 추가 (DB 모드일 때만)
  if (USE_DATABASE && global.backupService) {
    const backupStatus = global.backupService.getStatus();
    health.backup = {
      running: backupStatus.isRunning,
      schedule: backupStatus.schedule,
      backupDir: backupStatus.backupDir
    };
  }

  res.json(health);
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
  console.log(`💾 데이터: ${USE_DATABASE ? 'SQLite 데이터베이스' : 'CSV 파일'}`);
  console.log(`📋 CSV 필드: ${CSV_FIELDS.split(',').length}개`);
  console.log('=================================');
  
  // 백업 서비스 시작 (DB 모드일 때만)
  if (USE_DATABASE && global.dataService) {
    const BackupService = require('./services/backupService');
    const backupService = new BackupService();
    backupService.start();
    global.backupService = backupService;
  }
});