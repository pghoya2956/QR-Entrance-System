const fs = require('fs').promises;
const path = require('path');

// 환경변수에서 이벤트 설정 읽기
const EVENT_ID = process.env.EVENT_ID || 'default-event';
const CSV_FIELDS = process.env.CSV_FIELDS || '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간';
const CSV_REQUIRED = process.env.CSV_REQUIRED || '등록번호,고객명,회사명,이메일';

class CSVService {
  constructor() {
    // 동적 CSV 경로 설정
    this.csvPath = path.join(__dirname, `../data/${EVENT_ID}/attendees.csv`);
    this.dataDir = path.join(__dirname, `../data/${EVENT_ID}`);
    
    // CSV 헤더 설정
    this.headers = CSV_FIELDS.split(',').map(field => field.trim());
    this.requiredFields = CSV_REQUIRED.split(',').map(field => field.trim());
    
    // 데이터 디렉토리 생성
    this.ensureDataDirectory();
  }
  
  async ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // CSV 파일이 없으면 헤더만 있는 빈 파일 생성
      try {
        await fs.access(this.csvPath);
      } catch {
        await fs.writeFile(this.csvPath, this.headers.join(',') + '\n', 'utf8');
        console.log(`✅ CSV 파일 생성됨: ${this.csvPath}`);
      }
    } catch (error) {
      console.error('데이터 디렉토리 생성 오류:', error);
    }
  }
  async readAttendees() {
    try {
      const data = await fs.readFile(this.csvPath, 'utf8');
      const lines = data.trim().split('\n');
      if (lines.length < 1) return [];
      
      const fileHeaders = lines[0].split(',').map(h => h.trim());
      const attendees = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const attendee = {};
        fileHeaders.forEach((header, index) => {
          attendee[header] = values[index] || '';
        });
        attendees.push(attendee);
      }
      return attendees;
    } catch (error) {
      console.error('CSV 파일 읽기 오류:', error);
      return [];
    }
  }

  async writeAttendees(attendees) {
    try {
      let csvContent = this.headers.join(',') + '\n';
      
      attendees.forEach(attendee => {
        const row = this.headers.map(header => {
          const value = attendee[header] || '';
          // 쉼표나 줄바꿈이 있으면 큰따옴표로 감싸기
          return value.includes(',') || value.includes('\n') ? `"${value}"` : value;
        }).join(',');
        csvContent += row + '\n';
      });
      
      await fs.writeFile(this.csvPath, csvContent, 'utf8');
      return true;
    } catch (error) {
      console.error('CSV 파일 쓰기 오류:', error);
      return false;
    }
  }

  async updateAttendee(registrationNumber, updates) {
    try {
      const attendees = await this.readAttendees();
      const index = attendees.findIndex(a => a['등록번호'] === registrationNumber);
      
      if (index !== -1) {
        attendees[index] = { ...attendees[index], ...updates };
        await this.writeAttendees(attendees);
        return attendees[index];
      }
      return null;
    } catch (error) {
      console.error('참석자 업데이트 오류:', error);
      return null;
    }
  }

  async getAttendeeByRegistrationNumber(registrationNumber) {
    const attendees = await this.readAttendees();
    return attendees.find(a => a['등록번호'] === registrationNumber);
  }

  async generateCSV(attendees) {
    try {
      let csvContent = this.headers.join(',') + '\n';
      
      attendees.forEach(attendee => {
        const row = this.headers.map(header => {
          const value = attendee[header] || '';
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

  // 등록번호 자동 생성
  async generateRegistrationNumber() {
    try {
      const attendees = await this.readAttendees();
      
      // 기존 등록번호들 추출
      const existingNumbers = attendees.map(a => a['등록번호']);
      
      // 숫자형 등록번호만 필터링 (예: 1001, 1002)
      const numericNumbers = existingNumbers
        .filter(num => /^\d+$/.test(num))
        .map(num => parseInt(num));
      
      if (numericNumbers.length > 0) {
        // 가장 큰 번호 + 1
        const maxNumber = Math.max(...numericNumbers);
        return String(maxNumber + 1);
      } else {
        // 숫자형 등록번호가 없으면 타임스탬프 방식
        return `R${Date.now()}`;
      }
    } catch (error) {
      // 파일이 없거나 읽기 실패 시 타임스탬프 방식
      return `R${Date.now()}`;
    }
  }

  // 필수 필드 검증
  validateRequired(attendeeData) {
    const missing = [];
    
    this.requiredFields.forEach(field => {
      if (!attendeeData[field] || attendeeData[field].trim() === '') {
        missing.push(field);
      }
    });
    
    return missing;
  }

  // 참가자 추가
  async addAttendee(attendeeData) {
    const attendees = await this.readAttendees();
    
    // 중복 체크 (이메일 또는 등록번호)
    const duplicate = attendees.find(a => 
      (attendeeData['이메일'] && a['이메일'] === attendeeData['이메일']) ||
      (attendeeData['등록번호'] && a['등록번호'] === attendeeData['등록번호'])
    );
    
    if (duplicate) {
      const field = duplicate['이메일'] === attendeeData['이메일'] ? '이메일' : '등록번호';
      throw new Error(`중복된 ${field}입니다: ${duplicate['고객명'] || duplicate['이메일']}`);
    }
    
    // CSV 형식에 맞게 데이터 정렬
    const orderedData = {};
    this.headers.forEach(header => {
      orderedData[header] = attendeeData[header] || '';
    });
    
    attendees.push(orderedData);
    await this.writeAttendees(attendees);
    
    return orderedData;
  }

  // CSV 행을 문자열로 변환 (쉼표와 줄바꿈 처리)
  attendeeToCSVRow(attendee) {
    return this.headers.map(header => {
      const value = attendee[header] || '';
      // 쉼표, 줄바꿈, 큰따옴표가 있으면 큰따옴표로 감싸기
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  }
}

module.exports = new CSVService();