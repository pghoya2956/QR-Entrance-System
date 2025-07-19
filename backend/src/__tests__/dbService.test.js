const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const DbService = require('../services/dbService');

describe('DbService', () => {
  let dbService;
  const testEventId = 'test-event-2025';
  const testDbPath = path.join(__dirname, '../data/test-attendees.db');
  
  beforeEach(async () => {
    // 테스트 DB 파일 삭제
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // 파일이 없어도 무시
    }
    
    // 환경 변수 설정
    process.env.EVENT_ID = testEventId;
    process.env.CSV_FIELDS = '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간';
    process.env.CSV_REQUIRED = '등록번호,고객명,회사명,이메일';
    
    // DbService 인스턴스 생성
    dbService = new DbService(testDbPath);
    await dbService.init();
  });
  
  afterEach(async () => {
    // DB 연결 종료
    if (dbService && dbService.db) {
      dbService.db.close();
    }
    
    // 테스트 DB 파일 삭제
    try {
      await fs.unlink(testDbPath);
    } catch (err) {
      // 무시
    }
  });
  
  describe('초기화', () => {
    test('DB 파일이 생성되어야 함', async () => {
      const stats = await fs.stat(testDbPath);
      expect(stats.isFile()).toBe(true);
    });
    
    test('attendees 테이블이 생성되어야 함', () => {
      const tables = dbService.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='attendees'"
      ).all();
      expect(tables.length).toBe(1);
    });
  });
  
  describe('참석자 관리', () => {
    const testAttendee = {
      '등록번호': 'TEST001',
      '고객명': '테스트 사용자',
      '회사명': '테스트 회사',
      '연락처': '010-1234-5678',
      '이메일': 'test@example.com',
      '초대/현장방문': '초대',
      '체크인': 'false',
      '체크인시간': ''
    };
    
    test('참석자 추가가 작동해야 함', async () => {
      const result = await dbService.addAttendee(testAttendee);
      expect(result['등록번호']).toBe('TEST001');
      expect(result['고객명']).toBe('테스트 사용자');
      
      const attendees = await dbService.readAttendees();
      expect(attendees.length).toBe(1);
    });
    
    test('중복 등록번호는 에러를 발생시켜야 함', async () => {
      await dbService.addAttendee(testAttendee);
      await expect(dbService.addAttendee(testAttendee))
        .rejects
        .toThrow('이미 존재하는 등록번호');
    });
    
    test('중복 이메일은 에러를 발생시켜야 함', async () => {
      await dbService.addAttendee(testAttendee);
      const duplicate = { ...testAttendee, '등록번호': 'TEST002' };
      await expect(dbService.addAttendee(duplicate))
        .rejects
        .toThrow('이미 존재하는 이메일');
    });
    
    test('필수 필드 검증이 작동해야 함', async () => {
      const invalidAttendee = { ...testAttendee };
      delete invalidAttendee['이메일'];
      
      const missing = dbService.validateRequired(invalidAttendee);
      expect(missing).toContain('이메일');
    });
    
    test('체크인 처리가 작동해야 함', async () => {
      await dbService.addAttendee(testAttendee);
      
      const attendees = await dbService.readAttendees();
      const updatedAttendees = attendees.map(a => ({
        ...a,
        '체크인': 'true',
        '체크인시간': new Date().toLocaleString('ko-KR')
      }));
      
      await dbService.writeAttendees(updatedAttendees);
      
      const result = await dbService.readAttendees();
      expect(result[0]['체크인']).toBe('true');
      expect(result[0]['체크인시간']).toBeTruthy();
    });
  });
  
  describe('CSV 호환성', () => {
    test('CSV 포맷으로 데이터를 생성할 수 있어야 함', async () => {
      const attendees = [
        {
          '등록번호': 'CSV001',
          '고객명': 'CSV 테스트',
          '회사명': 'CSV 회사',
          '연락처': '010-1111-2222',
          '이메일': 'csv@test.com',
          '초대/현장방문': '현장방문',
          '체크인': 'false',
          '체크인시간': ''
        }
      ];
      
      await dbService.addAttendee(attendees[0]);
      const csv = await dbService.generateCSV(await dbService.readAttendees());
      
      expect(csv).toContain('등록번호,고객명,회사명');
      expect(csv).toContain('CSV001,CSV 테스트,CSV 회사');
    });
    
    test('CSV 데이터를 파싱할 수 있어야 함', async () => {
      const csvContent = `등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
PARSE001,파싱 테스트,파싱 회사,010-3333-4444,parse@test.com,초대,false,`;
      
      const attendees = await dbService.parseCSV(csvContent);
      expect(attendees.length).toBe(1);
      expect(attendees[0]['등록번호']).toBe('PARSE001');
      expect(attendees[0]['고객명']).toBe('파싱 테스트');
    });
  });
  
  describe('등록번호 생성', () => {
    test('고유한 등록번호를 생성해야 함', async () => {
      const num1 = await dbService.generateRegistrationNumber();
      const num2 = await dbService.generateRegistrationNumber();
      
      expect(num1).toMatch(/^REG\d{6}$/);
      expect(num2).toMatch(/^REG\d{6}$/);
      expect(num1).not.toBe(num2);
    });
  });
  
  describe('다중 이벤트 지원', () => {
    test('이벤트별로 참석자가 분리되어야 함', async () => {
      // 첫 번째 이벤트
      const attendee1 = {
        '등록번호': 'EVENT1-001',
        '고객명': '이벤트1 참석자',
        '회사명': '회사1',
        '이메일': 'event1@test.com',
        '체크인': 'false'
      };
      await dbService.addAttendee(attendee1);
      
      // 다른 이벤트로 전환
      process.env.EVENT_ID = 'another-event-2025';
      const dbService2 = new DbService(testDbPath);
      await dbService2.init();
      
      const attendee2 = {
        '등록번호': 'EVENT2-001',
        '고객명': '이벤트2 참석자',
        '회사명': '회사2',
        '이메일': 'event2@test.com',
        '체크인': 'false'
      };
      await dbService2.addAttendee(attendee2);
      
      // 각 이벤트의 참석자 확인
      const event1Attendees = await dbService.readAttendees();
      const event2Attendees = await dbService2.readAttendees();
      
      expect(event1Attendees.length).toBe(1);
      expect(event2Attendees.length).toBe(1);
      expect(event1Attendees[0]['고객명']).toBe('이벤트1 참석자');
      expect(event2Attendees[0]['고객명']).toBe('이벤트2 참석자');
      
      dbService2.db.close();
    });
  });
});