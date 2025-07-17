# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

QR 코드 기반 행사 입장 관리 시스템입니다. Node.js/Express 백엔드와 바닐라 JavaScript 프론트엔드로 구성되어 있으며, CSV 파일 기반 데이터 저장을 사용합니다.

**v2.0 업데이트**: 멀티 이벤트 지원 추가
- 각 이벤트는 독립적인 Docker 컨테이너로 실행
- 프론트엔드/백엔드 분리 아키텍처
- 이벤트별 유연한 CSV 형식 지원

## 주요 개발 명령어

### 단일 이벤트 모드
```bash
# 개발 서버 실행 (nodemon 사용)
npm run dev

# 프로덕션 서버 실행
npm start
```

### 멀티 이벤트 모드 (v2.0)
```bash
# 개발 환경 시작
./scripts/start-dev.sh

# 프로덕션 환경 시작
./scripts/start-prod.sh

# 새 이벤트 추가
./scripts/add-event.sh

# Docker 상태 확인
docker-compose ps
docker-compose logs -f [서비스명]
```

### 테스트
```bash
# 테스트 실행 (Playwright)
npm test

# Playwright 브라우저 설치 (최초 1회)
npx playwright install chromium

# 특정 테스트 파일 실행
npx playwright test tests/e2e/multi-event/backend-discovery.spec.js

# UI 모드로 테스트 실행
npx playwright test --ui

# 디버그 모드
npx playwright test --debug

# 테스트 리포트 보기
npx playwright show-report
```

## 아키텍처 구조

### 백엔드 (Express.js)
- **진입점**: `backend/src/server.js`
- **라우트 구조**:
  - `/api/info` - 이벤트 정보 조회 (v2.0 신규)
  - `/api/qr/*` - QR 코드 생성 관련 (JWT 토큰 기반)
  - `/api/checkin/*` - 체크인 처리 및 검증
  - `/api/admin/*` - 참석자 관리 및 통계
- **데이터 저장**: 
  - v1.0: 고정 경로 (`backend/src/data/attendees.csv`)
  - v2.0: 이벤트별 경로 (`backend/src/data/[EVENT_ID]/attendees.csv`)
- **서비스 계층**: 
  - `csvService.js` - 동적 CSV 경로 및 스키마 지원
  - `qrService.js` - QR 코드 생성

### 프론트엔드 (Vanilla JS)
- **페이지 구조**:
  - `index.html` - 메인 대시보드 (통합 뷰)
  - `scanner.html` - QR 스캐너 전용 페이지
  - `attendees.html` - 참석자 관리 페이지
- **JavaScript 모듈**:
  - `common.js` - 공통 API 함수 및 유틸리티
    - 멀티 백엔드 디스커버리 (포트 3001-3010)
    - 동적 API URL 생성
    - 이벤트 선택기 UI
  - `scanner.js` - QR 스캔 로직
  - `attendees.js` - 참석자 관리 로직
  - `audio-feedback.js` - 오디오 피드백 처리
- **라이브러리**: 
  - html5-qrcode - QR 코드 스캔
  - QRCode.js - QR 코드 생성

### 데이터 형식
CSV 파일 구조:
```
등록번호,고객명,이메일,체크인,체크인시간
```

## 개발 시 주의사항

1. **UTF-8 인코딩**: 모든 파일은 UTF-8로 작성되어야 합니다
2. **한글 응답**: 사용자와의 모든 대화는 한글로 진행합니다
3. **JWT 토큰**: QR 코드 생성 시 JWT_SECRET 환경변수 사용
4. **오프라인 지원**: 로컬 스토리지를 활용한 오프라인 체크인 대기열 구현
5. **실시간 동기화**: 현재는 수동 동기화만 지원 (향후 WebSocket 고려)
6. **멀티 이벤트 모드 (v2.0)**:
   - 프론트엔드와 백엔드는 분리 배포
   - 백엔드 포트 범위: 3001-3010
   - 이벤트별 독립적인 데이터 디렉토리
   - CORS 설정 필수

## 환경 설정

### 단일 이벤트 모드
`.env` 파일 필수 설정:
```
PORT=3000
JWT_SECRET=qr-entrance-secret-key-2025
```

### 멀티 이벤트 모드 (v2.0)
Docker Compose 환경변수:
```
PORT=3001-3010
EVENT_ID=이벤트-식별자
EVENT_NAME=이벤트 표시 이름
CSV_FIELDS=필드1,필드2,필드3,...
CSV_REQUIRED=필수필드1,필수필드2,...
JWT_SECRET=qr-entrance-secret-key-2025
```

## 테스트 구조 (v2.1 업데이트)

### E2E 테스트 (Playwright)
- **테스트 구조**:
  ```
  tests/
  ├── e2e/
  │   ├── helpers/
  │   │   └── common.js - 공통 테스트 유틸리티 및 셀렉터 정의
  │   ├── setup/
  │   │   ├── docker-health-check.js - Docker 서비스 준비 상태 확인
  │   │   └── test-data-generator.js - 테스트 데이터 및 QR 이미지 생성
  │   ├── multi-event/
  │   │   ├── backend-discovery.spec.js - 백엔드 자동 감지 테스트
  │   │   └── event-switching.spec.js - 이벤트 전환 기능 테스트
  │   ├── checkin/
  │   │   ├── qr-generation.spec.js - QR 코드 생성 테스트
  │   │   ├── qr-scanning.spec.js - QR 스캔 및 체크인 테스트
  │   │   └── duplicate-checkin.spec.js - 중복 체크인 방지 테스트
  │   ├── admin/
  │   │   └── attendee-management.spec.js - 참석자 관리 기능 테스트
  │   └── security/
  │       ├── input-validation.spec.js - 입력 검증 및 인젝션 방지 테스트
  │       └── api-access.spec.js - API 접근 제어 테스트
  └── fixtures/
      └── test-qr-codes/ - 테스트용 QR 코드 이미지
  ```

### 공통 테스트 유틸리티
- `tests/e2e/helpers/common.js` - 공통 헬퍼 함수 및 셀렉터 정의
- Page Object Model 패턴 부분 적용
- 백엔드 선택 및 데이터 로드 자동화

### 명명 규칙
- DOM 요소 ID: camelCase (예: attendeesTableBody, searchBox)
- 데이터 속성: kebab-case (예: data-filter)
- 테스트 셀렉터: 실제 DOM 구조와 일치
- API 응답: flat 구조 유지 (nested 구조 사용 안함)

### 타입 정의
- JSDoc 주석으로 타입 안전성 확보
- API 응답 구조 명시:
  ```javascript
  /**
   * @typedef {Object} StatsResponse
   * @property {number} total
   * @property {number} checkedIn
   * @property {number} notCheckedIn
   * @property {string} checkedInPercentage
   */
  ```
- 문자열 타입 체크인 상태 ("true"/"false")

- **테스트 실행 전 준비사항**:
  1. Docker와 Docker Compose 설치 필요
  2. `npx playwright install chromium` 실행
  3. `docker-compose.yml`에 헬스체크 설정됨

- **주요 테스트 시나리오**:
  - 멀티 백엔드 디스커버리 (포트 3001-3010 스캔)
  - QR 체크인 전체 플로우
  - 보안 테스트 (SQL 인젝션, XSS, 잘못된 형식)
  - 이벤트간 데이터 독립성
  - CSV 업로드/다운로드

## 요구사항 문서

- 상세한 기능 요구사항: `requirements/2025-07-15-2319-qr-scanner-participant-pages/06-requirements-spec.md`
- 테스트 계획 명세: `requirements/2025-07-16-0015-test-plan/06-requirements-spec.md`

## 테스트 개선 현황 (2025-07-16)

### 개선 완료 사항
1. **백엔드 컨텍스트 문제 해결**
   - 헬퍼 함수들이 포트 매개변수를 직접 받도록 수정
   - `getApiUrl` 의존성 제거로 "No backend selected" 오류 해결

2. **QR 코드 형식 통일**
   - 형식: `CHECKIN:등록번호` (예: `CHECKIN:REG001`)
   - 백엔드 regex 수정으로 알파벳-숫자 조합 지원
   - 모든 테스트 파일의 QR 형식 업데이트

3. **API 응답 구조 정리**
   - 성공 응답: `attendeeInfo` 사용 (~~attendee~~)
   - 에러 응답: `success` 필드 없음, `error` 필드만 존재
   - 409 응답: `error` + `attendeeInfo` 포함

4. **테스트 셀렉터 수정**
   - CSV 업로드: `#csvUpload` → `#csvFile`
   - `getCurrentBackend`: localStorage 기반으로 변경

### 테스트 현황 (2025-07-17 업데이트)
- **총 테스트**: 57개
- **통과**: 36개 (63.2%)
- **실패**: 17개
- **스킵**: 4개

### 추가 개선 사항 (2025-07-17)

1. **구현 완료 기능**
   - ✅ QR 코드 생성 UI 구현 (attendees.html)
     - QR 생성 버튼 및 모달 UI 추가
     - QR 코드 다운로드 기능 구현
   - ✅ 체크인 토글 기능 수정
     - 전역 스코프 노출로 인라인 onclick 이벤트 해결
   - ✅ 이벤트 전환 시 자동 데이터 로드
     - attendees.html과 index.html에서 페이지 리로드 대신 데이터만 새로고침
   - ✅ 스캐너 페이지 초기화 개선
     - 백엔드 연결 대기 후 UI 활성화

2. **테스트 개선**
   - 페이지별 네비게이션 처리 로직 개선
   - 보안 테스트 기대값 수정

### 향후 개선 계획

1. **미구현 기능 개발**
   - QR 코드 생성 API 구현 (/api/qr/generate)
   - 참석자 편집 기능

2. **테스트 안정성 개선**
   - 테스트 간 데이터 격리
   - 테스트 실행 순서 의존성 제거
   - 백엔드 상태 초기화 자동화

3. **보안 기능 강화**
   - Rate limiting 구현
   - API 인증/인가 시스템
   - 입력값 길이 제한

4. **리팩토링**
   - Page Object Model 완전 적용
   - 테스트 데이터 관리 개선
   - 공통 테스트 시나리오 추상화

### 주요 테스트 실패 원인 분석

1. **QR 코드 생성 API 미구현** (4개 테스트)
   - `/api/qr/generate` 엔드포인트가 구현되지 않음
   - 실제 QR 코드 생성 로직 필요

2. **테스트 데이터 격리 문제** (5개 테스트)
   - 테스트 간 데이터가 공유되어 중복 체크인 발생
   - CSV 파일 초기화가 일관되지 않음

3. **이벤트 전환 로직 차이** (4개 테스트)
   - 일부 테스트는 페이지 리로드를 기대하지만 실제로는 데이터만 새로고침

4. **스캐너 페이지 초기화 타이밍** (1개 테스트)
   - 백엔드 연결 대기로 인한 UI 요소 접근 타이밍 이슈

5. **보안 테스트 응답 코드 불일치** (3개 테스트)
   - 백엔드와 테스트 간 기대 응답 코드 차이