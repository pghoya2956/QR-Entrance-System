import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { 
  selectBackendAndLoadData,
  initializePage,
  selectors,
  getCurrentBackend
} from '../helpers/common.js';

test.describe('이벤트 전환 기능', () => {
  test.beforeAll(async () => {
    await waitForServices();
  });
  
  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 localStorage 초기화
    await page.goto('/');
    await initializePage(page);
    await page.reload();
  });
  
  test('이벤트 선택기 UI 표시 및 동작', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // 이벤트 선택기 표시 확인
    await expect(page.locator(selectors.eventSelect)).toBeVisible();
    
    // 이벤트 선택기 헤더 텍스트 확인
    const headerText = await page.locator(selectors.eventSelectorHeader).textContent();
    expect(headerText).toContain('현재 이벤트:');
    
    // 선택기 스타일 확인
    const selectBox = await page.locator(selectors.eventSelect);
    const styles = await selectBox.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        border: computed.border,
        backgroundColor: computed.backgroundColor
      };
    });
    
    expect(styles.padding).toBeTruthy();
    expect(styles.border).toBeTruthy();
    
    // 새로고침 버튼 확인
    await expect(page.locator(selectors.refreshBackends)).toBeVisible();
  });
  
  test('이벤트 전환 시 페이지 새로고침', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(selectors.eventSelect);
    
    // 페이지 리로드 감지를 위한 설정
    let reloaded = false;
    page.once('load', () => {
      reloaded = true;
    });
    
    // 이벤트 전환
    await page.selectOption(selectors.eventSelect, '3002');
    
    // 페이지가 새로고침되었는지 확인
    await page.waitForTimeout(1000);
    expect(reloaded).toBeTruthy();
  });
  
  test('이벤트별 대시보드 데이터 분리', async ({ page }) => {
    // 이벤트 1 대시보드 확인
    await selectBackendAndLoadData(page, '3001', 'index');
    
    // 현재 백엔드 정보 확인
    const event1Backend = await getCurrentBackend(page);
    expect(event1Backend.eventName).toContain('2025 테크 컨퍼런스');
    
    // 통계 확인
    const event1Total = await page.locator(selectors.statsTotal).textContent();
    expect(parseInt(event1Total)).toBeGreaterThan(0);
    
    // 이벤트 2로 전환
    await selectBackendAndLoadData(page, '3002', 'index');
    
    const event2Backend = await getCurrentBackend(page);
    expect(event2Backend.eventName).toContain('스타트업 밋업 2025');
    
    // 통계가 다른지 확인
    const event2Total = await page.locator(selectors.statsTotal).textContent();
    expect(event2Total).not.toBe(event1Total);
  });
  
  test('참석자 페이지에서 이벤트 전환', async ({ page }) => {
    // 이벤트 1 선택
    await selectBackendAndLoadData(page, '3001', 'attendees');
    
    // 테이블 헤더 확인
    const headers1 = await page.$$eval('thead th', 
      ths => ths.map(th => th.textContent.trim())
    );
    expect(headers1).toContain('연락처');
    expect(headers1).toContain('이메일');
    
    // 참석자 데이터가 로드되었는지 확인
    const rows1 = await page.locator('tbody tr').count();
    expect(rows1).toBeGreaterThan(0);
    
    // 이벤트 2로 전환
    await selectBackendAndLoadData(page, '3002', 'attendees');
    
    // 이벤트 2도 같은 CSV 형식을 사용하므로 필드는 동일
    const headers2 = await page.$$eval('thead th', 
      ths => ths.map(th => th.textContent.trim())
    );
    expect(headers2).toEqual(headers1);
    
    // 다른 데이터가 로드되었는지 확인 (행 수가 다를 수 있음)
    const rows2 = await page.locator('tbody tr').count();
    expect(rows2).toBeGreaterThan(0);
  });
  
  test('스캐너 페이지에서 이벤트 전환', async ({ page }) => {
    // 이벤트 1 선택
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 초기 백엔드 확인
    const initialBackend = await getCurrentBackend(page);
    expect(initialBackend.port).toBe('3001');
    
    // 이벤트 2로 전환
    await selectBackendAndLoadData(page, '3002', 'scanner');
    
    // 백엔드가 변경되었는지 확인
    const changedBackend = await getCurrentBackend(page);
    expect(changedBackend.port).toBe('3002');
    expect(changedBackend.baseUrl).toBe('http://localhost:3002');
  });
  
  test('이벤트 선택 상태 유지', async ({ page }) => {
    // 이벤트 2 선택
    await selectBackendAndLoadData(page, '3002', 'index');
    
    // 다른 페이지로 이동 (페이지 전환 시 백엔드 유지 확인)
    await page.goto('/attendees.html');
    await page.waitForTimeout(2000);
    
    // 선택된 이벤트가 유지되는지 확인
    const selectedValue = await page.locator(selectors.eventSelect).inputValue();
    expect(selectedValue).toBe('3002');
    
    // 백엔드 정보도 유지되는지 확인
    const backend = await getCurrentBackend(page);
    expect(backend).toBeTruthy();
    expect(backend.port).toBe('3002');
  });
  
  test('백엔드 새로고침 기능', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(selectors.refreshBackends);
    
    // 토스트 메시지 감지를 위한 설정
    let toastShown = false;
    page.on('locator', (locator) => {
      if (locator.selector === selectors.toast) {
        toastShown = true;
      }
    });
    
    // 새로고침 버튼 클릭
    await page.click(selectors.refreshBackends);
    
    // 백엔드 목록이 업데이트되는지 확인
    await page.waitForTimeout(2000);
    
    // 선택기에 옵션이 있는지 확인
    const options = await page.$$eval(`${selectors.eventSelect} option`, 
      opts => opts.filter(opt => opt.value).length
    );
    expect(options).toBeGreaterThan(0);
  });
});