import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';

test.describe('멀티 백엔드 디스커버리', () => {
  test.beforeAll(async () => {
    // Docker 서비스가 모두 준비될 때까지 대기
    await waitForServices();
  });
  
  test('백엔드 디스커버리 - 활성 백엔드 감지', async ({ page }) => {
    await page.goto('/');
    
    // 이벤트 선택기가 표시될 때까지 대기
    await page.waitForSelector('#eventSelect', { timeout: 15000 });
    
    // 선택 가능한 이벤트 목록 확인
    const options = await page.$$eval('#eventSelect option', 
      opts => opts.map(opt => ({
        text: opt.textContent,
        value: opt.value,
        selected: opt.selected
      }))
    );
    
    // 기본 옵션 제외하고 2개 이상의 이벤트가 있어야 함
    const eventOptions = options.filter(opt => opt.value !== '');
    expect(eventOptions.length).toBeGreaterThanOrEqual(2);
    
    // 예상되는 이벤트들이 포함되어 있는지 확인
    const eventTexts = eventOptions.map(opt => opt.text);
    expect(eventTexts).toContain('2025 테크 컨퍼런스 (포트 3001)');
    expect(eventTexts).toContain('스타트업 밋업 2025 (포트 3002)');
  });
  
  test('백엔드 디스커버리 - 타임아웃 처리', async ({ page }) => {
    // 콘솔 메시지 캡처를 먼저 설정
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    
    await page.goto('/');
    await page.waitForSelector('#eventSelect', { timeout: 15000 });
    
    // 디스커버리가 완료될 때까지 대기
    await page.waitForTimeout(2000);
    
    // 디버깅을 위해 모든 로그 출력
    console.log('Captured logs:', consoleLogs);
    
    // 타임아웃 관련 로그 확인 (3003-3010 포트)
    const timeoutLogs = consoleLogs.filter(log => 
      log.text.includes('타임아웃') || log.text.includes('실패')
    );
    
    // 최소 6개 이상의 타임아웃이 발생해야 함 (3003-3010 중 일부)
    expect(timeoutLogs.length).toBeGreaterThanOrEqual(6);
  });
  
  test('백엔드 정보 API 응답 확인', async ({ page }) => {
    // 백엔드 1 정보 확인
    const response1 = await page.request.get('http://localhost:3001/api/info');
    expect(response1.ok()).toBeTruthy();
    
    const info1 = await response1.json();
    expect(info1).toMatchObject({
      eventId: 'tech-conference-2025',
      eventName: '2025 테크 컨퍼런스',
      port: '3001',
      version: '2.0.0'
    });
    expect(info1.csvFields).toContain('등록번호');
    expect(info1.csvFields).toContain('고객명');
    expect(info1.requiredFields).toContain('등록번호');
    
    // 백엔드 2 정보 확인
    const response2 = await page.request.get('http://localhost:3002/api/info');
    expect(response2.ok()).toBeTruthy();
    
    const info2 = await response2.json();
    expect(info2).toMatchObject({
      eventId: 'startup-meetup-2025',
      eventName: '스타트업 밋업 2025',
      port: '3002',
      version: '2.0.0'
    });
  });
  
  test('백엔드 전환 시 API URL 변경', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#eventSelect');
    
    // 초기 상태 확인
    const initialApiUrl = await page.evaluate(() => window.apiBaseUrl);
    expect(initialApiUrl).toBe('http://localhost:3001');
    
    // 이벤트 2로 전환 - 메인 페이지에서는 데이터만 새로고침
    await page.selectOption('#eventSelect', '3002');
    
    // 토스트 메시지 대기
    await page.waitForSelector('.toast.show', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // API URL이 변경되었는지 확인
    const changedApiUrl = await page.evaluate(() => window.apiBaseUrl);
    expect(changedApiUrl).toBe('http://localhost:3002');
    
    // localStorage에 저장되었는지 확인
    const storedPort = await page.evaluate(() => 
      localStorage.getItem('selectedBackendPort')
    );
    expect(storedPort).toBe('3002');
  });
  
  test('비활성 포트 접근 시 에러 처리', async ({ page }) => {
    // 존재하지 않는 백엔드에 대한 요청
    try {
      const response = await page.request.get('http://localhost:3005/api/info', {
        failOnStatusCode: false
      });
      // 연결 실패 또는 타임아웃 예상
      expect(response.ok()).toBeFalsy();
    } catch (error) {
      // ECONNREFUSED 에러는 예상된 동작
      expect(error.message).toMatch(/ECONNREFUSED|connect/);
    }
  });
});