const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

class Migration {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../data/attendees.db');
    this.dataDir = path.join(__dirname, '../data');
    this.migrationsDir = __dirname;
    this.db = null;
  }

  // Promise 래퍼
  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          // WAL 모드 활성화
          this.db.run('PRAGMA journal_mode = WAL');
          this.db.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  closeDatabase() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // 백업 디렉토리도 생성
      const backupDir = path.join(this.dataDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      
    } catch (error) {
      console.error('디렉토리 생성 오류:', error);
      throw error;
    }
  }

  async runMigrations() {
    console.log('🚀 마이그레이션 시작...');
    
    try {
      // 1. 데이터 디렉토리 확인
      await this.ensureDataDirectory();
      
      // 2. 데이터베이스 연결
      await this.openDatabase();
      
      // 3. 초기 스키마 적용
      const schemaPath = path.join(this.migrationsDir, '001-initial-schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');
      
      // SQL 문장을 분리하여 실행
      const statements = schema.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.runAsync(statement);
        }
      }
      
      console.log('✅ 데이터베이스 스키마 생성 완료');
      
      // 4. 마이그레이션 기록
      await this.runAsync(
        'INSERT OR IGNORE INTO migration_history (version) VALUES (?)',
        ['001-initial-schema.sql']
      );
      
      return true;
      
    } catch (error) {
      console.error('❌ 스키마 생성 실패:', error);
      throw error;
    }
  }

  async migrateExistingData() {
    console.log('📂 기존 CSV 데이터 검색 중...');
    
    try {
      // data 디렉토리의 모든 이벤트 폴더 찾기
      const entries = await fs.readdir(this.dataDir, { withFileTypes: true });
      const eventDirs = entries.filter(entry => 
        entry.isDirectory() && entry.name !== 'backups'
      );
      
      if (eventDirs.length === 0) {
        console.log('ℹ️  마이그레이션할 CSV 데이터가 없습니다.');
        return;
      }
      
      let totalCount = 0;
      
      for (const eventDir of eventDirs) {
        const eventId = eventDir.name;
        const csvPath = path.join(this.dataDir, eventId, 'attendees.csv');
        
        const count = await this.migrateSingleEvent(csvPath, eventId);
        totalCount += count;
      }
      
      console.log(`✅ 총 ${totalCount}명의 데이터 마이그레이션 완료`);
      
    } catch (error) {
      console.error('❌ 데이터 마이그레이션 실패:', error);
      throw error;
    }
  }

  async migrateSingleEvent(csvPath, eventId) {
    try {
      // CSV 파일 읽기
      const csvContent = await fs.readFile(csvPath, 'utf8');
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        console.log(`⚠️  ${eventId}: 데이터 없음`);
        return 0;
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      let count = 0;
      
      await this.runAsync('BEGIN TRANSACTION');
      
      try {
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // CSV 파싱
          const values = this.parseCSVLine(line);
          const attendee = {};
          
          headers.forEach((header, index) => {
            attendee[header] = values[index] || '';
          });
          
          // DB에 삽입
          try {
            await this.runAsync(`
              INSERT OR IGNORE INTO attendees (
                event_id, registration_number, name, company, contact,
                email, invitation_type, checked_in, checkin_time
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              eventId,
              attendee['등록번호'],
              attendee['고객명'],
              attendee['회사명'],
              attendee['연락처'] || '',
              attendee['이메일'],
              attendee['초대/현장방문'] || '',
              attendee['체크인'] === 'true' ? 1 : 0,
              attendee['체크인시간'] || null
            ]);
            count++;
          } catch (err) {
            if (!err.message.includes('UNIQUE constraint')) {
              console.error(`  ❌ ${eventId} - 행 ${i} 오류:`, err.message);
            }
          }
        }
        
        await this.runAsync('COMMIT');
        console.log(`  ✅ ${eventId}: ${count}명 마이그레이션 완료`);
        
      } catch (error) {
        await this.runAsync('ROLLBACK');
        throw error;
      }
      
      return count;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⚠️  ${eventId}: CSV 파일 없음`);
        return 0;
      } else {
        console.error(`  ❌ ${eventId} 마이그레이션 오류:`, error.message);
        return 0;
      }
    }
  }

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  }

  async checkStatus() {
    try {
      await this.openDatabase();
      
      // 테이블 존재 확인
      const tables = await this.allAsync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='attendees'
      `);
      
      if (tables.length === 0) {
        console.log('❌ 데이터베이스가 초기화되지 않았습니다.');
        await this.closeDatabase();
        return { applied: [], pending: ['001-initial-schema.sql'] };
      }
      
      // 마이그레이션 기록 확인
      const migrations = await this.allAsync(
        'SELECT version as name FROM migration_history ORDER BY applied_at'
      );
      
      const applied = migrations.map(m => m.name);
      const pending = [];
      
      // 데이터 통계
      const stats = await this.allAsync(`
        SELECT event_id, COUNT(*) as count 
        FROM attendees 
        GROUP BY event_id
      `);
      
      console.log('\n📊 데이터베이스 현황:');
      if (stats.length > 0) {
        stats.forEach(stat => {
          console.log(`  - ${stat.event_id}: ${stat.count}명`);
        });
        
        const total = await this.getAsync('SELECT COUNT(*) as count FROM attendees');
        console.log(`  총계: ${total.count}명`);
      } else {
        console.log('  데이터 없음');
      }
      
      console.log('\n적용된 마이그레이션:');
      applied.forEach(m => console.log(`  ✅ ${m}`));
      
      if (pending.length > 0) {
        console.log('\n대기 중인 마이그레이션:');
        pending.forEach(m => console.log(`  ⏳ ${m}`));
      }
      
      await this.closeDatabase();
      return { applied, pending };
      
    } catch (error) {
      console.error('상태 확인 오류:', error);
      if (this.db) await this.closeDatabase();
      return { applied: [], pending: [] };
    }
  }

  async run() {
    try {
      // 1. 스키마 마이그레이션
      await this.runMigrations();
      
      // 2. 데이터 마이그레이션
      await this.migrateExistingData();
      
      // 3. 상태 확인
      await this.checkStatus();
      
      await this.closeDatabase();
      
      console.log('\n✅ 마이그레이션 완료!');
      
    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      if (this.db) await this.closeDatabase();
      process.exit(1);
    }
  }
}

// CLI 실행
if (require.main === module) {
  const migration = new Migration();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      migration.checkStatus().then(() => process.exit(0));
      break;
    case 'run':
    default:
      migration.run().then(() => process.exit(0));
      break;
  }
}

module.exports = { Migration };