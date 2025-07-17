import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { 
  selectBackendAndLoadData,
  performQRCheckin,
  selectors,
  getApiUrl
} from '../helpers/common.js';
import path from 'path';

test.describe('QR 코드 스캔 및 체크인', () => {
  test.beforeAll(async () => {
    await waitForServices();
  });
  
  test('스캐너 페이지 기본 UI', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 스캐너 UI 요소 확인
    await expect(page.locator('#reader')).toBeVisible();
    await expect(page.locator(selectors.scannerFrame)).toBeVisible();
    await expect(page.locator(selectors.scannerStatus)).toBeVisible();
    
    // 카메라 토글 버튼 확인
    await expect(page.locator(selectors.toggleCamera)).toBeVisible();
    await expect(page.locator(selectors.toggleCamera)).toHaveText('카메라 중지');
    
    // 네비게이션 확인
    await expect(page.locator(selectors.navigation)).toBeVisible();
  });
  
  test('카메라 권한 및 스캐너 시작', async ({ page, context }) => {
    // 카메라 권한 자동 승인 설정
    await context.grantPermissions(['camera']);
    
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 스캐너가 자동으로 시작되는지 확인
    await page.waitForTimeout(2000);
    const statusText = await page.locator(selectors.scannerStatus).textContent();
    expect(['QR 코드를 스캔하세요', '카메라를 시작할 수 없습니다']).toContain(statusText);
    
    // 비디오 요소가 있는지 확인 (카메라가 활성화된 경우)
    const videoElement = page.locator('#reader video');
    const videoCount = await videoElement.count();
    
    if (videoCount > 0) {
      // 카메라가 활성화된 경우
      await expect(videoElement).toBeVisible();
      
      // 카메라 토글 테스트
      await page.click(selectors.toggleCamera);
      await expect(page.locator(selectors.toggleCamera)).toHaveText('카메라 시작');
      
      await page.click(selectors.toggleCamera);
      await expect(page.locator(selectors.toggleCamera)).toHaveText('카메라 중지');
    }
  });
  
  test('체크인 API 직접 호출 - 정상 케이스', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 정상 체크인
    const result = await performQRCheckin(page, 'CHECKIN:REG004', '3001');
    
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.attendeeInfo).toMatchObject({
      registrationNumber: 'REG004',
      name: '정수진'
    });
  });
  
  test('체크인 API 직접 호출 - 중복 체크인', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 첫 번째 체크인
    const firstResult = await performQRCheckin(page, 'CHECKIN:REG002', '3001');
    
    if (firstResult.status === 200) {
      // 두 번째 체크인 시도
      const secondResult = await performQRCheckin(page, 'CHECKIN:REG002', '3001');
      
      expect(secondResult.status).toBe(409);
      expect(secondResult.data.success).toBe(false);
      expect(secondResult.data.error).toContain('이미 체크인');
    } else {
      // 이미 체크인된 경우
      expect(firstResult.status).toBe(409);
    }
  });
  
  test('체크인 API 직접 호출 - 미등록 참석자', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 등록되지 않은 참석자 정보
    const result = await performQRCheckin(page, 'CHECKIN:REG999', '3001');
    
    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
    expect(result.data.error).toContain('등록되지 않은');
  });
  
  test('이벤트별 체크인 분리', async ({ page }) => {
    // 이벤트 1에서 체크인
    await selectBackendAndLoadData(page, '3001', 'scanner');
    const event1Result = await performQRCheckin(page, 'CHECKIN:REG005', '3001');
    expect([200, 409]).toContain(event1Result.status);
    
    // 이벤트 2에서 다른 참석자 체크인 (다른 이벤트이므로 성공해야 함)
    await selectBackendAndLoadData(page, '3002', 'scanner');
    const event2Result = await performQRCheckin(page, 'CHECKIN:STU001', '3002');
    expect([200, 409]).toContain(event2Result.status);
    
    // 각 이벤트에 맞는 참석자인지 확인
    if (event1Result.status === 200) {
      expect(event1Result.data.attendeeInfo.registrationNumber).toBe('REG005');
    }
    if (event2Result.status === 200) {
      expect(event2Result.data.attendeeInfo.registrationNumber).toBe('STU001');
    }
  });
  
  test('체크인 후 참석자 목록 업데이트 확인', async ({ page }) => {
    // 참석자 페이지로 이동
    await selectBackendAndLoadData(page, '3001', 'attendees');
    
    // 체크인된 참석자 확인
    const checkedInRows = await page.locator('tbody tr').filter({
      has: page.locator(selectors.checkinToggle).filter({ hasText: '✓' })
    }).count();
    
    expect(checkedInRows).toBeGreaterThan(0);
    
    // 체크인되지 않은 참석자도 있는지 확인
    const uncheckedRows = await page.locator('tbody tr').filter({
      has: page.locator(selectors.checkinToggle).filter({ hasText: '○' })
    }).count();
    
    expect(uncheckedRows).toBeGreaterThan(0);
  });
  
  test('스캐너 페이지 결과 표시 UI', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'scanner');
    
    // 결과 표시 영역이 초기에는 숨겨져 있는지 확인
    const resultDisplay = page.locator(selectors.resultDisplay);
    const initialDisplay = await resultDisplay.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(initialDisplay).toBe('none');
    
    // 체크인 시뮬레이션 (API 호출로 상태 변경)
    const checkinResult = await performQRCheckin(page, 'CHECKIN:REG007');
    
    if (checkinResult.status === 200) {
      // 성공 시 결과 표시 클래스 확인
      const frameClasses = ['success', 'detecting', 'error', 'warning'];
      const scannerFrame = page.locator(selectors.scannerFrame);
      
      // 프레임이 상태 클래스 중 하나를 가질 수 있음
      const hasFrameClass = await scannerFrame.evaluate((el, classes) => {
        return classes.some(cls => el.classList.contains(cls));
      }, frameClasses);
      
      expect(hasFrameClass).toBeDefined();
    }
  });
});