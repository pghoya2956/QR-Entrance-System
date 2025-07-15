# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

QR 코드 기반 행사 입장 관리 시스템입니다. Node.js/Express 백엔드와 바닐라 JavaScript 프론트엔드로 구성되어 있으며, CSV 파일 기반 데이터 저장을 사용합니다.

## 주요 개발 명령어

```bash
# 개발 서버 실행 (nodemon 사용)
npm run dev

# 프로덕션 서버 실행
npm start

# 테스트 실행 (Playwright)
npm test

# Playwright 브라우저 설치 (최초 1회)
npx playwright install chromium
```

## 아키텍처 구조

### 백엔드 (Express.js)
- **진입점**: `backend/src/server.js`
- **라우트 구조**:
  - `/api/qr/*` - QR 코드 생성 관련 (JWT 토큰 기반)
  - `/api/checkin/*` - 체크인 처리 및 검증
  - `/api/admin/*` - 참석자 관리 및 통계
- **데이터 저장**: CSV 파일 (`backend/src/data/attendees.csv`)
- **서비스 계층**: `csvService.js` (CSV 읽기/쓰기), `qrService.js` (QR 코드 생성)

### 프론트엔드 (Vanilla JS)
- **페이지 구조**:
  - `index.html` - 메인 대시보드 (통합 뷰)
  - `scanner.html` - QR 스캐너 전용 페이지
  - `attendees.html` - 참석자 관리 페이지
- **JavaScript 모듈**:
  - `common.js` - 공통 API 함수 및 유틸리티
  - `scanner.js` - QR 스캔 로직
  - `attendees.js` - 참석자 관리 로직
  - `audio-feedback.js` - 오디오 피드백 처리
- **라이브러리**: qr-scanner (Nimiq), QRCode.js

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

## 환경 설정

`.env` 파일 필수 설정:
```
PORT=3000
JWT_SECRET=qr-entrance-secret-key-2025
```

## 요구사항 문서

상세한 기능 요구사항은 `requirements/2025-07-15-2319-qr-scanner-participant-pages/06-requirements-spec.md` 참조