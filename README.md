# QR 기반 입장 관리 시스템 v2.1

QR 코드를 활용한 행사 참석자 입장 관리 웹 애플리케이션입니다. 사전 등록된 참석자에게 QR 코드를 발급하고, 카메라를 통해 실시간으로 체크인을 처리할 수 있습니다.

## 주요 기능

- 📱 **QR 코드 생성**: 참석자별 고유 QR 코드 생성 및 다운로드
- 📸 **실시간 QR 스캔**: 웹 카메라를 통한 실시간 QR 코드 인식
- ✅ **체크인 관리**: 중복 체크인 방지 및 체크인 시간 기록
- 📊 **실시간 통계**: 체크인 현황 실시간 모니터링
- 🔄 **오프라인 지원**: 네트워크 연결이 없어도 체크인 가능 (추후 동기화)
- 👥 **다중 스태프 지원**: 여러 디바이스에서 동시 체크인 처리
- 🎉 **멀티 이벤트 지원**: 여러 행사를 독립적으로 관리 (v2.0 신규)

## 기술 스택

### 백엔드
- Node.js
- Express.js
- JWT (JSON Web Token)
- SQLite 데이터베이스 (v2.1 신규)
- CSV 파일 기반 데이터 저장 (하이브리드 지원)

### 프론트엔드
- HTML5/CSS3/JavaScript (Vanilla)
- html5-qrcode - QR 코드 스캔
- QRCode.js - QR 코드 생성

### 테스트
- Playwright
- Jest (단위 테스트)

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
# 필요시 설정 변경 가능
USE_DATABASE=true  # true: SQLite 모드 (권장), false: CSV 모드
JWT_SECRET=qr-entrance-secret-key-2025
```

## 실행 방법

### 단일 이벤트 모드 (기존 방식)
```bash
npm start
# 또는
npm run dev  # nodemon 사용
```

브라우저에서 `http://localhost:3000` 접속

### 멀티 이벤트 모드 (Docker Compose)

#### 프로덕션 환경
```bash
./scripts/start-prod.sh
```

#### 개발 환경
```bash
./scripts/start-dev.sh
```

### 테스트 실행

#### 전체 테스트 실행
```bash
npm test
```

#### 특정 테스트 파일 실행
```bash
npx playwright test tests/e2e/checkin/duplicate-checkin.spec.js
```

#### UI 모드로 테스트 실행 (디버깅용)
```bash
npx playwright test --ui
```

#### 테스트 리포트 보기
```bash
npx playwright show-report
```

#### 테스트 상태 (2025-07-17 기준)
- **총 테스트**: 57개
- **통과**: 36개 (63.2%)
- **실패**: 17개 (주로 테스트 데이터 격리 문제 및 백엔드 디스커버리 불안정)
- **스킵**: 4개

## 사용 방법

### 1. 메인 대시보드
- 전체 참석자 수, 체크인 완료, 미체크인, 체크인율 확인
- QR 스캐너, QR 코드 생성, 참석자 목록, 체크인 초기화 기능

### 2. QR 코드 생성
- 참석자 관리 페이지에서 각 참석자별 "QR 생성" 버튼 클릭
- 모달 창에서 QR 코드 확인 및 다운로드
- QR 형식: `CHECKIN:등록번호` (예: `CHECKIN:REG001`)

### 3. QR 스캔 및 체크인
- "QR 스캐너 열기" 버튼 클릭
- 카메라 권한 허용
- QR 코드를 카메라에 비추면 자동으로 체크인 처리
- 체크인 성공 시 ✓ 표시와 함께 확인 메시지 표시

### 4. 오프라인 모드
- 인터넷 연결이 없을 때도 체크인 가능
- 오프라인 대기열에 저장
- 인터넷 연결 시 "동기화" 버튼으로 일괄 처리

## 🎉 멀티 이벤트 시스템 (v2.0)

### 개요
하나의 프론트엔드에서 여러 개의 독립적인 백엔드를 선택하여 사용할 수 있는 멀티 이벤트 시스템입니다. 각 이벤트는 독립적인 Docker 컨테이너로 실행되며, 고유한 CSV 형식과 데이터를 가질 수 있습니다.

### 주요 특징
- **독립적인 이벤트 관리**: 각 이벤트는 별도의 백엔드 컨테이너로 실행
- **유연한 CSV 형식**: 이벤트별로 다른 CSV 필드 구성 가능
- **자동 디스커버리**: 프론트엔드가 활성 백엔드를 자동으로 감지
- **무중단 추가**: 기존 이벤트 영향 없이 새 이벤트 추가 가능

### 새 이벤트 추가 방법

#### 1. 스크립트 사용 (권장)
```bash
./scripts/add-event.sh
```

#### 2. 수동 추가
1. 데이터 디렉토리 생성
```bash
mkdir -p backend/src/data/[EVENT_ID]
```

2. CSV 파일 생성
```bash
echo "필드1,필드2,필드3,..." > backend/src/data/[EVENT_ID]/attendees.csv
```

3. docker-compose.yml에 서비스 추가
```yaml
backend-[EVENT_ID]:
  build:
    context: .
    dockerfile: Dockerfile
  ports:
    - "[PORT]:[PORT]"
  environment:
    - PORT=[PORT]
    - EVENT_ID=[EVENT_ID]
    - EVENT_NAME=[이벤트 이름]
    - CSV_FIELDS=필드1,필드2,필드3,...
    - CSV_REQUIRED=필수필드1,필수필드2,...
  volumes:
    - ./backend/src/data/[EVENT_ID]:/app/backend/src/data/[EVENT_ID]
  networks:
    - qr-network
```

4. 컨테이너 재시작
```bash
docker-compose up -d
```

### 환경 변수 설정

각 백엔드 컨테이너는 다음 환경 변수를 사용합니다:

- `PORT`: 백엔드 서비스 포트 (3001-3010)
- `EVENT_ID`: 이벤트 고유 식별자
- `EVENT_NAME`: 이벤트 표시 이름
- `CSV_FIELDS`: CSV 필드 목록 (쉼표 구분)
- `CSV_REQUIRED`: 필수 필드 목록 (쉼표 구분)
- `JWT_SECRET`: JWT 토큰 시크릿 키

### 사용 예시

1. **프로덕션 환경 시작**
```bash
./scripts/start-prod.sh
```

2. **프론트엔드 접속**
- http://localhost 접속
- 상단 이벤트 선택기에서 원하는 이벤트 선택
- 선택한 이벤트의 데이터로 작업 진행

3. **백엔드 상태 확인**
```bash
docker-compose ps
docker-compose logs -f [서비스명]
```

## API 엔드포인트

### 이벤트 정보 (v2.0 신규)
- `GET /api/info` - 백엔드 이벤트 정보 조회

### QR 코드 관련
- `GET /api/qr/generate/:registrationNumber` - 특정 참석자 QR 코드 생성
- `POST /api/qr/generate` - QR 코드 생성 (미구현)
- `GET /api/qr/generate-all` - 전체 참석자 QR 코드 생성 (미구현)

### 체크인 관련
- `POST /api/checkin/verify` - QR 코드 검증 및 체크인 처리
- `POST /api/checkin/batch` - 오프라인 체크인 일괄 처리

### 관리자 관련
- `GET /api/admin/attendees` - 전체 참석자 목록 조회
- `GET /api/admin/stats` - 체크인 통계 조회
- `PUT /api/admin/attendee/:registrationNumber/toggle-checkin` - 체크인 상태 토글
- `POST /api/admin/reset` - 체크인 데이터 초기화
- `GET /api/admin/export-csv` - CSV 파일 다운로드
- `POST /api/admin/import-csv` - CSV 파일 업로드
- `GET /api/admin/backups` - 백업 목록 조회 (DB 모드 전용)
- `POST /api/admin/backup` - 수동 백업 생성 (DB 모드 전용)

## 프로젝트 구조

```
qr-entrance-system/
├── backend/
│   └── src/
│       ├── server.js          # Express 서버
│       ├── routes/            # API 라우트
│       │   ├── qr.js          # QR 생성 엔드포인트
│       │   ├── checkin.js     # 체크인 처리
│       │   └── admin.js       # 관리자 기능
│       ├── services/          # 비즈니스 로직
│       │   ├── csvService.js  # CSV 파일 처리
│       │   ├── dbService.js   # SQLite 데이터베이스 처리
│       │   ├── backupService.js # 백업 서비스
│       │   └── qrService.js   # QR 코드 생성/검증
│       ├── migrations/        # 데이터베이스 마이그레이션
│       │   ├── 001-initial-schema.sql
│       │   └── migrate.js
│       └── data/              # 이벤트별 데이터 디렉토리
│           ├── default-event/
│           │   └── attendees.csv
│           ├── tech-conference-2025/
│           │   └── attendees.csv
│           └── startup-meetup-2025/
│               └── attendees.csv
├── frontend/
│   ├── index.html            # 메인 대시보드
│   ├── scanner.html          # QR 스캐너 페이지
│   ├── attendees.html        # 참석자 관리 페이지
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── common.js         # 공통 유틸리티 및 API
│       ├── scanner.js        # QR 스캐너 로직
│       ├── attendees.js      # 참석자 관리 로직
│       └── audio-feedback.js # 오디오 피드백
├── scripts/                  # 유틸리티 스크립트
│   ├── start-dev.sh
│   ├── start-prod.sh
│   └── add-event.sh
├── tests/
│   └── e2e/                  # Playwright E2E 테스트
│       ├── helpers/          # 공통 테스트 유틸리티
│       ├── setup/            # 테스트 환경 설정
│       ├── multi-event/      # 멀티 이벤트 테스트
│       ├── checkin/          # 체크인 기능 테스트
│       ├── admin/            # 관리자 기능 테스트
│       └── security/         # 보안 테스트
├── docker-compose.yml        # 프로덕션 구성
├── docker-compose.dev.yml    # 개발 환경 구성
├── Dockerfile                # 백엔드 이미지
├── nginx.conf                # 프론트엔드 서버 설정
├── package.json
├── playwright.config.js
├── .env
├── .env.example
└── .dockerignore
```

## 데이터 형식

### QR 코드 형식
QR 코드는 다음 형식으로 생성됩니다:
- **형식**: `CHECKIN:등록번호`
- **예시**: `CHECKIN:REG001`, `CHECKIN:1001`

### CSV 파일 형식 요구사항

#### 단일 이벤트 모드 (v1.0)
단일 이벤트 모드에서는 **고정된 CSV 형식**을 사용합니다. CSV 파일은 반드시 아래 형식을 따라야 합니다:

#### 멀티 이벤트 모드 (v2.0)
멀티 이벤트 모드에서는 **유연한 CSV 형식**을 지원합니다:
- 이벤트별로 다른 필드 구성 가능
- 환경 변수로 필드 정의
- 필수 필드만 지정하면 나머지는 자유롭게 구성

**필수 식별 필드** (모든 이벤트 공통):
- 등록번호
- 고객명
- 회사명
- 이메일

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

## 데이터베이스 운영 가이드

### 데이터베이스 마이그레이션
```bash
# 마이그레이션 상태 확인
npm run migrate:status

# CSV → SQLite 마이그레이션 실행
npm run migrate
```

### 운영 모드 전환
```bash
# SQLite 데이터베이스 모드 (권장)
USE_DATABASE=true

# CSV 파일 모드 (레거시)
USE_DATABASE=false
```

### 백업 관리
- **자동 백업**: 매일 새벽 2시 자동 실행
- **수동 백업**: `POST /api/admin/backup` 호출
- **백업 위치**: `backend/src/data/backups/`
- **백업 형식**: `attendees_backup_YYYYMMDD_HHMMSS.db.gz`
- **보관 기간**: 30일 (자동 삭제)

## 보안 고려사항

- JWT 토큰을 사용한 QR 코드 생성
- 토큰 만료 시간 설정 (7일)
- 중복 체크인 방지
- CORS 설정으로 외부 접근 제어

## 개발자 가이드

### 테스트 작성 규칙
1. **공통 헬퍼 함수 사용 필수**
   ```javascript
   import { selectBackendAndLoadData, performQRCheckin, selectors } from '../helpers/common.js';
   ```
2. **실제 DOM 구조 확인 후 셀렉터 작성**
   - 올바른 예: `#attendeesTableBody`, `#searchBox`
   - 잘못된 예: `#attendeesList`, `#searchInput`
3. **API 응답 구조 확인**
   ```javascript
   // 성공 응답
   { success: true, attendeeInfo: { name, company, registrationNumber } }
   
   // 409 에러 (중복 체크인)
   { error: "이미 체크인된 참석자입니다.", attendeeInfo: { ... } }
   
   // 기타 에러
   { error: "에러 메시지" }
   ```

### 디버깅 가이드
- **테스트 실패 시 체크리스트**:
  1. 셀렉터가 실제 DOM과 일치하는지 확인
  2. API 응답 구조가 테스트 기대값과 일치하는지 확인
  3. 백엔드 초기화 타이밍 문제인지 확인
  4. 페이지 리로드 후 수동 데이터 로드가 필요한지 확인

- **백엔드 선택 후 데이터 로드**:
  ```javascript
  // 백엔드 선택 시 페이지가 리로드되므로 
  // 명시적으로 데이터 로드 함수 호출 필요
  await selectBackendAndLoadData(page, '3001', 'attendees');
  ```

- **일반적인 문제 해결**:
  - 포트 번호는 문자열로 전달: `'3001'` (숫자 아님)
  - 체크인 상태는 문자열: `"true"` / `"false"` (boolean 아님)
  - 이벤트 선택 후 3초 대기 권장 (초기화 완료 대기)

## 최근 개선사항 (2025-07-18)

### SQLite 데이터베이스 통합
- ✅ **데이터베이스 마이그레이션**: CSV 파일에서 SQLite 데이터베이스로 전환
  - 트랜잭션 지원으로 데이터 무결성 보장
  - WAL 모드로 동시 접근 개선
  - 인덱스 자동 생성으로 성능 최적화
- ✅ **자동 백업 시스템**: 매일 새벽 2시 자동 백업
  - gzip 압축으로 저장 공간 절약
  - 30일 보관 정책
  - 수동 백업 API 제공
- ✅ **하이브리드 운영**: CSV와 DB 모드 동시 지원
  - USE_DATABASE 환경변수로 모드 전환
  - 기존 CSV 시스템과 100% 호환
  - CSV 가져오기/내보내기 유지

### 이전 개선사항 (2025-07-17)
- ✅ **QR 코드 생성 API**: `/api/qr/generate/:registrationNumber` 엔드포인트 구현
- ✅ **QR 코드 생성 UI**: 참석자별 QR 생성 버튼, 모달 팝업, 다운로드 기능
- ✅ **체크인 토글 기능**: 참석자 목록에서 체크인 상태를 클릭하여 변경
- ✅ **이벤트 전환 개선**: 페이지 새로고침 없이 데이터만 로드 (attendees.html, index.html)
- ✅ **스캐너 초기화 개선**: 백엔드 연결 완료 후 UI 활성화

### 알려진 이슈
- Frontend 컨테이너 health check 실패 (unhealthy 상태)
- 백엔드 자동 선택 간헐적 실패 (JS 로딩 순서 문제)
- 테스트 데이터 격리 문제로 일부 테스트 실패
- 이벤트 전환 시 스캐너 페이지는 여전히 페이지 새로고침 필요

## 향후 개선사항

- [x] 멀티 이벤트 지원 (v2.0 완료)
- [x] 유연한 CSV 형식 (v2.0 완료)
- [x] QR 코드 생성 UI (v2.1 완료)
- [x] QR 코드 생성 API 구현 (v2.1 완료)
- [x] SQLite 데이터베이스 통합 (v2.1 완료)
- [x] 자동 백업 시스템 (v2.1 완료)
- [ ] Frontend health check 수정
- [ ] 백엔드 디스커버리 안정화
- [ ] 테스트 데이터 격리 개선
- [ ] Google Sheets 연동
- [ ] 이메일 자동 발송 기능
- [ ] 실시간 동기화 (WebSocket)
- [ ] 다국어 지원
- [ ] 체크인 위치 정보 기록
- [ ] 관리자 인증 기능
- [ ] Kubernetes 배포 지원
- [ ] 이벤트별 통계 대시보드

## 라이센스

MIT License
