/**
 * 테스트 데이터 및 QR 코드 생성기
 * CSV 파일에서 데이터를 읽어 QR 코드 이미지 생성
 */

import QRCode from 'qrcode';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

/**
 * SQLite 데이터베이스 연결 및 초기화
 */
async function getTestDatabase() {
  // 프로젝트 루트 경로 계산
  const projectRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '../../..');
  const dbPath = path.join(projectRoot, 'backend/src/data/attendees.db');
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // 테이블 생성 (존재하지 않을 경우)
  await db.exec(`
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
    )
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, 
      name TEXT NOT NULL, 
      description TEXT, 
      created_at TEXT DEFAULT (datetime('now', 'localtime')), 
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);
  
  return db;
}

/**
 * 필드 기본값 제공
 */
function provideDefaults(record) {
  return {
    registration_number: record['등록번호'] || '',
    name: record['고객명'] || '미확인',
    company: record['회사명'] || '소속없음',
    email: record['이메일'] || `${record['등록번호']}@test.com`,
    contact: record['연락처'] || '010-0000-0000',
    invitation_type: record['참가유형'] || '일반',
    checked_in: 0,
    checkin_time: null
  };
}

/**
 * 테스트용 CSV 데이터 생성 및 DB 삽입
 */
export async function generateTestCSV() {
  // CSV 데이터 정의 (빈 필드 보완)
  const testDataEvent1 = `등록번호,고객명,회사명,이메일,연락처,참가유형
REG001,김철수,테크코프,kim@techcorp.com,010-1234-5678,VIP
REG002,이영희,스타트업A,lee@startup.com,010-2345-6789,일반
REG003,박민수,개발회사B,park@devcom.com,010-3456-7890,일반
REG004,정수진,디자인스튜디오,jung@design.com,010-4567-8901,학생
REG005,최동현,프리랜서,choi@email.com,010-5678-9012,일반`;

  const testDataEvent2 = `등록번호,고객명,회사명,이메일,연락처,참가유형
STU001,강민지,스타트업X,kang@startupx.com,010-1111-2222,일반
STU002,조현우,벤처Y,cho@venturey.com,010-3333-4444,VIP
STU003,윤서연,테크Z,yoon@techz.com,010-5555-6666,학생`;

  // 이벤트1 테스트 데이터
  const fixturesDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });
  
  const event1Path = path.join(fixturesDir, 'test-data-event1.csv');
  await fs.writeFile(event1Path, testDataEvent1, 'utf-8');
  
  // 이벤트2 테스트 데이터
  const event2Path = path.join(fixturesDir, 'test-data-event2.csv');
  await fs.writeFile(event2Path, testDataEvent2, 'utf-8');
  
  console.log('✅ 테스트 CSV 파일 생성 완료');
  
  // SQLite 데이터베이스에 데이터 삽입
  const db = await getTestDatabase();
  
  try {
    // 기존 테스트 데이터 삭제
    await db.run("DELETE FROM attendees WHERE event_id IN ('tech-conference-2025', 'startup-meetup-2025')");
    await db.run("DELETE FROM events WHERE id IN ('tech-conference-2025', 'startup-meetup-2025')");
    
    // 이벤트 정보 삽입
    await db.run(`
      INSERT INTO events (id, name, description)
      VALUES (?, ?, ?)
    `, ['tech-conference-2025', '테크 컨퍼런스 2025', '기술 혁신 컨퍼런스 - 2025년 8월 20일, 코엑스']);
    
    await db.run(`
      INSERT INTO events (id, name, description)
      VALUES (?, ?, ?)
    `, ['startup-meetup-2025', '스타트업 밋업 2025', '스타트업 네트워킹 이벤트 - 2025년 9월 15일, 구글 캠퍼스']);
    
    // Event 1 데이터 파싱 및 삽입
    const event1Records = parse(testDataEvent1, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    for (const record of event1Records) {
      const data = provideDefaults(record);
      await db.run(`
        INSERT INTO attendees (event_id, registration_number, name, company, contact, email, invitation_type, checked_in, checkin_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'tech-conference-2025',
        data.registration_number,
        data.name,
        data.company,
        data.contact,
        data.email,
        data.invitation_type,
        data.checked_in,
        data.checkin_time
      ]);
    }
    
    // Event 2 데이터 파싱 및 삽입
    const event2Records = parse(testDataEvent2, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    for (const record of event2Records) {
      const data = provideDefaults(record);
      await db.run(`
        INSERT INTO attendees (event_id, registration_number, name, company, contact, email, invitation_type, checked_in, checkin_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'startup-meetup-2025',
        data.registration_number,
        data.name,
        data.company,
        data.contact,
        data.email,
        data.invitation_type,
        data.checked_in,
        data.checkin_time
      ]);
    }
    
    console.log('✅ 테스트 데이터 SQLite DB 삽입 완료');
    
  } finally {
    await db.close();
  }
  
  return { event1Path, event2Path };
}

/**
 * CSV 파일에서 QR 코드 이미지 생성
 */
export async function generateQRCodesFromCSV(csvPath, outputDir) {
  try {
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    
    // CSV 파싱 옵션 개선
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // 컬럼 수 불일치 허용
      skip_records_with_error: true // 에러 있는 레코드 건너뛰기
    });
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const qrFiles = [];
    const errors = [];
    
    for (const record of records) {
      try {
        // 필수 필드 검증
        const registrationNumber = record['등록번호'];
        const name = record['고객명'];
        
        if (!registrationNumber || !name) {
          errors.push({
            record,
            error: '등록번호 또는 고객명이 누락됨'
          });
          continue;
        }
        
        // QR 데이터 형식: 등록번호:고객명
        const qrData = `${registrationNumber.trim()}:${name.trim()}`;
        const fileName = `${registrationNumber.trim()}.png`;
        const filePath = path.join(outputDir, fileName);
        
        // QR 코드 생성
        await QRCode.toFile(filePath, qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        qrFiles.push({
          registrationId: registrationNumber.trim(),
          name: name.trim(),
          filePath: filePath,
          fileName: fileName,
          data: qrData
        });
        
      } catch (recordError) {
        errors.push({
          record,
          error: recordError.message
        });
      }
    }
    
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length}개의 레코드에서 오류 발생:`, errors);
    }
    
    console.log(`✅ ${qrFiles.length}개의 QR 코드 생성 완료: ${outputDir}`);
    
    return qrFiles;
    
  } catch (error) {
    console.error('CSV 파싱 또는 QR 코드 생성 중 오류:', error);
    throw error;
  }
}

/**
 * 특수 테스트용 QR 코드 생성
 */
export async function generateSpecialTestQRCodes(outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  
  const specialCases = [
    {
      name: 'invalid-format',
      data: 'INVALID_QR_FORMAT',
      description: '잘못된 형식의 QR 코드'
    },
    {
      name: 'sql-injection',
      data: "REG001':DROP TABLE attendees;--",
      description: 'SQL 인젝션 시도'
    },
    {
      name: 'xss-attempt',
      data: 'REG001:<script>alert("XSS")</script>',
      description: 'XSS 공격 시도'
    },
    {
      name: 'unregistered',
      data: 'REG999:미등록자',
      description: '등록되지 않은 참석자'
    },
    {
      name: 'empty-data',
      data: ' ', // QRCode 라이브러리가 빈 문자열을 처리하지 못하므로 공백 사용
      description: '빈 데이터'
    }
  ];
  
  const specialQRFiles = [];
  
  for (const testCase of specialCases) {
    const filePath = path.join(outputDir, `${testCase.name}.png`);
    
    await QRCode.toFile(filePath, testCase.data, {
      width: 300,
      margin: 2
    });
    
    specialQRFiles.push({
      ...testCase,
      filePath
    });
  }
  
  console.log(`✅ ${specialQRFiles.length}개의 특수 테스트 QR 코드 생성 완료`);
  
  return specialQRFiles;
}

/**
 * 모든 테스트 데이터 초기화
 */
export async function initializeTestData() {
  console.log('테스트 데이터 초기화 중...');
  
  // CSV 파일 생성
  const { event1Path, event2Path } = await generateTestCSV();
  
  // 정상 QR 코드 생성
  const fixturesRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '../../fixtures');
  
  const event1QRs = await generateQRCodesFromCSV(
    event1Path,
    path.join(fixturesRoot, 'test-qr-codes/event1')
  );
  
  const event2QRs = await generateQRCodesFromCSV(
    event2Path,
    path.join(fixturesRoot, 'test-qr-codes/event2')
  );
  
  // 특수 테스트 QR 코드 생성
  const specialQRs = await generateSpecialTestQRCodes(
    path.join(fixturesRoot, 'test-qr-codes/special')
  );
  
  console.log('✅ 모든 테스트 데이터 초기화 완료');
  
  return {
    csvFiles: { event1Path, event2Path },
    qrCodes: {
      event1: event1QRs,
      event2: event2QRs,
      special: specialQRs
    }
  };
}