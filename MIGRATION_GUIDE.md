# SQLite 데이터베이스 마이그레이션 가이드

## 개요

이 가이드는 기존 CSV 기반 시스템을 SQLite 데이터베이스로 마이그레이션하는 방법을 설명합니다.

## 사전 준비사항

### 1. 백업 생성
```bash
# 전체 data 디렉토리 백업
cp -r backend/src/data backend/src/data.backup
```

### 2. 의존성 설치
```bash
# better-sqlite3 설치 (macOS의 경우 XCode Command Line Tools 필요)
xcode-select --install  # macOS only
npm install
```

## 마이그레이션 단계

### 1단계: 환경 변수 확인

`.env` 파일에서 다음 설정 확인:
```env
USE_DATABASE=true
BACKUP_ON_START=false
```

### 2단계: 마이그레이션 실행

```bash
# 마이그레이션 상태 확인
npm run migrate:status

# 마이그레이션 실행
npm run migrate
```

마이그레이션 스크립트는 다음 작업을 수행합니다:
1. SQLite 데이터베이스 생성 (`backend/src/data/attendees.db`)
2. 테이블 스키마 생성
3. 모든 이벤트의 CSV 데이터를 데이터베이스로 이전
4. 인덱스 생성 및 최적화

### 3단계: 데이터 검증

```bash
# SQLite CLI로 데이터 확인
sqlite3 backend/src/data/attendees.db

# SQL 명령어 예시
.tables
SELECT COUNT(*) FROM attendees;
SELECT * FROM attendees WHERE event_id = 'tech-conference-2025' LIMIT 5;
.quit
```

### 4단계: 서버 재시작

```bash
# 로컬 환경
npm start

# Docker 환경
docker-compose down
docker-compose up -d
```

## 백업 시스템 활성화

### 자동 백업 설정

서버가 시작되면 자동으로 백업 스케줄이 활성화됩니다:
- **백업 주기**: 매일 새벽 2시
- **백업 위치**: `backend/src/data/backups/`
- **보관 기간**: 30일
- **압축 형식**: gzip

### 수동 백업

```bash
# API를 통한 수동 백업
curl -X POST http://localhost:3000/api/admin/backup
```

## 롤백 방법

문제가 발생한 경우 CSV 모드로 롤백:

### 1. 환경 변수 변경
```env
USE_DATABASE=false
```

### 2. 서버 재시작
```bash
npm start
# 또는
docker-compose restart backend-event1 backend-event2
```

## 하이브리드 운영

CSV와 데이터베이스를 동시에 사용할 수 있습니다:

### CSV 내보내기
```bash
# API 엔드포인트
GET /api/admin/export-csv
```

### CSV 가져오기
```bash
# API 엔드포인트
POST /api/admin/import-csv
```

## 문제 해결

### 1. better-sqlite3 설치 실패

**macOS**:
```bash
xcode-select --install
npm install better-sqlite3
```

**Linux**:
```bash
sudo apt-get install build-essential python3
npm install better-sqlite3
```

### 2. 권한 문제

```bash
# 데이터 디렉토리 권한 설정
chmod 755 backend/src/data
chmod 644 backend/src/data/attendees.db
```

### 3. 마이그레이션 실패

```bash
# 데이터베이스 삭제 후 재시도
rm backend/src/data/attendees.db
npm run migrate
```

## 성능 최적화

### WAL 모드 활성화
데이터베이스는 자동으로 WAL(Write-Ahead Logging) 모드로 설정됩니다:
- 읽기/쓰기 동시성 향상
- 크래시 복구 개선
- 성능 향상

### 인덱스
자동으로 생성되는 인덱스:
- `idx_attendees_event_checkin`: 이벤트별 체크인 조회 최적화
- `idx_attendees_checkin_time`: 체크인 시간 기반 조회 최적화

## 모니터링

### 데이터베이스 상태 확인
```bash
# 파일 크기
ls -lh backend/src/data/attendees.db

# 테이블 통계
sqlite3 backend/src/data/attendees.db "SELECT event_id, COUNT(*) FROM attendees GROUP BY event_id;"
```

### 백업 상태 확인
```bash
# API 엔드포인트
GET /api/admin/backups

# 파일 시스템
ls -la backend/src/data/backups/
```

## 주의사항

1. **다운타임**: 마이그레이션 중 약 1-2분의 다운타임 발생 가능
2. **저장 공간**: 데이터베이스는 CSV보다 약 20-30% 더 많은 공간 사용
3. **백업**: 매일 백업으로 인해 추가 저장 공간 필요 (30일분)
4. **호환성**: USE_DATABASE=false로 언제든 CSV 모드로 전환 가능