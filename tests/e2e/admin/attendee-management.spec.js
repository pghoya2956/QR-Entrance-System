import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { selectBackendAndLoadData } from '../helpers/common.js';
import path from 'path';

test.describe('참석자 관리', () => {
  test.beforeAll(async () => {
    await waitForServices();
  });
  
  test('참석자 목록 표시', async ({ page }) => {
    // 콘솔 로그 캡처
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    
    await page.goto('/attendees.html');
    
    // 백엔드 디스커버리가 완료될 때까지 대기
    await page.waitForTimeout(2000);
    await page.waitForSelector('#eventSelect');
    
    // 백엔드 선택 전 옵션 확인
    const options = await page.$$eval('#eventSelect option', opts => 
      opts.map(opt => ({ value: opt.value, text: opt.textContent }))
    );
    console.log('Available options:', options);
    
    // 백엔드 선택 - attendees 페이지에서는 데이터만 새로고침
    await page.selectOption('#eventSelect', '3001');
    
    // 토스트 메시지 대기
    await page.waitForSelector('.toast.show', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // 데이터가 로드될 때까지 대기
    await page.waitForSelector('#attendeesTableBody tr', { timeout: 10000 });
    
    // 선택된 백엔드 확인
    const selectedValue = await page.$eval('#eventSelect', el => el.value);
    console.log('Selected backend:', selectedValue);
    
    // localStorage 확인
    const storedPort = await page.evaluate(() => localStorage.getItem('selectedBackendPort'));
    console.log('Stored port in localStorage:', storedPort);
    
    // 현재 백엔드 정보 확인
    const currentBackendInfo = await page.evaluate(() => {
      return {
        currentBackend: window.currentBackend,
        apiBaseUrl: window.apiBaseUrl
      };
    });
    console.log('Current backend info:', currentBackendInfo);
    
    // 직접 API 호출 테스트
    try {
      const apiResponse = await page.evaluate(async () => {
        const response = await fetch('http://localhost:3001/api/admin/attendees');
        return { ok: response.ok, status: response.status };
      });
      console.log('Direct API call result:', apiResponse);
    } catch (e) {
      console.log('Direct API call error:', e.message);
    }
    
    // 에러가 있으면 출력
    const errors = consoleLogs.filter(log => log.type === 'error');
    console.log(`Total errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('First few errors:', errors.slice(0, 3));
    }
    
    // 테이블에 데이터가 있는지 직접 확인
    const rows = await page.$$('#attendeesTableBody tr');
    console.log(`Found ${rows.length} rows in table`);
    
    // 최소 1개 이상의 행이 있어야 함
    expect(rows.length).toBeGreaterThan(0);
    
    // 테이블 헤더 확인
    const headers = await page.$$eval('thead th', 
      ths => ths.map(th => th.textContent.trim())
    );
    
    expect(headers).toContain('등록번호');
    expect(headers).toContain('이름');
    expect(headers).toContain('회사명');
    expect(headers).toContain('연락처');
    expect(headers).toContain('이메일');
    expect(headers).toContain('유형');
    expect(headers).toContain('체크인 시간');
    expect(headers).toContain('체크인');
  });
  
  test('검색 기능', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'attendees');
    await page.waitForSelector('#attendeesTableBody');
    
    // 이름으로 검색
    await page.fill('#searchBox', '김철수');
    
    // 검색 결과 확인
    await page.waitForTimeout(500); // 디바운스 대기
    const visibleRows = await page.$$eval('tbody tr:not([style*="display: none"])', 
      rows => rows.length
    );
    expect(visibleRows).toBe(1);
    
    // 검색된 참석자 확인
    const nameCell = await page.textContent('tbody tr:not([style*="display: none"]) td:nth-child(2)');
    expect(nameCell).toBe('김철수');
    
    // 검색어 지우기
    await page.fill('#searchBox', '');
    await page.waitForTimeout(500);
    
    // 모든 행이 다시 표시되는지 확인
    const allRows = await page.$$eval('tbody tr:not([style*="display: none"])', 
      rows => rows.length
    );
    expect(allRows).toBeGreaterThan(1);
  });
  
  test('체크인 필터', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'attendees');
    await page.waitForSelector('#attendeesTableBody');
    
    // 체크인된 참석자만 표시
    await page.click('[data-filter="checked"]');
    await page.waitForTimeout(500);
    
    // 체크인된 참석자가 있는지 확인 (초기에는 없을 수 있음)
    const checkedRows = await page.$$('tbody tr');
    console.log(`Checked rows: ${checkedRows.length}`);
    
    // 체크인 안 된 참석자만 표시
    await page.click('[data-filter="unchecked"]');
    await page.waitForTimeout(500);
    
    const uncheckedRows = await page.$$('tbody tr');
    expect(uncheckedRows.length).toBeGreaterThan(0); // 미체크인 참석자는 있어야 함
    
    // 전체 보기
    await page.click('[data-filter="all"]');
    await page.waitForTimeout(500);
    
    const allRows = await page.$$('tbody tr');
    expect(allRows.length).toBeGreaterThan(0);
  });
  
  test('CSV 업로드', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'attendees');
    
    // 파일 입력 요소 찾기
    const fileInput = await page.locator('#csvFile');
    
    // 테스트 CSV 파일 업로드
    const csvPath = path.join(process.cwd(), 'tests/fixtures/test-data-event1.csv');
    
    // 파일 선택 시 자동으로 업로드됨
    await fileInput.setInputFiles(csvPath);
    
    // 업로드 처리 대기
    await page.waitForTimeout(2000);
    
    // 토스트 메시지 확인 (성공 또는 실패)
    await page.waitForSelector('.toast', { timeout: 5000 });
    
    const rows = await page.$$('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });
  
  test('CSV 다운로드', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'attendees');
    await page.waitForSelector('#attendeesTableBody');
    
    // 다운로드 버튼 클릭 (onclick 핸들러가 있는 버튼)
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("CSV 다운로드")');
    
    // 다운로드 확인
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/attendees.*\.csv$/);
    
    // 다운로드된 파일 내용 확인
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    
    // CSV 헤더 확인
    expect(content).toContain('등록번호');
    expect(content).toContain('고객명');
    expect(content).toContain('회사명');
    expect(content).toContain('이메일');
  });
  
  test.skip('참석자 편집 (미구현)', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'attendees');
    await page.waitForSelector('#attendeesTableBody');
    
    // 첫 번째 참석자의 편집 버튼 클릭
    await page.click('tbody tr:first-child .btn-edit');
    
    // 편집 모달이 열리는지 확인
    await expect(page.locator('#editModal')).toBeVisible();
    
    // 필드 값 변경
    await page.fill('#editModal input[name="회사명"]', '새로운 회사');
    await page.fill('#editModal input[name="이메일"]', 'new@email.com');
    
    // 저장 버튼 클릭
    await page.click('#saveEditBtn');
    
    // 성공 메시지 확인
    const alert = await page.waitForEvent('dialog');
    expect(alert.message()).toContain('수정되었습니다');
    await alert.accept();
    
    // 변경사항이 테이블에 반영되었는지 확인
    await page.waitForTimeout(500);
    const companyCell = await page.textContent('tbody tr:first-child td:nth-child(3)');
    expect(companyCell).toBe('새로운 회사');
  });
  
  test('통계 API', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/admin/stats');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('checkedIn');
    expect(data).toHaveProperty('notCheckedIn');
    expect(data).toHaveProperty('checkedInPercentage');
    
    // 체크인율 계산 확인
    const expectedRate = (data.checkedIn / data.total * 100).toFixed(1);
    expect(data.checkedInPercentage).toBe(expectedRate);
  });
  
  test('이벤트별 참석자 분리', async ({ page }) => {
    // 이벤트 1 참석자 확인
    await selectBackendAndLoadData(page, '3001', 'attendees');
    await page.waitForSelector('#attendeesTableBody');
    
    const event1Rows = await page.$$('tbody tr');
    const event1Count = event1Rows.length;
    
    // 이벤트 2로 전환 - attendees 페이지에서는 데이터만 새로골침
    await page.selectOption('#eventSelect', '3002');
    await page.waitForSelector('.toast.show', { timeout: 5000 });
    await page.waitForTimeout(3000);
    
    // 데이터를 수동으로 로드
    await page.evaluate(async () => {
      if (window.loadAttendees && window.loadStats) {
        await window.loadAttendees();
        await window.loadStats();
      }
    });
    
    await page.waitForSelector('#attendeesTableBody');
    
    const event2Rows = await page.$$('tbody tr');
    const event2Count = event2Rows.length;
    
    // 두 이벤트의 참석자 수가 다른지 확인
    expect(event1Count).not.toBe(event2Count);
    
    // 이벤트 2의 헤더 확인 (현재는 두 이벤트가 같은 구조 사용)
    const event2Headers = await page.$$eval('thead th', 
      ths => ths.map(th => th.textContent.trim())
    );
    expect(event2Headers).toContain('등록번호');
    expect(event2Headers).toContain('이름');
    expect(event2Headers).toContain('회사명');
  });
});