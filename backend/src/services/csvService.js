const fs = require('fs').promises;
const path = require('path');

const CSV_PATH = path.join(__dirname, '../data/attendees.csv');

class CSVService {
  async readAttendees() {
    try {
      const data = await fs.readFile(CSV_PATH, 'utf8');
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',');
      
      const attendees = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const attendee = {};
        headers.forEach((header, index) => {
          attendee[header] = values[index];
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
      const headers = ['등록번호', '고객명', '회사명', '연락처', '이메일', '초대/현장방문', '체크인', '체크인시간'];
      let csvContent = headers.join(',') + '\n';
      
      attendees.forEach(attendee => {
        const row = headers.map(header => attendee[header] || '').join(',');
        csvContent += row + '\n';
      });
      
      await fs.writeFile(CSV_PATH, csvContent, 'utf8');
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
      const headers = ['등록번호', '고객명', '회사명', '연락처', '이메일', '초대/현장방문', '체크인', '체크인시간'];
      let csvContent = headers.join(',') + '\n';
      
      attendees.forEach(attendee => {
        const row = headers.map(header => {
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
      
      const headers = lines[0].split(',').map(h => h.trim());
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
        headers.forEach((header, index) => {
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
}

module.exports = new CSVService();