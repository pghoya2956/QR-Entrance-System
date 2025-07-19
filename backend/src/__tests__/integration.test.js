const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

describe('통합 테스트', () => {
  let app;
  let server;
  const testDbPath = path.join(__dirname, '../data/test-integration.db');
  const testDataDir = path.join(__dirname, '../data/test-event-integration');
  
  beforeAll(async () => {
    // 환경 변수 설정
    process.env.USE_DATABASE = 'true';
    process.env.EVENT_ID = 'test-event-integration';
    process.env.EVENT_NAME = '통합 테스트 이벤트';
    process.env.CSV_FIELDS = '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간';
    process.env.CSV_REQUIRED = '등록번호,고객명,회사명,이메일';
    process.env.JWT_SECRET = 'test-secret';
    process.env.PORT = '0'; // 랜덤 포트
    
    // 테스트 디렉토리 생성
    await fs.mkdir(testDataDir, { recursive: true });
    
    // DB 서비스 초기화
    const DbService = require('../services/dbService');
    const dbService = new DbService(testDbPath);
    await dbService.init();
    global.dataService = dbService;
    
    // Express 앱 설정
    app = express();
    app.use(express.json());
    
    // 라우트 설정
    app.use('/api/info', require('../routes/info'));
    app.use('/api/checkin', require('../routes/checkin'));
    app.use('/api/admin', require('../routes/admin'));
    app.use('/api/qr', require('../routes/qr'));
    
    // 서버 시작
    server = app.listen(0);
  });
  
  afterAll(async () => {
    // 서버 종료
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    
    // DB 연결 종료
    if (global.dataService && global.dataService.db) {
      global.dataService.db.close();
    }
    
    // 테스트 파일 정리
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
      await fs.unlink(testDbPath);
    } catch (err) {
      // 무시
    }
  });
  
  describe('API 엔드포인트', () => {
    test('GET /api/info - 이벤트 정보 반환', async () => {
      const res = await request(app).get('/api/info');
      
      expect(res.status).toBe(200);
      expect(res.body.eventId).toBe('test-event-integration');
      expect(res.body.eventName).toBe('통합 테스트 이벤트');
      expect(res.body.fields).toContain('등록번호');
    });
    
    test('POST /api/admin/attendees - 참가자 추가', async () => {
      const attendee = {
        '고객명': '통합 테스트 참가자',
        '회사명': '테스트 회사',
        '이메일': 'integration@test.com',
        '연락처': '010-1234-5678'
      };
      
      const res = await request(app)
        .post('/api/admin/attendees')
        .send(attendee);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attendee['등록번호']).toMatch(/^REG\d{6}$/);
      expect(res.body.qrCode).toBeTruthy();
    });
    
    test('GET /api/admin/attendees - 참가자 목록 조회', async () => {
      const res = await request(app).get('/api/admin/attendees');
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
    
    test('POST /api/checkin/verify - 체크인 처리', async () => {
      // 먼저 참가자 추가
      const addRes = await request(app)
        .post('/api/admin/attendees')
        .send({
          '고객명': '체크인 테스트',
          '회사명': '테스트 회사',
          '이메일': 'checkin@test.com'
        });
      
      const registrationNumber = addRes.body.attendee['등록번호'];
      
      // 체크인 요청
      const checkinRes = await request(app)
        .post('/api/checkin/verify')
        .send({ 
          qrData: `CHECKIN:${registrationNumber}` 
        });
      
      expect(checkinRes.status).toBe(200);
      expect(checkinRes.body.success).toBe(true);
      expect(checkinRes.body.attendeeInfo.name).toBe('체크인 테스트');
      
      // 중복 체크인 시도
      const duplicateRes = await request(app)
        .post('/api/checkin/verify')
        .send({ 
          qrData: `CHECKIN:${registrationNumber}` 
        });
      
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toContain('이미 체크인');
    });
    
    test('GET /api/admin/stats - 통계 조회', async () => {
      const res = await request(app).get('/api/admin/stats');
      
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.checkedIn).toBeGreaterThanOrEqual(0);
      expect(res.body.notCheckedIn).toBeGreaterThanOrEqual(0);
      expect(res.body.checkedInPercentage).toBeDefined();
    });
    
    test('POST /api/admin/import-csv - CSV 업로드', async () => {
      const csvContent = `등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
CSV001,CSV 업로드 테스트,CSV 회사,010-9999-9999,csv@upload.com,초대,false,`;
      
      const res = await request(app)
        .post('/api/admin/import-csv')
        .attach('file', Buffer.from(csvContent), 'test.csv');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.imported).toBe(1);
    });
    
    test('GET /api/admin/export-csv - CSV 다운로드', async () => {
      const res = await request(app).get('/api/admin/export-csv');
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attendees.csv');
      expect(res.text).toContain('등록번호,고객명,회사명');
    });
  });
  
  describe('보안 테스트', () => {
    test('잘못된 QR 형식 거부', async () => {
      const res = await request(app)
        .post('/api/checkin/verify')
        .send({ qrData: 'INVALID_FORMAT' });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('잘못된 QR');
    });
    
    test('존재하지 않는 참가자 처리', async () => {
      const res = await request(app)
        .post('/api/checkin/verify')
        .send({ qrData: 'CHECKIN:NOTEXIST999' });
      
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('참석자를 찾을 수 없습니다');
    });
    
    test('필수 필드 누락 시 에러', async () => {
      const res = await request(app)
        .post('/api/admin/attendees')
        .send({
          '고객명': '필드 누락 테스트'
          // 이메일, 회사명 누락
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('필수 필드');
      expect(res.body.missing).toContain('회사명');
      expect(res.body.missing).toContain('이메일');
    });
  });
  
  describe('데이터베이스 모드', () => {
    test('USE_DATABASE=true 일 때 DB 사용', () => {
      expect(global.dataService.constructor.name).toBe('DbService');
      expect(global.dataService.db).toBeDefined();
    });
    
    test('백업 서비스 API 접근 가능', async () => {
      const res = await request(app).get('/api/admin/backups');
      
      // 백업 서비스가 초기화되지 않았으므로 404 예상
      expect([404, 500]).toContain(res.status);
    });
  });
});