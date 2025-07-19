const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const { Migration } = require('../migrations/migrate');

describe('Migration', () => {
  const testDbPath = path.join(__dirname, '../data/test-migration.db');
  const testDataDir = path.join(__dirname, '../data');
  const testEventDir = path.join(testDataDir, 'test-migration-event');
  const testCsvPath = path.join(testEventDir, 'attendees.csv');
  
  beforeEach(async () => {
    // 테스트 디렉토리 생성
    await fs.mkdir(testEventDir, { recursive: true });
    
    // 테스트 CSV 파일 생성
    const csvContent = `등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
MIG001,마이그레이션 테스트1,테스트 회사1,010-1111-1111,mig1@test.com,초대,false,
MIG002,마이그레이션 테스트2,테스트 회사2,010-2222-2222,mig2@test.com,현장방문,true,2025-07-18 10:30:00
MIG003,마이그레이션 테스트3,테스트 회사3,010-3333-3333,mig3@test.com,초대,false,`;
    
    await fs.writeFile(testCsvPath, csvContent, 'utf-8');
  });
  
  afterEach(async () => {
    // 정리
    try {
      await fs.rm(testEventDir, { recursive: true, force: true });
      await fs.unlink(testDbPath);
    } catch (err) {
      // 무시
    }
  });
  
  describe('스키마 마이그레이션', () => {
    test('초기 스키마가 생성되어야 함', async () => {
      const migration = new Migration(testDbPath);
      await migration.runMigrations();
      
      const db = new Database(testDbPath);
      
      // 테이블 확인
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all();
      const tableNames = tables.map(t => t.name);
      
      expect(tableNames).toContain('attendees');
      expect(tableNames).toContain('migrations');
      expect(tableNames).toContain('backup_history');
      
      // 인덱스 확인
      const indexes = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index'"
      ).all();
      const indexNames = indexes.map(i => i.name);
      
      expect(indexNames).toContain('idx_attendees_event_checkin');
      expect(indexNames).toContain('idx_attendees_checkin_time');
      
      db.close();
    });
    
    test('마이그레이션 기록이 저장되어야 함', async () => {
      const migration = new Migration(testDbPath);
      await migration.runMigrations();
      
      const db = new Database(testDbPath);
      const records = db.prepare('SELECT * FROM migrations').all();
      
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].name).toBe('001-initial-schema.sql');
      expect(records[0].applied_at).toBeTruthy();
      
      db.close();
    });
  });
  
  describe('CSV 데이터 마이그레이션', () => {
    test('CSV 데이터가 DB로 이전되어야 함', async () => {
      const migration = new Migration(testDbPath);
      await migration.runMigrations();
      
      const db = new Database(testDbPath);
      await migration.migrateExistingData(db);
      
      // 데이터 확인
      const attendees = db.prepare(
        'SELECT * FROM attendees WHERE event_id = ? ORDER BY registration_number'
      ).all('test-migration-event');
      
      expect(attendees.length).toBe(3);
      
      // 첫 번째 참석자
      expect(attendees[0].registration_number).toBe('MIG001');
      expect(attendees[0].name).toBe('마이그레이션 테스트1');
      expect(attendees[0].company).toBe('테스트 회사1');
      expect(attendees[0].email).toBe('mig1@test.com');
      expect(attendees[0].checked_in).toBe(0);
      
      // 두 번째 참석자 (체크인 완료)
      expect(attendees[1].registration_number).toBe('MIG002');
      expect(attendees[1].checked_in).toBe(1);
      expect(attendees[1].checkin_time).toBe('2025-07-18 10:30:00');
      
      db.close();
    });
    
    test('중복 데이터는 건너뛰어야 함', async () => {
      const migration = new Migration(testDbPath);
      await migration.runMigrations();
      
      const db = new Database(testDbPath);
      
      // 첫 번째 마이그레이션
      await migration.migrateExistingData(db);
      
      // 두 번째 마이그레이션 (중복)
      await migration.migrateExistingData(db);
      
      // 데이터 개수 확인
      const count = db.prepare(
        'SELECT COUNT(*) as count FROM attendees WHERE event_id = ?'
      ).get('test-migration-event');
      
      expect(count.count).toBe(3); // 중복 없이 3개만
      
      db.close();
    });
    
    test('여러 이벤트 디렉토리를 처리해야 함', async () => {
      // 두 번째 이벤트 디렉토리 생성
      const testEventDir2 = path.join(testDataDir, 'test-migration-event2');
      const testCsvPath2 = path.join(testEventDir2, 'attendees.csv');
      await fs.mkdir(testEventDir2, { recursive: true });
      
      const csvContent2 = `등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
EVENT2-001,이벤트2 참석자,회사2,010-4444-4444,event2@test.com,초대,false,`;
      
      await fs.writeFile(testCsvPath2, csvContent2, 'utf-8');
      
      // 마이그레이션 실행
      const migration = new Migration(testDbPath);
      await migration.runMigrations();
      
      const db = new Database(testDbPath);
      await migration.migrateExistingData(db);
      
      // 각 이벤트 데이터 확인
      const event1Count = db.prepare(
        'SELECT COUNT(*) as count FROM attendees WHERE event_id = ?'
      ).get('test-migration-event');
      
      const event2Count = db.prepare(
        'SELECT COUNT(*) as count FROM attendees WHERE event_id = ?'
      ).get('test-migration-event2');
      
      expect(event1Count.count).toBe(3);
      expect(event2Count.count).toBe(1);
      
      db.close();
      
      // 정리
      await fs.rm(testEventDir2, { recursive: true, force: true });
    });
  });
  
  describe('마이그레이션 상태', () => {
    test('마이그레이션 상태를 확인할 수 있어야 함', async () => {
      const migration = new Migration(testDbPath);
      await migration.runMigrations();
      
      const db = new Database(testDbPath);
      const status = await migration.checkStatus(db);
      
      expect(status.applied).toContain('001-initial-schema.sql');
      expect(status.pending.length).toBe(0);
      
      db.close();
    });
  });
});