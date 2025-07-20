/**
 * 공통 테스트 유틸리티
 * E2E 테스트에서 재사용되는 헬퍼 함수 및 셀렉터 정의
 */

/**
 * @typedef {Object} AttendeeData
 * @property {string} 등록번호
 * @property {string} 고객명
 * @property {string} 회사명
 * @property {string} 연락처
 * @property {string} 이메일
 * @property {string} 초대/현장방문
 * @property {string} 체크인 - "true" | "false" (string)
 * @property {string} 체크인시간
 */

/**
 * @typedef {Object} StatsResponse
 * @property {number} total
 * @property {number} checkedIn
 * @property {number} notCheckedIn
 * @property {string} checkedInPercentage
 */

/**
 * @typedef {Object} BackendInfo
 * @property {string} eventId
 * @property {string} eventName
 * @property {string} port
 * @property {string[]} csvFields
 * @property {string[]} requiredFields
 * @property {string} version
 * @property {string} baseUrl
 */

/**
 * 공통 셀렉터 정의
 */
export const selectors = {
  // 이벤트 선택
  eventSelect: '#eventSelect',
  eventSelectorHeader: '.event-selector-header',
  refreshBackends: '#refreshBackends',
  
  // 통계
  statsTotal: '#totalAttendees',
  statsCheckedIn: '#checkedIn',
  statsNotCheckedIn: '#notCheckedIn',
  statsPercentage: '#checkedInPercentage',
  
  // 참석자 관리
  attendeesTable: '#attendeesTableBody',
  searchBox: '#searchBox',
  filterButtons: '[data-filter]',
  checkinToggle: '.checkin-toggle',
  uploadInput: '#csvFile',
  downloadBtn: '#downloadBtn',
  resetBtn: '#resetBtn',
  
  // QR 스캐너
  scannerFrame: '.scanner-frame',
  scannerStatus: '#status',
  resultDisplay: '#resultDisplay',
  toggleCamera: '#toggleCamera',
  
  // 네비게이션
  navigation: '#navigation',
  navLinks: '.nav-list a',
  
  // 토스트 메시지
  toast: '.toast'
};

/**
 * 백엔드 선택 및 데이터 로드 헬퍼
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} eventId - 이벤트 ID (예: 'tech-conference-2025')
 * @param {string} pageType - 페이지 타입 (index, attendees, scanner)
 */
export async function selectBackendAndLoadData(page, eventId, pageType = 'index') {
  // 페이지 이동
  const pagePath = pageType === 'index' ? '/' : `/${pageType}.html`;
  await page.goto(pagePath);
  
  // 백엔드 초기화 대기
  await page.waitForTimeout(2000);
  await page.waitForSelector(selectors.eventSelect);
  
  // 이벤트 선택 - 페이지별로 다른 동작
  if (pageType === 'attendees' || pageType === 'index') {
    // attendees.html과 index.html에서는 데이터만 새로고침
    await page.selectOption(selectors.eventSelect, eventId);
    // 토스트 메시지 대기
    await page.waitForSelector('.toast.show', { timeout: 5000 });
  } else {
    // 다른 페이지에서는 이벤트 선택 후 대기
    await page.selectOption(selectors.eventSelect, eventId);
    await page.waitForTimeout(1000);
  }
  
  // 리로드 후 추가 대기
  await page.waitForTimeout(3000);
  
  // 페이지별 초기화 함수 호출
  const initFunctions = {
    'attendees': ['loadAttendees', 'loadStats'],
    'scanner': ['initScanner'],
    'index': ['loadStats', 'loadAttendees']
  };
  
  if (initFunctions[pageType]) {
    await page.evaluate(async (funcs) => {
      for (const func of funcs) {
        if (window[func] && typeof window[func] === 'function') {
          try {
            await window[func]();
          } catch (error) {
            console.error(`Failed to call ${func}:`, error);
          }
        }
      }
    }, initFunctions[pageType]);
    
    // 데이터 로드 완료 대기
    await page.waitForTimeout(1000);
  }
}


/**
 * 통계 데이터 가져오기
 * @param {import('@playwright/test').Page} page
 * @param {string} [eventId] - 이벤트 ID (선택사항, 기본값: 'tech-conference-2025')
 * @returns {Promise<StatsResponse>}
 */
export async function getStats(page, eventId = 'tech-conference-2025') {
  const response = await page.request.get(`/api/admin/stats?event_id=${eventId}`);
  return await response.json();
}


/**
 * 참석자 목록 가져오기
 * @param {import('@playwright/test').Page} page
 * @param {string} [eventId] - 이벤트 ID (선택사항, 기본값: 'tech-conference-2025')
 * @returns {Promise<AttendeeData[]>}
 */
export async function getAttendees(page, eventId = 'tech-conference-2025') {
  const response = await page.request.get(`/api/admin/attendees?event_id=${eventId}`);
  return await response.json();
}

/**
 * 체크인 상태 토글
 * @param {import('@playwright/test').Page} page
 * @param {string} registrationNumber
 * @param {string} [eventId] - 이벤트 ID (선택사항, 기본값: 'tech-conference-2025')
 * @returns {Promise<Object>}
 */
export async function toggleCheckin(page, registrationNumber, eventId = 'tech-conference-2025') {
  const response = await page.request.put(
    `/api/admin/attendee/${registrationNumber}/toggle-checkin?event_id=${eventId}`
  );
  return await response.json();
}

/**
 * CSV 업로드
 * @param {import('@playwright/test').Page} page
 * @param {string} filePath
 */
export async function uploadCSV(page, filePath) {
  const fileInput = page.locator(selectors.uploadInput);
  await fileInput.setInputFiles(filePath);
  
  // 업로드 완료 대기
  await page.waitForTimeout(2000);
}

/**
 * 필터 버튼 클릭
 * @param {import('@playwright/test').Page} page
 * @param {string} filterValue - 'all', 'checked', 'unchecked'
 */
export async function clickFilter(page, filterValue) {
  await page.click(`[data-filter="${filterValue}"]`);
  await page.waitForTimeout(500);
}

/**
 * 검색 수행
 * @param {import('@playwright/test').Page} page
 * @param {string} searchTerm
 */
export async function searchAttendees(page, searchTerm) {
  await page.fill(selectors.searchBox, searchTerm);
  await page.waitForTimeout(500); // 디바운스 대기
}

/**
 * 토스트 메시지 확인
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedMessage
 */
export async function expectToast(page, expectedMessage) {
  const toast = page.locator(selectors.toast);
  await toast.waitFor({ state: 'visible' });
  const text = await toast.textContent();
  return text.includes(expectedMessage);
}

/**
 * QR 체크인 수행
 * @param {import('@playwright/test').Page} page
 * @param {string} qrData
 * @param {string} [eventId] - 이벤트 ID (선택사항, 기본값: 'tech-conference-2025')
 * @returns {Promise<Object>}
 */
export async function performQRCheckin(page, qrData, eventId = 'tech-conference-2025') {
  const response = await page.request.post(
    `/api/checkin/verify?event_id=${eventId}`,
    {
      data: { qrData },
      failOnStatusCode: false
    }
  );
  return {
    status: response.status(),
    data: await response.json()
  };
}

/**
 * 테스트 데이터 생성 헬퍼
 */
export const testData = {
  /**
   * 샘플 참석자 데이터 생성
   * @param {Object} overrides - 덮어쓸 필드
   * @returns {AttendeeData}
   */
  createAttendee(overrides = {}) {
    return {
      '등록번호': 'TEST-001',
      '고객명': '테스트 사용자',
      '회사명': '테스트 회사',
      '연락처': '010-1234-5678',
      '이메일': 'test@example.com',
      '초대/현장방문': '초대',
      '체크인': 'false',
      '체크인시간': '',
      ...overrides
    };
  },
  
  /**
   * CSV 내용 생성
   * @param {AttendeeData[]} attendees
   * @param {string[]} headers
   * @returns {string}
   */
  createCSVContent(attendees, headers) {
    const headerRow = headers.join(',');
    const dataRows = attendees.map(attendee => 
      headers.map(header => attendee[header] || '').join(',')
    );
    return [headerRow, ...dataRows].join('\n');
  }
};

/**
 * 페이지 초기화 헬퍼
 * @param {import('@playwright/test').Page} page
 */
export async function initializePage(page) {
  // localStorage 초기화
  await page.evaluate(() => localStorage.clear());
  
  // 백엔드 초기화 대기
  await page.waitForTimeout(1000);
}

/**
 * 백엔드 헬스 체크
 * @param {import('@playwright/test').Page} page
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth(page, eventId) {
  try {
    const response = await page.request.get(`/api/info?event_id=${eventId}`);
    return response.ok();
  } catch (error) {
    return false;
  }
}