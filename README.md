# QR 기반 입장 관리 시스템

QR 코드를 활용한 행사 참석자 입장 관리 웹 애플리케이션입니다. 사전 등록된 참석자에게 QR 코드를 발급하고, 카메라를 통해 실시간으로 체크인을 처리할 수 있습니다.

## 주요 기능

- 📱 **QR 코드 생성**: 참석자별 고유 QR 코드 자동 생성
- 📸 **실시간 QR 스캔**: 웹 카메라를 통한 실시간 QR 코드 인식
- ✅ **체크인 관리**: 중복 체크인 방지 및 체크인 시간 기록
- 📊 **실시간 통계**: 체크인 현황 실시간 모니터링
- 🔄 **오프라인 지원**: 네트워크 연결이 없어도 체크인 가능 (추후 동기화)
- 👥 **다중 스태프 지원**: 여러 디바이스에서 동시 체크인 처리

## 기술 스택

### 백엔드
- Node.js
- Express.js
- JWT (JSON Web Token)
- CSV 파일 기반 데이터 저장

### 프론트엔드
- HTML5/CSS3/JavaScript (Vanilla)
- qr-scanner (Nimiq) - QR 코드 스캔
- QRCode.js - QR 코드 생성

### 테스트
- Playwright

## 설치 방법

1. 저장소 클론
```bash
git clone [repository-url]
cd qr-entrance-system
```

2. 의존성 설치
```bash
npm install
```

3. Playwright 브라우저 설치 (테스트용)
```bash
npx playwright install chromium
```

4. 환경 변수 설정
```bash
# .env 파일이 이미 생성되어 있습니다
# 필요시 JWT_SECRET 변경 가능
```

## 실행 방법

### 개발 서버 실행
```bash
npm start
# 또는
npm run dev  # nodemon 사용
```

브라우저에서 `http://localhost:3000` 접속

### 테스트 실행
```bash
npm test
```

## 사용 방법

### 1. 메인 대시보드
- 전체 참석자 수, 체크인 완료, 미체크인, 체크인율 확인
- QR 스캐너, QR 코드 생성, 참석자 목록, 체크인 초기화 기능

### 2. QR 코드 생성
- "전체 QR 코드 생성" 버튼 클릭
- 생성된 QR 코드를 이메일로 발송하거나 출력

### 3. QR 스캔 및 체크인
- "QR 스캐너 열기" 버튼 클릭
- 카메라 권한 허용
- QR 코드를 카메라에 비추면 자동으로 체크인 처리
- 체크인 성공 시 ✓ 표시와 함께 확인 메시지 표시

### 4. 오프라인 모드
- 인터넷 연결이 없을 때도 체크인 가능
- 오프라인 대기열에 저장
- 인터넷 연결 시 "동기화" 버튼으로 일괄 처리

## API 엔드포인트

### QR 코드 관련
- `GET /api/qr/generate/:registrationNumber` - 특정 참석자 QR 코드 생성
- `GET /api/qr/generate-all` - 전체 참석자 QR 코드 생성

### 체크인 관련
- `POST /api/checkin/verify` - QR 코드 검증 및 체크인 처리
- `POST /api/checkin/batch` - 오프라인 체크인 일괄 처리

### 관리자 관련
- `GET /api/admin/attendees` - 전체 참석자 목록 조회
- `GET /api/admin/stats` - 체크인 통계 조회
- `POST /api/admin/reset` - 체크인 데이터 초기화

## 프로젝트 구조

```
qr-entrance-system/
├── backend/
│   └── src/
│       ├── server.js          # Express 서버
│       ├── routes/            # API 라우트
│       │   ├── qr.js
│       │   ├── checkin.js
│       │   └── admin.js
│       ├── services/          # 비즈니스 로직
│       │   ├── csvService.js
│       │   └── qrService.js
│       └── data/
│           └── attendees.csv  # 참석자 데이터
├── frontend/
│   ├── index.html            # 메인 대시보드
│   ├── scanner.html          # QR 스캐너 페이지
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── admin.js
│       └── scanner.js
├── tests/
│   └── qr-checkin.spec.js    # Playwright 테스트
├── package.json
├── playwright.config.js
└── .env
```

## 데이터 형식

### CSV 파일 형식 요구사항

이 시스템은 **고정된 CSV 형식**을 사용합니다. CSV 파일은 반드시 아래 형식을 따라야 합니다:

#### 필수 헤더 (순서 고정)
```
등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
```

#### 각 열 설명
1. **등록번호**: 참가자 고유 번호 (필수, 중복 불가)
2. **고객명**: 참가자 이름 (필수)
3. **회사명**: 소속 회사명
4. **연락처**: 전화번호 (예: 010-1234-5678)
5. **이메일**: 이메일 주소
6. **초대/현장방문**: 참가 유형 ("초대" 또는 "현장방문")
7. **체크인**: 체크인 여부 (true/false)
8. **체크인시간**: 체크인 일시 (예: 2025. 7. 15. 오후 3:27:54)

#### attendees.csv 예시
```csv
등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간
1001,김철수,삼성전자,010-1234-5678,chulsoo@example.com,초대,false,
1002,이영희,LG전자,010-2345-6789,younghee@example.com,초대,true,2025. 7. 15. 오후 3:27:54
1003,박민수,현대자동차,010-3456-7890,minsoo@example.com,현장방문,false,
```

⚠️ **주의사항**:
- CSV 파일은 UTF-8 인코딩으로 저장되어야 합니다
- 헤더의 순서와 이름은 변경할 수 없습니다
- 데이터에 쉼표(,)나 줄바꿈이 포함된 경우 큰따옴표(")로 감싸집니다
- 체크인 필드는 "true" 또는 "false" 문자열로 저장됩니다
- 미체크인 시 체크인시간은 빈 값으로 유지됩니다

## 보안 고려사항

- JWT 토큰을 사용한 QR 코드 생성
- 토큰 만료 시간 설정 (7일)
- 중복 체크인 방지
- CORS 설정으로 외부 접근 제어

## 향후 개선사항

- [ ] Google Sheets 연동
- [ ] 이메일 자동 발송 기능
- [ ] 실시간 동기화 (WebSocket)
- [ ] 다국어 지원
- [ ] 체크인 위치 정보 기록
- [ ] 관리자 인증 기능

## 라이센스

MIT License