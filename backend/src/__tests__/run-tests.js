#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== SQLite 데이터베이스 개선사항 테스트 ===\n');

// 테스트 환경 설정
process.env.USE_DATABASE = 'true';
process.env.EVENT_ID = 'test-event';
process.env.CSV_FIELDS = '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간';
process.env.CSV_REQUIRED = '등록번호,고객명,회사명,이메일';

const testResults = [];

// 테스트 헬퍼 함수
function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testResults.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
    testResults.push({ name, status: 'FAIL', error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// 테스트 시작
console.log('1. DbService 모듈 로드 테스트');
try {
  const DbService = require('../services/dbService');
  test('DbService 클래스가 존재함', () => {
    assert(typeof DbService === 'function', 'DbService is not a function');
  });
} catch (err) {
  console.log('❌ DbService 모듈을 로드할 수 없습니다:', err.message);
  console.log('\n⚠️  better-sqlite3 설치가 필요합니다.');
  console.log('   다음 명령어를 실행하세요:');
  console.log('   xcode-select --install');
  console.log('   npm install better-sqlite3\n');
  process.exit(1);
}

console.log('\n2. Migration 모듈 테스트');
test('Migration 모듈이 존재함', () => {
  const { Migration } = require('../migrations/migrate');
  assert(typeof Migration === 'function', 'Migration is not a function');
});

test('마이그레이션 SQL 파일이 존재함', () => {
  const sqlPath = path.join(__dirname, '../migrations/001-initial-schema.sql');
  assert(fs.existsSync(sqlPath), 'Migration SQL file not found');
});

console.log('\n3. BackupService 모듈 테스트');
test('BackupService 클래스가 존재함', () => {
  const BackupService = require('../services/backupService');
  assert(typeof BackupService === 'function', 'BackupService is not a function');
});

console.log('\n4. API 라우트 통합 테스트');
test('server.js에서 USE_DATABASE 설정 확인', () => {
  const serverPath = path.join(__dirname, '../server.js');
  const serverCode = fs.readFileSync(serverPath, 'utf-8');
  assert(serverCode.includes('USE_DATABASE'), 'USE_DATABASE not found in server.js');
  assert(serverCode.includes('dbService'), 'dbService not imported in server.js');
});

test('admin 라우트에서 global.dataService 사용 확인', () => {
  const adminPath = path.join(__dirname, '../routes/admin.js');
  const adminCode = fs.readFileSync(adminPath, 'utf-8');
  assert(adminCode.includes('global.dataService'), 'global.dataService not used in admin routes');
});

console.log('\n5. Docker 설정 테스트');
test('Dockerfile에 SQLite 설치 명령 포함', () => {
  const dockerfilePath = path.join(__dirname, '../../../../Dockerfile');
  const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
  assert(dockerfile.includes('sqlite'), 'SQLite not installed in Dockerfile');
  assert(dockerfile.includes('better-sqlite3'), 'better-sqlite3 mentioned in Dockerfile');
});

test('docker-compose.yml에 USE_DATABASE 환경변수 설정', () => {
  const composePath = path.join(__dirname, '../../../../docker-compose.yml');
  const compose = fs.readFileSync(composePath, 'utf-8');
  assert(compose.includes('USE_DATABASE=true'), 'USE_DATABASE not set in docker-compose.yml');
  assert(compose.includes('/backups'), 'Backup volume not mounted');
});

console.log('\n6. package.json 설정 테스트');
test('마이그레이션 스크립트가 추가됨', () => {
  const packagePath = path.join(__dirname, '../../../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  assert(packageJson.scripts.migrate, 'migrate script not found');
  assert(packageJson.scripts['migrate:status'], 'migrate:status script not found');
});

test('필요한 의존성이 추가됨', () => {
  const packagePath = path.join(__dirname, '../../../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  assert(packageJson.dependencies['better-sqlite3'], 'better-sqlite3 not in dependencies');
  assert(packageJson.dependencies['node-cron'], 'node-cron not in dependencies');
});

// 테스트 결과 요약
console.log('\n=== 테스트 결과 요약 ===');
const passCount = testResults.filter(r => r.status === 'PASS').length;
const failCount = testResults.filter(r => r.status === 'FAIL').length;

console.log(`총 테스트: ${testResults.length}`);
console.log(`✅ 성공: ${passCount}`);
console.log(`❌ 실패: ${failCount}`);

if (failCount === 0) {
  console.log('\n🎉 모든 구조적 테스트가 통과했습니다!');
  console.log('\n다음 단계:');
  console.log('1. better-sqlite3 설치: npm install better-sqlite3');
  console.log('2. 마이그레이션 실행: npm run migrate');
  console.log('3. 서버 시작: npm start (또는 docker-compose up)');
} else {
  console.log('\n⚠️  일부 테스트가 실패했습니다.');
  process.exit(1);
}