import { test, expect } from '@playwright/test';
import { selectBackendAndLoadData } from './e2e/helpers/common.js';

test('참가자 삭제 기능 테스트', async ({ page }) => {
  // 네트워크 요청 모니터링
  page.on('response', response => {
    if (response.url().includes('api/admin/attendees') && response.request().method() === 'DELETE') {
      console.log('DELETE 요청:', response.url(), '상태:', response.status());
    }
  });
  
  // 콘솔 로그 캡처
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('브라우저 에러:', msg.text());
    }
  });
  
  // 백엔드 선택 및 데이터 로드
  await selectBackendAndLoadData(page, '3002', 'attendees');
  
  // 첫 번째 참가자의 등록번호 가져오기
  const firstRegistrationNumber = await page.locator('tbody#attendeesTableBody tr:first-child td:first-child').textContent();
  console.log('삭제할 참가자 등록번호:', firstRegistrationNumber);
  
  // 삭제 전 행 개수 확인
  const rowCountBefore = await page.locator('tbody#attendeesTableBody tr').count();
  console.log('삭제 전 참가자 수:', rowCountBefore);
  
  // 첫 번째 참가자의 삭제 버튼 찾기
  const firstDeleteButton = await page.locator('tbody#attendeesTableBody tr:first-child button:has-text("삭제")').first();
  
  // 삭제 버튼 클릭
  page.once('dialog', dialog => {
    console.log('Confirm 다이얼로그:', dialog.message());
    dialog.accept();
  });
  
  await firstDeleteButton.click();
  
  // 삭제 완료 대기 (토스트 메시지 또는 테이블 업데이트)
  await page.waitForTimeout(2000);
  
  // 삭제 후 행 개수 확인
  const rowCountAfter = await page.locator('tbody#attendeesTableBody tr').count();
  console.log('삭제 후 참가자 수:', rowCountAfter);
  
  // 행이 하나 줄어들었는지 확인
  expect(rowCountAfter).toBe(rowCountBefore - 1);
  
  // 삭제된 등록번호가 테이블에 없는지 확인
  const deletedRow = await page.locator(`tbody#attendeesTableBody tr:has-text("${firstRegistrationNumber}")`).count();
  expect(deletedRow).toBe(0);
});