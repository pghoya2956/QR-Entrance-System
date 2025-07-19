const fs = require('fs').promises;
const path = require('path');
const BackupService = require('../services/backupService');
const DbService = require('../services/dbService');

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn()
  }))
}));

describe('BackupService', () => {
  let backupService;
  let dbService;
  const testDbPath = path.join(__dirname, '../data/test-backup.db');
  const testBackupDir = path.join(__dirname, '../data/test-backups');
  
  beforeEach(async () => {
    // 테스트 디렉토리 생성
    await fs.mkdir(testBackupDir, { recursive: true });
    
    // DB 서비스 초기화
    process.env.EVENT_ID = 'test-event';
    dbService = new DbService(testDbPath);
    await dbService.init();
    
    // 테스트 데이터 추가
    await dbService.addAttendee({
      '등록번호': 'BACKUP001',
      '고객명': '백업 테스트',
      '회사명': '테스트 회사',
      '이메일': 'backup@test.com',
      '체크인': 'false'
    });
    
    // 백업 서비스 초기화
    backupService = new BackupService(testDbPath, testBackupDir);
  });
  
  afterEach(async () => {
    // 정리
    if (dbService && dbService.db) {
      dbService.db.close();
    }
    
    if (backupService) {
      backupService.stop();
    }
    
    // 테스트 파일 삭제
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
      await fs.unlink(testDbPath);
    } catch (err) {
      // 무시
    }
  });
  
  describe('백업 생성', () => {
    test('백업 파일이 생성되어야 함', async () => {
      const result = await backupService.createBackup();
      
      expect(result.filename).toMatch(/^attendees_backup_\d{8}_\d{6}\.db\.gz$/);
      expect(result.size).toBeGreaterThan(0);
      
      // 파일 존재 확인
      const filePath = path.join(testBackupDir, result.filename);
      const stats = await fs.stat(filePath);
      expect(stats.isFile()).toBe(true);
    });
    
    test('백업 기록이 DB에 저장되어야 함', async () => {
      await backupService.createBackup();
      
      const db = dbService.db;
      const records = db.prepare(
        'SELECT * FROM backup_history ORDER BY created_at DESC'
      ).all();
      
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].event_id).toBe('test-event');
      expect(records[0].status).toBe('success');
    });
    
    test('백업 실패 시 에러 기록이 저장되어야 함', async () => {
      // 백업 디렉토리를 읽기 전용으로 만들어 에러 유발
      await fs.chmod(testBackupDir, 0o444);
      
      try {
        await backupService.createBackup();
      } catch (err) {
        // 예상된 에러
      }
      
      // 권한 복원
      await fs.chmod(testBackupDir, 0o755);
      
      const db = dbService.db;
      const records = db.prepare(
        'SELECT * FROM backup_history WHERE status = ? ORDER BY created_at DESC'
      ).all('failed');
      
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].error).toBeTruthy();
    });
  });
  
  describe('백업 목록 조회', () => {
    test('백업 파일 목록을 반환해야 함', async () => {
      // 여러 백업 생성
      await backupService.createBackup();
      await new Promise(resolve => setTimeout(resolve, 100)); // 타임스탬프 차이
      await backupService.createBackup();
      
      const backups = await backupService.listBackups();
      
      expect(backups.length).toBe(2);
      expect(backups[0].name).toMatch(/^attendees_backup_.*\.db\.gz$/);
      expect(backups[0].size).toBeGreaterThan(0);
      expect(backups[0].createdAt).toBeTruthy();
    });
  });
  
  describe('오래된 백업 정리', () => {
    test('30일 이상 된 백업이 삭제되어야 함', async () => {
      // 현재 백업 생성
      const currentBackup = await backupService.createBackup();
      
      // 오래된 백업 시뮬레이션 (파일명 수정)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const oldDateStr = oldDate.toISOString().slice(0, 10).replace(/-/g, '');
      const oldFilename = `attendees_backup_${oldDateStr}_120000.db.gz`;
      const oldPath = path.join(testBackupDir, oldFilename);
      
      // 현재 백업 파일을 복사하여 오래된 백업 생성
      const currentPath = path.join(testBackupDir, currentBackup.filename);
      await fs.copyFile(currentPath, oldPath);
      
      // 정리 실행
      await backupService.cleanupOldBackups();
      
      // 확인
      const backups = await backupService.listBackups();
      const filenames = backups.map(b => b.name);
      
      expect(filenames).toContain(currentBackup.filename);
      expect(filenames).not.toContain(oldFilename);
    });
  });
  
  describe('백업 상태', () => {
    test('백업 서비스 상태를 반환해야 함', () => {
      const status = backupService.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.schedule).toBe('0 2 * * *');
      expect(status.backupDir).toBe(testBackupDir);
      expect(status.retentionDays).toBe(30);
    });
  });
  
  describe('스케줄링', () => {
    test('크론 작업이 등록되어야 함', () => {
      const cron = require('node-cron');
      
      backupService.start();
      
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        { scheduled: false }
      );
    });
  });
});