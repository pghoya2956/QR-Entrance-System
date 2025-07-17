/**
 * 테스트 데이터 및 QR 코드 생성기
 * CSV 파일에서 데이터를 읽어 QR 코드 이미지 생성
 */

import QRCode from 'qrcode';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';

/**
 * 테스트용 CSV 데이터 생성
 */
export async function generateTestCSV() {
  const testDataEvent1 = `등록번호,고객명,회사명,이메일,연락처,참가유형
REG001,김철수,테크코프,kim@techcorp.com,010-1234-5678,VIP
REG002,이영희,스타트업A,lee@startup.com,010-2345-6789,일반
REG003,박민수,개발회사B,park@devcom.com,010-3456-7890,일반
REG004,정수진,디자인스튜디오,jung@design.com,010-4567-8901,학생
REG005,최동현,프리랜서,,choi@email.com,010-5678-9012,일반`;

  const testDataEvent2 = `등록번호,고객명,회사명,이메일
STU001,강민지,스타트업X,kang@startupx.com
STU002,조현우,벤처Y,cho@venturey.com
STU003,윤서연,테크Z,yoon@techz.com`;

  // 이벤트1 테스트 데이터
  const event1Path = path.join(process.cwd(), 'tests/fixtures/test-data-event1.csv');
  await fs.writeFile(event1Path, testDataEvent1, 'utf-8');
  
  // 이벤트2 테스트 데이터
  const event2Path = path.join(process.cwd(), 'tests/fixtures/test-data-event2.csv');
  await fs.writeFile(event2Path, testDataEvent2, 'utf-8');
  
  console.log('✅ 테스트 CSV 파일 생성 완료');
  
  return { event1Path, event2Path };
}

/**
 * CSV 파일에서 QR 코드 이미지 생성
 */
export async function generateQRCodesFromCSV(csvPath, outputDir) {
  const csvContent = await fs.readFile(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  await fs.mkdir(outputDir, { recursive: true });
  
  const qrFiles = [];
  
  for (const record of records) {
    // QR 데이터 형식: 등록번호:고객명
    const qrData = `${record['등록번호']}:${record['고객명']}`;
    const fileName = `${record['등록번호']}.png`;
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
      registrationId: record['등록번호'],
      name: record['고객명'],
      filePath: filePath,
      fileName: fileName,
      data: qrData
    });
  }
  
  console.log(`✅ ${qrFiles.length}개의 QR 코드 생성 완료: ${outputDir}`);
  
  return qrFiles;
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
      data: '',
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
  const event1QRs = await generateQRCodesFromCSV(
    event1Path,
    path.join(process.cwd(), 'tests/fixtures/test-qr-codes/event1')
  );
  
  const event2QRs = await generateQRCodesFromCSV(
    event2Path,
    path.join(process.cwd(), 'tests/fixtures/test-qr-codes/event2')
  );
  
  // 특수 테스트 QR 코드 생성
  const specialQRs = await generateSpecialTestQRCodes(
    path.join(process.cwd(), 'tests/fixtures/test-qr-codes/special')
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