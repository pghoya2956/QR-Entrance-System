# QR 코드 검증 프로세스 상세 설명

## 검증 흐름도

```
QR 스캔 → 형식 검증 → 등록번호 추출 → DB 조회 → 중복 체크 → 체크인 처리
```

## 단계별 검증 과정

### 1. QR 데이터 존재 확인
```javascript
if (!qrData) {
    return res.status(400).json({ error: 'QR 데이터가 필요합니다.' });
}
```
- **검증 내용**: QR 데이터가 비어있는지 확인
- **실패 시**: 400 Bad Request

### 2. QR 형식 검증 및 등록번호 추출
```javascript
// 형식 1: CHECKIN:1002
let match = qrData.match(/^CHECKIN:(\d+)$/);
if (match) {
    registrationNumber = match[1];
} else {
    // 형식 2: 이영희 1002 (이름과 번호)
    match = qrData.match(/(\d{4})$/);
    if (match) {
        registrationNumber = match[1];
    } else {
        return res.status(401).json({ 
            error: '유효하지 않은 QR 코드입니다.',
            details: 'QR 코드 형식이 올바르지 않습니다.' 
        });
    }
}
```
- **지원 형식**:
  - `CHECKIN:1002` - 시스템 생성 형식
  - `이영희 1002` - 이름+번호 형식
- **검증 내용**: 정규표현식으로 형식 확인
- **실패 시**: 401 Unauthorized

### 3. 참석자 존재 확인
```javascript
const attendee = await csvService.getAttendeeByRegistrationNumber(registrationNumber);

if (!attendee) {
    return res.status(404).json({ error: '참석자를 찾을 수 없습니다.' });
}
```
- **검증 내용**: CSV 파일에서 등록번호로 참석자 검색
- **실패 시**: 404 Not Found

### 4. 중복 체크인 확인
```javascript
if (attendee['체크인'] === 'true') {
    return res.status(409).json({ 
        error: '이미 체크인된 참석자입니다.',
        attendeeInfo: {
            name: attendee['고객명'],
            registrationNumber: attendee['등록번호'],
            checkinTime: attendee['체크인시간']
        }
    });
}
```
- **검증 내용**: 이미 체크인했는지 확인
- **실패 시**: 409 Conflict + 기존 체크인 정보 반환

### 5. 체크인 처리
```javascript
const checkinTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const updatedAttendee = await csvService.updateAttendee(registrationNumber, {
    '체크인': 'true',
    '체크인시간': checkinTime
});
```
- **처리 내용**: 
  - 체크인 상태를 'true'로 변경
  - 현재 시간 기록
  - CSV 파일 업데이트

## 응답 코드 정리

| 상태 | HTTP 코드 | 에러 메시지 | 설명 |
|------|-----------|------------|------|
| 성공 | 200 | - | 체크인 완료 |
| 데이터 없음 | 400 | QR 데이터가 필요합니다 | 빈 요청 |
| 형식 오류 | 401 | 유효하지 않은 QR 코드입니다 | QR 형식 불일치 |
| 미등록 | 404 | 참석자를 찾을 수 없습니다 | 등록되지 않은 번호 |
| 중복 | 409 | 이미 체크인된 참석자입니다 | 중복 체크인 시도 |
| 서버 오류 | 500 | 체크인 처리 중 오류가 발생했습니다 | 시스템 오류 |

## 테스트 시나리오

```bash
# 1. 정상 체크인
curl -X POST http://localhost:3000/api/checkin/verify \
  -H "Content-Type: application/json" \
  -d '{"qrData": "CHECKIN:1001"}'

# 2. 중복 체크인
curl -X POST http://localhost:3000/api/checkin/verify \
  -H "Content-Type: application/json" \
  -d '{"qrData": "CHECKIN:1001"}'

# 3. 잘못된 형식
curl -X POST http://localhost:3000/api/checkin/verify \
  -H "Content-Type: application/json" \
  -d '{"qrData": "INVALID"}'

# 4. 미등록 번호
curl -X POST http://localhost:3000/api/checkin/verify \
  -H "Content-Type: application/json" \
  -d '{"qrData": "CHECKIN:9999"}'
```