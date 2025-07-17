# 백엔드 자동 선택 실패 원인 분석

## 1. 에러 발생 지점 분석

### attendees.js:12 TypeError
```javascript
allAttendees = await api.getAttendees();
```
- `api.getAttendees()` 호출 시 에러 발생
- `api` 객체 또는 메서드가 정의되지 않은 상태에서 호출

### attendees.js:24 TypeError  
```javascript
updateStatsDisplay(stats);
```
- `updateStatsDisplay` 함수가 정의되지 않은 상태에서 호출

## 2. 근본 원인: 스크립트 로딩 순서와 전역 객체 접근 문제

### 2.1 스크립트 로딩 순서 (attendees.html)
```html
<script src="js/common.js"></script>  <!-- head에서 로드 -->
<!-- ... HTML 내용 ... -->
<script src="js/attendees.js"></script>  <!-- body 끝에서 로드 -->
```

### 2.2 문제점
1. **common.js**가 head에서 로드되지만, DOM이 준비되지 않은 상태
2. **attendees.js**가 body 끝에서 로드되면서 즉시 실행되는 코드가 있을 수 있음
3. 두 스크립트 간의 의존성이 명확하지 않음

## 3. 전역 객체 접근 문제

### 3.1 common.js에서 정의된 전역 객체/함수
- `api` 객체 (줄 115-243)
- `updateStatsDisplay` 함수 (줄 246-258)
- `initializeBackends` 함수 (줄 395-429)

### 3.2 attendees.js에서의 사용
- `api.getAttendees()` (줄 12)
- `api.getStats()` (줄 23)  
- `updateStatsDisplay(stats)` (줄 24)
- `getApiUrl('/api/qr/generate')` (줄 175)

### 3.3 문제 시나리오
attendees.js가 common.js보다 먼저 실행되거나, common.js의 초기화가 완료되기 전에 attendees.js의 함수가 호출되는 경우 발생

## 4. 초기화 타이밍 문제

### 4.1 현재 초기화 흐름 (attendees.html)
```javascript
window.addEventListener('DOMContentLoaded', async () => {
    // 1. 이벤트 선택기 생성
    eventSelectorDiv.appendChild(createEventSelector());
    
    // 2. 백엔드 초기화 (비동기)
    const backendReady = await initializeBackends();
    
    // 3. 참가자 페이지 초기화
    initAttendees();  // 여기서 loadStats()와 loadAttendees() 호출
});
```

### 4.2 initAttendees 함수 내부 (attendees.js:143-163)
```javascript
function initAttendees() {
    // ... DOM 이벤트 리스너 설정 ...
    
    // 초기 데이터 로드 - 바로 실행됨!
    loadStats();      // 줄 158
    loadAttendees();  // 줄 159
}
```

### 4.3 타이밍 문제
- `initAttendees()`가 호출될 때 `currentBackend`가 아직 설정되지 않았을 가능성
- `api` 객체가 정의되지 않았거나 초기화되지 않은 상태일 가능성

## 5. 백엔드 선택 로직의 비동기 처리 문제

### 5.1 initializeBackends 함수 분석
```javascript
async function initializeBackends() {
    // 1. 백엔드 검색 (비동기)
    await discoverBackends();
    
    // 2. 백엔드 복원/선택 (비동기)
    const restored = await restoreSelectedBackend();
    
    // 3. UI 업데이트 (동기)
    updateEventSelector(availableBackends);
}
```

### 5.2 restoreSelectedBackend 함수의 문제점
- localStorage에서 포트를 읽어오지만, 해당 백엔드가 실제로 활성화되어 있는지 확인
- 첫 번째 백엔드를 자동 선택하지만, `setCurrentBackend` 호출이 실패할 수 있음

## 6. DOM 조작 순서 문제

### 6.1 이벤트 선택기 생성 타이밍
```javascript
// attendees.html의 DOMContentLoaded 이벤트에서
eventSelectorDiv.appendChild(createEventSelector());  // DOM 생성
// ...
await initializeBackends();  // 여기서 updateEventSelector() 호출
```

### 6.2 updateEventSelector 함수의 문제
```javascript
function updateEventSelector(backends) {
    const select = document.getElementById('eventSelect');
    if (!select) return;  // select 요소가 없으면 그냥 리턴
    // ...
}
```

- `eventSelect` 요소가 아직 DOM에 추가되지 않았을 수 있음
- 비동기 작업 중에 DOM이 변경되어 요소를 찾지 못할 수 있음

## 7. 해결 방향

### 7.1 스크립트 로딩 순서 개선
1. 모든 스크립트를 body 끝으로 이동하거나
2. defer 속성 사용하여 DOM 파싱 후 실행 보장

### 7.2 초기화 순서 명확화
```javascript
// 1단계: DOM 준비 확인
// 2단계: 전역 객체 초기화 확인
// 3단계: 백엔드 연결 및 선택
// 4단계: 페이지별 초기화
```

### 7.3 에러 처리 강화
- `api` 객체 존재 여부 확인
- `currentBackend` 설정 여부 확인
- 함수 호출 전 의존성 검증

### 7.4 비동기 처리 개선
- Promise 체인 명확화
- 초기화 완료 신호 추가
- 재시도 로직 구현

### 7.5 디버깅 로그 추가
- 각 초기화 단계별 상태 로깅
- 에러 발생 시점의 상태 정보 출력
- 백엔드 연결 상태 실시간 모니터링