# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

QR 코드 기반 행사 입장 관리 시스템 (v2.0)
- **백엔드**: Node.js/Express, JWT 기반 QR 생성, CSV 데이터 저장
- **프론트엔드**: 바닐라 JavaScript, html5-qrcode 라이브러리
- **아키텍처**: Docker Compose 기반 멀티 이벤트 지원 (포트 3001-3010)

## 주요 개발 명령어

### 개발 환경
```bash
# 멀티 이벤트 개발 환경 시작
./scripts/start-dev.sh

# 단일 이벤트 개발 (nodemon)
npm run dev

# 테스트 실행
npm test

# 특정 테스트 실행
npx playwright test tests/e2e/multi-event/backend-discovery.spec.js

# UI 모드 테스트
npx playwright test --ui

# Playwright 브라우저 설치 (최초 1회)
npx playwright install chromium
```

## 아키텍처 핵심 구조

### 백엔드 구조
- **진입점**: `backend/src/server.js`
- **라우트**:
  - `/api/info` - 이벤트 정보
  - `/api/qr/generate` - QR 생성 (미구현)
  - `/api/checkin/verify` - 체크인 검증
  - `/api/admin/*` - 관리자 기능
- **데이터**: `backend/src/data/[EVENT_ID]/attendees.csv`
- **QR 형식**: `CHECKIN:등록번호` (예: `CHECKIN:REG001`)

### 프론트엔드 구조
- **페이지**:
  - `index.html` - 대시보드
  - `scanner.html` - QR 스캐너
  - `attendees.html` - 참석자 관리
- **핵심 모듈**:
  - `common.js` - 백엔드 디스커버리, API 호출
  - `scanner.js` - 백엔드 연결 대기 후 스캐너 시작
  - `attendees.js` - QR 생성 UI, 체크인 토글

### 멀티 이벤트 동작
1. 프론트엔드가 포트 3001-3010 스캔하여 활성 백엔드 감지
2. 이벤트 선택 시 localStorage에 포트 저장
3. attendees.html과 index.html은 페이지 새로고침 없이 데이터만 로드
4. scanner.html은 이벤트 전환 시 페이지 새로고침

## 최근 개선사항 (2025-07-17)

### 구현 완료
- ✅ **QR 코드 생성 UI**: 모달 팝업, 다운로드 기능
- ✅ **체크인 토글**: 전역 함수 노출로 onclick 이벤트 해결
- ✅ **이벤트 전환**: 페이지별 차별화된 새로고침 전략
- ✅ **스캐너 초기화**: 백엔드 연결 완료 후 UI 활성화

### 테스트 현황
- **총 57개 중 36개 통과 (63.2%)**
- **주요 실패 원인**:
  1. QR 생성 API 미구현 (`/api/qr/generate`)
  2. 테스트 데이터 격리 문제 (CSV 공유)
  3. 이벤트 전환 동작 불일치
  4. 보안 테스트 응답 코드 차이 (401 vs 400)

## 주의사항

### 테스트 작성 시
- 헬퍼 함수 사용: `selectBackendAndLoadData(page, port, pageType)`
- 페이지 타입에 따른 네비게이션 처리 차이 고려
- QR 형식은 `CHECKIN:등록번호` 사용

### API 응답 구조
```javascript
// 성공 응답
{ success: true, attendeeInfo: { name, company, registrationNumber } }

// 409 에러 (중복 체크인)
{ error: "이미 체크인된 참석자입니다.", attendeeInfo: { ... } }

// 기타 에러
{ error: "에러 메시지" }
```

### 환경 설정
```env
JWT_SECRET=qr-entrance-secret-key-2025
EVENT_ID=이벤트ID
EVENT_NAME=이벤트명
CSV_FIELDS=등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
```

## 향후 작업

1. **필수 구현**: QR 생성 API (`/api/qr/generate`)
2. **테스트 개선**: 데이터 격리, beforeEach 초기화
3. **보안 강화**: Rate limiting, 입력값 검증