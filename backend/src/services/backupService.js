const cron = require('node-cron');
const path = require('path');
const fs = require('fs').promises;
const { createReadStream, createWriteStream } = require('fs');
const { createGzip, createGunzip } = require('zlib');
const { pipeline } = require('stream').promises;

class BackupService {
  constructor(dbPath = null, backupDir = null) {
    this.dbPath = dbPath || path.join(__dirname, '../data/attendees.db');
    this.backupDir = backupDir || path.join(__dirname, '../data/backups');
    this.isRunning = false;
    this.cronJob = null;
    this.retentionDays = 30;
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error('백업 디렉토리 생성 오류:', error);
      throw error;
    }
  }

  async createBackup() {
    await this.ensureBackupDirectory();
    
    const timestamp = new Date().toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '')
      .replace(/\..+/, '');
    const backupFileName = `attendees_backup_${timestamp}.db.gz`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      console.log(`🔄 백업 시작: ${backupFileName}`);
      
      // DB 파일을 직접 압축하여 백업
      await pipeline(
        createReadStream(this.dbPath),
        createGzip({ level: 9 }),
        createWriteStream(backupPath)
      );
      
      // 파일 크기 확인
      const stats = await fs.stat(backupPath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      const backupInfo = {
        filename: backupFileName,
        path: backupPath,
        size: stats.size,
        sizeInMB: fileSizeInMB,
        createdAt: new Date().toISOString()
      };
      
      console.log(`✅ 백업 완료: ${backupFileName} (${fileSizeInMB} MB)`);
      
      // 오래된 백업 정리
      await this.cleanupOldBackups();
      
      // 백업 기록 저장 (DB가 있는 경우)
      await this.saveBackupRecord(backupInfo, 'success');
      
      return backupInfo;
      
    } catch (error) {
      console.error('❌ 백업 실패:', error);
      
      // 실패 기록 저장
      await this.saveBackupRecord({
        filename: backupFileName,
        path: backupPath,
        error: error.message
      }, 'failed');
      
      throw error;
    }
  }

  async saveBackupRecord(backupInfo, status) {
    try {
      // DB 서비스가 있으면 기록 저장
      const dbService = global.dataService;
      if (dbService && dbService.db && dbService.runAsync) {
        await dbService.runAsync(`
          INSERT INTO backup_history (
            event_id, backup_time, filename, file_size, status, error
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          process.env.EVENT_ID || 'default-event',
          backupInfo.createdAt || new Date().toISOString(),
          backupInfo.filename,
          backupInfo.size || null,
          status,
          backupInfo.error || null
        ]);
      }
    } catch (error) {
      console.error('백업 기록 저장 오류:', error);
      // 기록 저장 실패는 백업 자체의 실패가 아니므로 에러를 던지지 않음
    }
  }

  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => 
        f.startsWith('attendees_backup_') && f.endsWith('.db.gz')
      );
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`🗑️  오래된 백업 삭제: ${file}`);
        }
      }
      
      // 추가 안전장치: 최근 30개만 유지
      const sortedFiles = backupFiles.sort().reverse();
      if (sortedFiles.length > 30) {
        const filesToDelete = sortedFiles.slice(30);
        for (const file of filesToDelete) {
          const filePath = path.join(this.backupDir, file);
          try {
            await fs.unlink(filePath);
            console.log(`🗑️  초과 백업 삭제: ${file}`);
          } catch (err) {
            // 파일이 이미 삭제된 경우 무시
          }
        }
      }
      
    } catch (error) {
      console.error('백업 정리 오류:', error);
    }
  }

  async restoreBackup(backupFileName) {
    const backupPath = path.join(this.backupDir, backupFileName);
    
    try {
      // 현재 DB를 백업
      const currentBackup = `before_restore_${Date.now()}.db`;
      const currentBackupPath = path.join(this.backupDir, currentBackup);
      await fs.copyFile(this.dbPath, currentBackupPath);
      console.log(`📦 현재 DB 백업: ${currentBackup}`);
      
      // 압축 해제 및 복원
      const tempPath = backupPath.replace('.gz', '.temp');
      
      await pipeline(
        createReadStream(backupPath),
        createGunzip(),
        createWriteStream(tempPath)
      );
      
      // 복원
      await fs.copyFile(tempPath, this.dbPath);
      
      // 임시 파일 삭제
      await fs.unlink(tempPath);
      
      console.log(`✅ 백업 복원 완료: ${backupFileName}`);
      return true;
      
    } catch (error) {
      console.error('백업 복원 오류:', error);
      throw error;
    }
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  백업 서비스가 이미 실행 중입니다.');
      return;
    }

    // 크론 작업 설정 (매일 새벽 2시)
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      console.log('⏰ 예약된 백업 작업 시작...');
      try {
        await this.createBackup();
      } catch (error) {
        console.error('예약된 백업 실패:', error);
      }
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;
    console.log('✅ 백업 서비스 시작됨 (매일 새벽 2시 실행)');
    
    // 시작 시 즉시 백업 (옵션)
    if (process.env.BACKUP_ON_START === 'true') {
      console.log('🚀 초기 백업 실행...');
      this.createBackup().catch(console.error);
    }
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('⏹️  백업 서비스 중지됨');
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: '0 2 * * *',
      backupDir: this.backupDir,
      retentionDays: this.retentionDays
    };
  }

  async listBackups() {
    try {
      await this.ensureBackupDirectory();
      
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => 
        f.startsWith('attendees_backup_') && f.endsWith('.db.gz')
      );
      
      const backups = await Promise.all(
        backupFiles.map(async (fileName) => {
          const filePath = path.join(this.backupDir, fileName);
          const stats = await fs.stat(filePath);
          
          return {
            name: fileName,
            path: filePath,
            size: stats.size,
            sizeInMB: (stats.size / (1024 * 1024)).toFixed(2),
            createdAt: stats.mtime
          };
        })
      );
      
      // 최신순 정렬
      backups.sort((a, b) => b.createdAt - a.createdAt);
      
      return backups;
    } catch (error) {
      console.error('백업 목록 조회 오류:', error);
      return [];
    }
  }
}

module.exports = BackupService;