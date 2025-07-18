import { test, expect } from '@playwright/test';
import { selectBackendAndLoadData } from './e2e/helpers/common.js';

test('QR 코드 생성 기능 테스트', async ({ page }) => {
  // 콘솔 에러 캡처
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('브라우저 에러:', msg.text());
    }
  });
  
  // 네트워크 요청 모니터링
  page.on('response', response => {
    if (response.url().includes('api/qr/generate')) {
      console.log('QR 생성 요청:', response.url(), '상태:', response.status());
    }
  });
  
  // 백엔드 선택 및 데이터 로드
  await selectBackendAndLoadData(page, '3002', 'attendees');
  
  // 첫 번째 참가자의 QR 생성 버튼 찾기
  const firstQRButton = await page.locator('tbody#attendeesTableBody tr:first-child button:has-text("QR")').first();
  
  // QR 버튼 클릭
  await firstQRButton.click();
  
  // QR 모달이 나타날 때까지 대기
  await page.waitForSelector('#qrModal', { state: 'visible', timeout: 5000 });
  
  // QR 코드 이미지가 표시되는지 확인
  const qrImage = await page.locator('#qrModal #qrCode img');
  await expect(qrImage).toBeVisible();
  
  // QR 코드가 실제로 생성되었는지 확인 (이미지 크기)
  const imgSize = await qrImage.boundingBox();
  expect(imgSize.width).toBeGreaterThan(0);
  expect(imgSize.height).toBeGreaterThan(0);
  
  console.log('QR 코드 크기:', imgSize);
  
  // QR 이미지 src 확인
  const imgSrc = await qrImage.getAttribute('src');
  expect(imgSrc).toContain('data:image/png;base64,');
  console.log('QR 이미지 형식: data URL');
  
  // 다운로드 버튼 확인
  const downloadButton = await page.locator('#qrModal button:has-text("다운로드")');
  await expect(downloadButton).toBeVisible();
  
  // 모달 닫기
  const closeButton = await page.locator('#qrModal .modal-close');
  await closeButton.click();
  
  // 모달이 닫혔는지 확인
  await expect(page.locator('#qrModal')).not.toBeVisible();
});