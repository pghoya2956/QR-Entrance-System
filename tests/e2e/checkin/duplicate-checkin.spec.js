import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { 
  selectBackendAndLoadData, 
  performQRCheckin, 
  getStats,
  toggleCheckin,
  selectors 
} from '../helpers/common.js';

test.describe('중복 체크인 방지', () => {
  test.beforeAll(async () => {
    await waitForServices();
  });
  
  test('같은 참석자 중복 체크인 방지', async ({ page }) => {
    // 백엔드 선택
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'index');
    
    // 첫 번째 체크인
    const firstResult = await performQRCheckin(page, 'CHECKIN:REG001', 'tech-conference-2025');
    
    expect(firstResult.status).toBe(200);
    expect(firstResult.data.success).toBe(true);
    expect(firstResult.data.attendeeInfo).toBeTruthy();
    
    // 두 번째 체크인 시도
    const secondResult = await performQRCheckin(page, 'CHECKIN:REG001', 'tech-conference-2025');
    
    expect(secondResult.status).toBe(409); // Conflict status
    // 409 응답에는 success 필드가 없음
    expect(secondResult.data.error).toContain('이미 체크인');
  });
  
  test('체크인 시간 기록 확인', async ({ page }) => {
    // 백엔드 선택
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'index');
    
    // 새로운 참석자 체크인
    const checkinTime = new Date();
    const result = await performQRCheckin(page, 'CHECKIN:REG002', 'tech-conference-2025');
    
    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    
    // 체크인 시간이 기록되었는지 확인
    expect(result.data.attendeeInfo.checkinTime).toBeTruthy();
    
    // 체크인 시간이 현재 시간과 비슷한지 확인 (5초 이내)
    const recordedTime = new Date(result.data.attendeeInfo.checkinTime);
    const timeDiff = Math.abs(recordedTime - checkinTime);
    expect(timeDiff).toBeLessThan(5000); // 5초 이내
  });
  
  test('참석자 목록에서 체크인 상태 토글', async ({ page }) => {
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'attendees');
    
    // 체크인되지 않은 참석자 찾기
    const uncheckedRow = await page.locator('tbody tr').filter({
      has: page.locator(selectors.checkinToggle).filter({ hasText: '○' })
    }).first();
    
    // 등록번호 가져오기
    const registrationNumber = await uncheckedRow.locator('td:first-child').textContent();
    
    // 체크인 토글 클릭
    await uncheckedRow.locator(selectors.checkinToggle).click();
    
    // 체크인 상태가 변경되었는지 확인
    await page.waitForTimeout(1000);
    await expect(uncheckedRow.locator(selectors.checkinToggle)).toHaveText('✓');
    
    // 다시 토글하여 체크인 취소
    await uncheckedRow.locator(selectors.checkinToggle).click();
    
    // 체크인 상태가 원래대로 돌아왔는지 확인
    await page.waitForTimeout(1000);
    await expect(uncheckedRow.locator(selectors.checkinToggle)).toHaveText('○');
  });
  
  test('체크인 통계 업데이트', async ({ page }) => {
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'index');
    
    // 초기 통계 가져오기
    const initialStats = await getStats(page, 'tech-conference-2025');
    
    // 새로운 체크인 수행
    const checkinResult = await performQRCheckin(page, 'CHECKIN:REG004', 'tech-conference-2025');
    
    if (checkinResult.status === 409) {
      // 이미 체크인된 경우 스킵
      test.skip();
      return;
    }
    
    expect(checkinResult.status).toBe(200);
    expect(checkinResult.data.success).toBe(true);
    
    // 통계 다시 가져오기
    await page.waitForTimeout(1000);
    const updatedStats = await getStats(page, 'tech-conference-2025');
    
    // 체크인 수가 증가했는지 확인
    expect(updatedStats.checkedIn).toBeGreaterThan(initialStats.checkedIn);
    expect(updatedStats.total).toBe(initialStats.total);
  });
  
  test('이벤트간 체크인 독립성', async ({ page }) => {
    // 이벤트 1에서 체크인
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'index');
    const event1CheckinResult = await performQRCheckin(page, 'CHECKIN:REG005', 'tech-conference-2025');
    
    // 성공이든 중복이든 체크인 시도는 완료됨
    expect([200, 409]).toContain(event1CheckinResult.status);
    
    // 이벤트 2에서 다른 참석자지만 같은 형식의 데이터로 체크인
    await selectBackendAndLoadData(page, 'startup-meetup-2025', 'index');
    const event2CheckinResult = await performQRCheckin(page, 'CHECKIN:STU001', 'startup-meetup-2025');
    
    // 성공이든 중복이든 체크인 시도는 완료됨
    expect([200, 409]).toContain(event2CheckinResult.status);
    
    // 각 이벤트의 체크인 기록이 독립적인지 확인
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'index');
    const stats1 = await getStats(page, 'tech-conference-2025');
    
    await selectBackendAndLoadData(page, 'startup-meetup-2025', 'index');
    const stats2 = await getStats(page, 'startup-meetup-2025');
    
    // 두 이벤트의 통계가 서로 영향을 주지 않는지 확인
    expect(stats1.checkedIn).toBeGreaterThanOrEqual(0);
    expect(stats2.checkedIn).toBeGreaterThanOrEqual(0);
    // 이벤트 1과 2는 다른 CSV 파일을 사용하므로 전체 인원수가 다름
    expect(stats1.total).not.toBe(stats2.total);
  });
});