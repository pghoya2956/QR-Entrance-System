const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const config = require('./config/backend.config');

// 데이터베이스 서비스 직접 사용
const dataService = require('./services/dbService');

// 데이터베이스 초기화
async function initializeDataService() {
  // DB 초기화 대기
  await dataService.initPromise;
  console.log('✅ SQLite 데이터베이스 서비스 준비 완료');
  
  // 전역 데이터 서비스 설정
  global.dataService = dataService;
}

// 이벤트 설정 환경변수
const EVENT_ID = process.env.EVENT_ID || 'default-event';
const EVENT_NAME = process.env.EVENT_NAME || '기본 이벤트';

// 환경변수 검증
if (!process.env.EVENT_ID) {
  console.warn('WARNING: EVENT_ID가 설정되지 않았습니다. 기본값을 사용합니다.');
}

// 비동기 초기화 및 서버 시작
async function startServer() {
  try {
    // 데이터 서비스 초기화 완료까지 대기
    await initializeDataService();
    
    app.use(cors(config.cors));
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    
    // Safari 쿠키 호환성을 위한 추가 설정
    app.use((req, res, next) => {
      // Safari에서 쿠키 전송을 위한 헤더
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Origin 헤더가 있으면 동적으로 설정
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      }
      
      next();
    });
    
    // 보안 헤더 설정
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });

    // event_id 쿼리 파라미터를 req.eventId로 설정하는 미들웨어
    app.use((req, res, next) => {
      req.eventId = req.query.event_id || EVENT_ID;
      next();
    });


    // 헬스체크 엔드포인트
    app.get('/api/health', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        dataService: 'SQLite',
        event: {
          id: EVENT_ID,
          name: EVENT_NAME
        }
      };

      // 백업 상태 추가
      if (global.backupService) {
        const backupStatus = global.backupService.getStatus();
        health.backup = {
          running: backupStatus.isRunning,
          schedule: backupStatus.schedule,
          backupDir: backupStatus.backupDir
        };
      }

      res.json(health);
    });

    // 인증 라우트 (인증 불필요)
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);

    // 인증 미들웨어
    const { authenticateToken } = require('./middleware/auth');

    // API 라우트 (인증 필요)
    const qrRoutes = require('./routes/qr');
    const checkinRoutes = require('./routes/checkin');
    const adminRoutes = require('./routes/admin');

    app.use('/api/qr', authenticateToken, qrRoutes);
    app.use('/api/checkin', authenticateToken, checkinRoutes);
    app.use('/api/admin', authenticateToken, adminRoutes);
    
    // 이벤트 관련 API도 인증 필요
    app.get('/api/events', authenticateToken, async (req, res) => {
      try {
        // DB에서 모든 고유 이벤트 조회
        const events = await new Promise((resolve, reject) => {
          global.dataService.db.all(
            `SELECT event_id, COUNT(*) as attendeeCount 
             FROM attendees 
             GROUP BY event_id`,
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });

        // events 테이블에서 이벤트 정보 조회
        const eventInfos = await dataService.allAsync('SELECT id, name, description, created_at FROM events');
        const eventMap = {};
        eventInfos.forEach(e => { 
          eventMap[e.id] = {
            name: e.name,
            description: e.description,
            created_at: e.created_at
          };
        });
        
        const eventList = events.map(event => ({
          eventId: event.event_id,
          eventName: eventMap[event.event_id]?.name || event.event_id,
          description: eventMap[event.event_id]?.description || '',
          created_at: eventMap[event.event_id]?.created_at || new Date().toISOString(),
          attendeeCount: event.attendeeCount
        }));

        res.json(eventList);
      } catch (error) {
        console.error('이벤트 목록 조회 오류:', error);
        res.status(500).json({ error: '이벤트 목록 조회 실패' });
      }
    });

    // 이벤트 정보 엔드포인트도 인증 필요
    app.get('/api/info', authenticateToken, async (req, res) => {
      try {
        // events 테이블에서 이벤트 정보 조회
        const eventInfo = await dataService.getAsync('SELECT name FROM events WHERE id = ?', [req.eventId]);
        const eventName = eventInfo ? eventInfo.name : req.eventId;
      
        res.json({
          eventId: req.eventId,
          eventName: eventName,
          port: PORT,
          // CSV 필드는 더 이상 사용하지 않음
          version: '2.1.0', // 단일 백엔드 버전
          dataMode: 'database' // 항상 DB 모드
        });
      } catch (error) {
        console.error('이벤트 정보 조회 오류:', error);
        res.status(500).json({ error: '이벤트 정보 조회 실패' });
      }
    });

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
      console.log(`💾 데이터: SQLite 데이터베이스`);
      console.log('=================================');
      
      // 백업 서비스 시작
      if (global.dataService) {
        const BackupService = require('./services/backupService');
        const backupService = new BackupService();
        backupService.start();
        global.backupService = backupService;
      }
    });
  } catch (err) {
    console.error('❌ 서버 시작 실패:', err);
    process.exit(1);
  }
}

// 서버 시작
startServer();