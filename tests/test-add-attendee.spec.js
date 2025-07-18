import { test, expect } from '@playwright/test';
import { selectBackendAndLoadData } from './e2e/helpers/common.js';

test.describe('참가자 추가 기능 테스트', () => {
  test('개별 추가 기능 테스트', async ({ page }) => {
    // 콘솔 에러 캡처
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('브라우저 에러:', msg.text());
      }
    });
    
    // 네트워크 요청 모니터링
    page.on('response', response => {
      if (response.url().includes('api/admin/attendees') && response.request().method() === 'POST') {
        console.log('POST 요청:', response.url(), '상태:', response.status());
      }
    });
    
    // 백엔드 선택 및 데이터 로드
    await selectBackendAndLoadData(page, '3002', 'attendees');
    
    // 참가자 추가 버튼 클릭
    const addButton = await page.locator('button:has-text("+ 참가자 추가")');
    await addButton.click();
    
    // 모달이 나타날 때까지 대기
    await page.waitForSelector('#addAttendeeModal', { state: 'visible' });
    
    // 폼 필드가 동적으로 생성될 때까지 대기
    await page.waitForSelector('#dynamicFormFields input', { timeout: 5000 });
    
    // 폼 필드 확인
    const fields = await page.locator('#dynamicFormFields input').count();
    console.log('생성된 필드 수:', fields);
    
    // 필수 필드 채우기 (타임스탬프로 고유 이메일 생성)
    const timestamp = Date.now();
    await page.fill('input[name="고객명"]', `테스트 참가자 ${timestamp}`);
    await page.fill('input[name="회사명"]', '테스트 회사');
    await page.fill('input[name="이메일"]', `test${timestamp}@example.com`);
    
    // 폼 제출을 JavaScript로 직접 실행
    await page.evaluate(() => {
        const form = document.querySelector('#addAttendeeForm');
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
    });
    
    // 성공 토스트 메시지 확인
    await page.waitForSelector('.toast.show', { timeout: 5000 });
    const toastText = await page.locator('.toast.show').textContent();
    console.log('토스트 메시지:', toastText);
    
    // 모달이 닫혔는지 확인
    await expect(page.locator('#addAttendeeModal')).not.toBeVisible();
  });
  
  test('일괄 추가 미리보기 테스트', async ({ page }) => {
    // 네트워크 요청 모니터링
    page.on('response', response => {
      if (response.url().includes('api/admin/attendees/bulk')) {
        console.log('일괄 추가 요청:', response.url(), '상태:', response.status());
      }
    });
    
    // 콘솔 에러 캡처
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('브라우저 에러:', msg.text());
      }
    });
    
    // 백엔드 선택 및 데이터 로드
    await selectBackendAndLoadData(page, '3002', 'attendees');
    
    // 참가자 추가 버튼 클릭
    await page.locator('button:has-text("+ 참가자 추가")').click();
    
    // 일괄 추가 탭 클릭
    await page.locator('.tab-button:has-text("일괄 추가")').click();
    
    // 테스트 데이터 입력 (고유 이메일 사용)
    const timestamp = Date.now();
    const bulkData = `고객명\t회사명\t이메일\t연락처
테스트1\t회사A\ttest1-${timestamp}@example.com\t010-1111-2222
테스트2\t회사B\ttest2-${timestamp}@example.com\t010-3333-4444`;
    
    await page.fill('#bulkAddData', bulkData);
    
    // 미리보기 확인
    await page.waitForSelector('#bulkPreview', { state: 'visible', timeout: 5000 });
    const previewTable = await page.locator('.preview-table').isVisible();
    console.log('미리보기 테이블 표시:', previewTable);
    
    // 일괄 추가 실행 (JavaScript로 직접 호출)
    await page.evaluate(() => {
        window.handleBulkAdd();
    });
    
    // 결과 확인
    await page.waitForSelector('#bulkAddResult', { state: 'visible' });
    const resultText = await page.locator('#bulkAddResult').textContent();
    console.log('일괄 추가 결과:', resultText);
  });
});