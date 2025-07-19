const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DBService {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/attendees.db');
    this.dataDir = path.join(__dirname, '../data');
    this.db = null;
    this.eventId = process.env.EVENT_ID || 'default-event';
    
    // CSV 필드 매핑 (환경변수와 동일하게 유지)
    this.csvFields = (process.env.CSV_FIELDS || '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간').split(',').map(f => f.trim());
    this.requiredFields = (process.env.CSV_REQUIRED || '등록번호,고객명,회사명,이메일').split(',').map(f => f.trim());
  }

  async init() {
    await this.ensureDataDirectory();
    await this.initDatabase();
    console.log('✅ SQLite 데이터베이스 초기화 완료');
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('데이터 디렉토리 생성 오류:', error);
    }
  }

  async initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          console.error('데이터베이스 연결 오류:', err);
          reject(err);
          return;
        }
        
        // WAL 모드 활성화
        this.db.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) console.warn('WAL 모드 설정 실패:', err);
        });
        
        this.db.run('PRAGMA foreign_keys = ON');
        
        // 테이블 생성
        await this.createTables();
        resolve();
      });
    });
  }

  async createTables() {
    const sqlPath = path.join(__dirname, '../migrations/001-initial-schema.sql');
    
    try {
      // SQL 파일이 있으면 사용, 없으면 내장 스키마 사용
      let createTableSQL;
      try {
        createTableSQL = await fs.readFile(sqlPath, 'utf-8');
      } catch (err) {
        // 내장 스키마
        createTableSQL = `
          CREATE TABLE IF NOT EXISTS attendees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            registration_number TEXT NOT NULL,
            name TEXT NOT NULL,
            company TEXT NOT NULL,
            contact TEXT,
            email TEXT NOT NULL,
            invitation_type TEXT,
            checked_in INTEGER DEFAULT 0,
            checkin_time TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE(event_id, registration_number),
            UNIQUE(event_id, email)
          );
          
          CREATE INDEX IF NOT EXISTS idx_attendees_event_checkin ON attendees(event_id, checked_in);
          CREATE INDEX IF NOT EXISTS idx_attendees_checkin_time ON attendees(checkin_time);
        `;
      }
      
      // SQL 문장을 분리하여 실행
      const statements = createTableSQL.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        await this.runAsync(statement);
      }
    } catch (error) {
      console.error('테이블 생성 오류:', error);
      throw error;
    }
  }

  // Promise 래퍼 함수들
  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
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

  allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // CSV 필드명을 DB 컬럼명으로 매핑
  mapCsvToDb(csvData) {
    return {
      event_id: this.eventId,
      registration_number: csvData['등록번호'],
      name: csvData['고객명'],
      company: csvData['회사명'],
      contact: csvData['연락처'] || '',
      email: csvData['이메일'],
      invitation_type: csvData['초대/현장방문'] || '',
      checked_in: csvData['체크인'] === 'true' ? 1 : 0,
      checkin_time: csvData['체크인시간'] || null
    };
  }

  // DB 컬럼명을 CSV 필드명으로 매핑
  mapDbToCsv(dbData) {
    return {
      '등록번호': dbData.registration_number,
      '고객명': dbData.name,
      '회사명': dbData.company,
      '연락처': dbData.contact || '',
      '이메일': dbData.email,
      '초대/현장방문': dbData.invitation_type || '',
      '체크인': dbData.checked_in ? 'true' : 'false',
      '체크인시간': dbData.checkin_time || ''
    };
  }

  async readAttendees() {
    try {
      const rows = await this.allAsync(
        'SELECT * FROM attendees WHERE event_id = ? ORDER BY registration_number',
        [this.eventId]
      );
      
      // CSV 형식으로 변환하여 반환 (기존 API와 호환성 유지)
      return rows.map(row => this.mapDbToCsv(row));
    } catch (error) {
      console.error('참석자 조회 오류:', error);
      return [];
    }
  }

  async writeAttendees(attendees) {
    try {
      // 트랜잭션 시작
      await this.runAsync('BEGIN TRANSACTION');
      
      try {
        // 기존 데이터 삭제
        await this.runAsync('DELETE FROM attendees WHERE event_id = ?', [this.eventId]);
        
        // 새 데이터 삽입
        const insertSQL = `
          INSERT INTO attendees (
            event_id, registration_number, name, company, contact, 
            email, invitation_type, checked_in, checkin_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        for (const attendee of attendees) {
          const dbData = this.mapCsvToDb(attendee);
          await this.runAsync(insertSQL, [
            dbData.event_id,
            dbData.registration_number,
            dbData.name,
            dbData.company,
            dbData.contact,
            dbData.email,
            dbData.invitation_type,
            dbData.checked_in,
            dbData.checkin_time
          ]);
        }
        
        await this.runAsync('COMMIT');
        return true;
      } catch (error) {
        await this.runAsync('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('참석자 저장 오류:', error);
      return false;
    }
  }

  async updateAttendee(registrationNumber, updates) {
    try {
      // 현재 참석자 정보 가져오기
      const attendee = await this.getAsync(
        'SELECT * FROM attendees WHERE event_id = ? AND registration_number = ?',
        [this.eventId, registrationNumber]
      );
      
      if (!attendee) {
        return null;
      }
      
      // 업데이트 데이터 준비
      const updateData = this.mapCsvToDb(updates);
      const updateFields = [];
      const updateValues = [];
      
      // 업데이트할 필드만 동적으로 구성
      if (updates['고객명'] !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(updateData.name);
      }
      if (updates['회사명'] !== undefined) {
        updateFields.push('company = ?');
        updateValues.push(updateData.company);
      }
      if (updates['연락처'] !== undefined) {
        updateFields.push('contact = ?');
        updateValues.push(updateData.contact);
      }
      if (updates['이메일'] !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(updateData.email);
      }
      if (updates['초대/현장방문'] !== undefined) {
        updateFields.push('invitation_type = ?');
        updateValues.push(updateData.invitation_type);
      }
      if (updates['체크인'] !== undefined) {
        updateFields.push('checked_in = ?');
        updateValues.push(updateData.checked_in);
      }
      if (updates['체크인시간'] !== undefined) {
        updateFields.push('checkin_time = ?');
        updateValues.push(updateData.checkin_time);
      }
      
      if (updateFields.length === 0) {
        return this.mapDbToCsv(attendee);
      }
      
      // updated_at 추가
      updateFields.push("updated_at = datetime('now', 'localtime')");
      
      // 업데이트 실행
      const updateSQL = `
        UPDATE attendees 
        SET ${updateFields.join(', ')}
        WHERE event_id = ? AND registration_number = ?
      `;
      
      updateValues.push(this.eventId, registrationNumber);
      
      await this.runAsync(updateSQL, updateValues);
      
      // 업데이트된 데이터 반환
      const updatedAttendee = await this.getAsync(
        'SELECT * FROM attendees WHERE event_id = ? AND registration_number = ?',
        [this.eventId, registrationNumber]
      );
      
      return this.mapDbToCsv(updatedAttendee);
    } catch (error) {
      console.error('참석자 업데이트 오류:', error);
      return null;
    }
  }

  async getAttendeeByRegistrationNumber(registrationNumber) {
    try {
      const attendee = await this.getAsync(
        'SELECT * FROM attendees WHERE event_id = ? AND registration_number = ?',
        [this.eventId, registrationNumber]
      );
      
      return attendee ? this.mapDbToCsv(attendee) : null;
    } catch (error) {
      console.error('참석자 조회 오류:', error);
      return null;
    }
  }

  async generateCSV(attendees) {
    try {
      let csvContent = this.csvFields.join(',') + '\n';
      
      attendees.forEach(attendee => {
        const row = this.csvFields.map(field => {
          const value = attendee[field] || '';
          // 쉼표나 줄바꿈이 있으면 큰따옴표로 감싸기
          return value.includes(',') || value.includes('\n') ? `"${value}"` : value;
        }).join(',');
        csvContent += row + '\n';
      });
      
      return csvContent;
    } catch (error) {
      console.error('CSV 생성 오류:', error);
      throw error;
    }
  }

  async parseCSV(csvContent) {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV 파일에 데이터가 없습니다.');
      }
      
      const uploadHeaders = lines[0].split(',').map(h => h.trim());
      
      // 필수 필드 검증
      const missingFields = this.requiredFields.filter(field => 
        !uploadHeaders.includes(field)
      );
      if (missingFields.length > 0) {
        throw new Error(`필수 필드가 누락되었습니다: ${missingFields.join(', ')}`);
      }
      
      const attendees = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 간단한 CSV 파싱 (큰따옴표 처리 포함)
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
        
        const attendee = {};
        uploadHeaders.forEach((header, index) => {
          attendee[header] = values[index] || '';
        });
        
        attendees.push(attendee);
      }
      
      return attendees;
    } catch (error) {
      console.error('CSV 파싱 오류:', error);
      throw error;
    }
  }

  async generateRegistrationNumber() {
    try {
      // 가장 큰 REG 번호 찾기
      const result = await this.getAsync(
        `SELECT registration_number FROM attendees 
         WHERE event_id = ? AND registration_number LIKE 'REG%'
         ORDER BY registration_number DESC
         LIMIT 1`,
        [this.eventId]
      );
      
      let nextNumber = 1;
      if (result && result.registration_number) {
        const match = result.registration_number.match(/REG(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      return `REG${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
      // 오류 시 타임스탬프 방식
      return `R${Date.now()}`;
    }
  }

  validateRequired(attendeeData) {
    const missing = [];
    
    this.requiredFields.forEach(field => {
      if (!attendeeData[field] || attendeeData[field].trim() === '') {
        missing.push(field);
      }
    });
    
    return missing;
  }

  async addAttendee(attendeeData) {
    try {
      // 중복 체크 (이메일 또는 등록번호)
      const duplicate = await this.getAsync(
        `SELECT * FROM attendees 
         WHERE event_id = ? AND (email = ? OR registration_number = ?)`,
        [this.eventId, attendeeData['이메일'], attendeeData['등록번호']]
      );
      
      if (duplicate) {
        if (duplicate.registration_number === attendeeData['등록번호']) {
          throw new Error('이미 존재하는 등록번호입니다.');
        }
        if (duplicate.email === attendeeData['이메일']) {
          throw new Error('이미 존재하는 이메일입니다.');
        }
      }
      
      // DB에 삽입
      const dbData = this.mapCsvToDb(attendeeData);
      const result = await this.runAsync(
        `INSERT INTO attendees (
          event_id, registration_number, name, company, contact, 
          email, invitation_type, checked_in, checkin_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dbData.event_id,
          dbData.registration_number,
          dbData.name,
          dbData.company,
          dbData.contact,
          dbData.email,
          dbData.invitation_type,
          dbData.checked_in,
          dbData.checkin_time
        ]
      );
      
      // 삽입된 데이터 반환
      const newAttendee = await this.getAsync(
        'SELECT * FROM attendees WHERE id = ?',
        [result.lastID]
      );
      
      return this.mapDbToCsv(newAttendee);
    } catch (error) {
      console.error('참석자 추가 오류:', error);
      throw error;
    }
  }

  // 데이터베이스 닫기
  close() {
    if (this.db) {
      this.db.close();
    }
  }

  // 백업을 위한 메소드
  getDb() {
    return this.db;
  }
}

// 싱글톤 인스턴스 생성 및 초기화
const dbService = new DBService();

// 초기화 함수
dbService.initPromise = dbService.init().catch(err => {
  console.error('DB 초기화 실패:', err);
  throw err;
});

module.exports = dbService;