# QR 스캐너 설정 가이드

## 문제 해결 과정

### 초기 문제
- QR Scanner 라이브러리의 Worker 파일이 CORS 정책으로 인해 로드되지 않음
- 에러: `Failed to resolve module specifier './qr-scanner-worker.min.js'`

### 시도한 해결 방법
1. Worker 파일을 로컬로 다운로드
2. Worker 경로 설정 변경
3. Blob URL 사용 시도
4. 대체 라이브러리 (ZXing) 시도

### 최종 해결책
- Html5-QrCode 라이브러리 사용
- Worker 파일이 필요 없는 간단한 구현
- 안정적이고 에러 없는 작동

## 현재 구성

### 메인 스캐너
- 파일: `/frontend/scanner-simple.html`
- 라이브러리: Html5-QrCode v2.3.8
- 특징:
  - CORS 문제 없음
  - 간단한 설정
  - 수동 시작/중지 제어
  - 테스트 버튼 포함

### 지원하는 QR 형식
1. **시스템 형식**: `CHECKIN:1002`
2. **사용자 형식**: `이영희 1002`

### 사용 방법
1. http://localhost:3000 접속
2. "QR 스캐너 열기" 버튼 클릭
3. "스캔 시작" 버튼 클릭
4. 카메라 권한 허용
5. QR 코드를 카메라에 보여주기

### 테스트
- "테스트 체크인" 버튼으로 API 테스트 가능
- 직접 테스트 페이지: http://localhost:3000/qr-test-direct.html

## 파일 구조
```
frontend/
├── scanner-simple.html  # 메인 QR 스캐너
├── scanner.html        # 기존 스캐너 (CORS 문제)
├── scanner-alt.html    # ZXing 버전 (API 문제)
├── qr-test-direct.html # API 테스트 페이지
└── js/
    ├── scanner.js          # 기존 스캐너 스크립트
    ├── scanner-fixed.js    # 수정 시도 버전
    └── qr-scanner-worker.min.js # Worker 파일
```

## 주의사항
- HTTPS 또는 localhost에서만 카메라 사용 가능
- 모바일 브라우저에서는 권한 설정 확인 필요
- Chrome, Firefox, Safari 최신 버전 권장