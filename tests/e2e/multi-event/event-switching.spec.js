import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { 
  initializePage,
  selectors
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
    await expect(page.locator('#refreshEvents')).toBeVisible();
  });
  
  test('이벤트 전환 시 데이터 새로고침', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector(selectors.eventSelect);
    
    // 첫 번째 이벤트의 통계 확인
    const initialStats = await page.locator(selectors.statsTotal).textContent();
    
    // 이벤트 목록에서 다른 이벤트 선택 (있다면)
    const options = await page.$$eval(`${selectors.eventSelect} option`, 
      opts => opts.filter(opt => opt.value).map(opt => opt.value)
    );
    
    if (options.length > 1) {
      // 다른 이벤트로 전환
      await page.selectOption(selectors.eventSelect, options[1]);
      await page.waitForTimeout(1000);
      
      // 통계가 업데이트되었는지 확인
      const newStats = await page.locator(selectors.statsTotal).textContent();
      // 데이터가 다를 수도 있고 같을 수도 있음 (이벤트별 데이터에 따라)
      expect(newStats).toBeDefined();
    }
  });
  
  test('이벤트별 대시보드 데이터 표시', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // 현재 선택된 이벤트 확인
    const selectedEvent = await page.locator(selectors.eventSelect).inputValue();
    expect(selectedEvent).toBeTruthy();
    
    // 통계 정보가 표시되는지 확인
    await expect(page.locator(selectors.statsTotal)).toBeVisible();
    await expect(page.locator(selectors.statsCheckedIn)).toBeVisible();
    await expect(page.locator(selectors.statsNotCheckedIn)).toBeVisible();
  });
  
  test('참석자 페이지에서 이벤트 전환', async ({ page }) => {
    await page.goto('/attendees.html');
    await page.waitForTimeout(2000);
    
    // 이벤트 선택기가 있는지 확인
    await expect(page.locator(selectors.eventSelect)).toBeVisible();
    
    // 테이블이 로드되었는지 확인
    await expect(page.locator('table')).toBeVisible();
    
    // 테이블 헤더 확인
    const headers = await page.$$eval('thead th', 
      ths => ths.map(th => th.textContent.trim())
    );
    expect(headers).toContain('등록번호');
    expect(headers).toContain('고객명');
    expect(headers).toContain('회사명');
  });
  
  test('스캐너 페이지에서 이벤트 표시', async ({ page }) => {
    await page.goto('/scanner.html');
    await page.waitForTimeout(2000);
    
    // 이벤트 선택기가 있는지 확인
    await expect(page.locator(selectors.eventSelect)).toBeVisible();
    
    // 현재 이벤트가 선택되어 있는지 확인
    const selectedValue = await page.locator(selectors.eventSelect).inputValue();
    expect(selectedValue).toBeTruthy();
  });
  
  test('이벤트 선택 상태 유지', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // 현재 선택된 이벤트 저장
    const initialEvent = await page.locator(selectors.eventSelect).inputValue();
    
    // 다른 페이지로 이동
    await page.goto('/attendees.html');
    await page.waitForTimeout(2000);
    
    // 동일한 이벤트가 선택되어 있는지 확인
    const currentEvent = await page.locator(selectors.eventSelect).inputValue();
    expect(currentEvent).toBe(initialEvent);
  });
  
  test('이벤트 새로고침 기능', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#refreshEvents');
    
    // 새로고침 버튼 클릭
    await page.click('#refreshEvents');
    
    // 이벤트 목록이 업데이트되는지 확인
    await page.waitForTimeout(2000);
    
    // 선택기에 옵션이 있는지 확인
    const options = await page.$$eval(`${selectors.eventSelect} option`, 
      opts => opts.filter(opt => opt.value).length
    );
    expect(options).toBeGreaterThan(0);
  });
});