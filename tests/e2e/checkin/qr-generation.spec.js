import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { initializeTestData } from '../setup/test-data-generator.js';
import { selectBackendAndLoadData, selectors } from '../helpers/common.js';

test.describe('QR 코드 생성', () => {
  let testData;
  
  test.beforeAll(async () => {
    await waitForServices();
    testData = await initializeTestData();
  });
  
  test.skip('참석자 페이지에서 QR 코드 생성', async ({ page }) => {
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'attendees');
    
    // QR 생성 버튼 찾기 (첫 번째 참석자)
    const firstQrButton = await page.locator('.btn-generate-qr').first();
    await expect(firstQrButton).toBeVisible();
    
    // QR 코드 생성 클릭
    await firstQrButton.click();
    
    // QR 코드 모달이 표시되는지 확인
    await expect(page.locator('#qrModal')).toBeVisible();
    await expect(page.locator('#qrModalTitle')).toContainText('QR 코드');
    
    // QR 코드 이미지가 생성되었는지 확인
    const qrImage = await page.locator('#qrCode img');
    await expect(qrImage).toBeVisible();
    
    // QR 코드 이미지 src 확인
    const imageSrc = await qrImage.getAttribute('src');
    expect(imageSrc).toContain('data:image/png;base64,');
  });
  
  test('QR 코드 API 직접 호출', async ({ page }) => {
    // 이벤트 1의 QR 생성 API 호출
    const response = await page.request.get('/api/qr/generate/REG001?event_id=tech-conference-2025');
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('qrCode');
    expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(result).toHaveProperty('qrData', 'CHECKIN:REG001');
    expect(result).toHaveProperty('attendeeInfo');
    expect(result.attendeeInfo.name).toBe('김철수');
    expect(result.attendeeInfo.registrationNumber).toBe('REG001');
  });
  
  test.skip('다른 이벤트의 QR 코드 생성', async ({ page }) => {
    // 이벤트 2의 QR 생성 API 호출
    const response = await page.request.post('/api/qr/generate?event_id=startup-meetup-2025', {
      data: {
        registrationId: 'STU001',
        name: '강민지'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const result = await response.json();
    expect(result).toHaveProperty('qrCode');
    expect(result).toHaveProperty('data', 'STU001:강민지');
  });
  
  test('필수 필드 누락 시 에러', async ({ page }) => {
    // 존재하지 않는 등록번호
    const response1 = await page.request.get('/api/qr/generate/INVALID999?event_id=tech-conference-2025', {
      failOnStatusCode: false
    });
    
    expect(response1.status()).toBe(404);
    const error1 = await response1.json();
    expect(error1.error).toContain('참석자를 찾을 수 없습니다');
    
    // event_id 누락
    const response2 = await page.request.get('/api/qr/generate/REG001', {
      failOnStatusCode: false
    });
    
    expect(response2.status()).toBe(400);
    const error2 = await response2.json();
    expect(error2.error).toContain('event_id가 필요합니다');
  });
  
  test.skip('QR 코드 다운로드 기능', async ({ page }) => {
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'attendees');
    
    // QR 생성 및 모달 열기
    await page.locator('.btn-generate-qr').first().click();
    await page.waitForSelector('#qrModal.show');
    
    // 다운로드 링크 확인
    const downloadLink = await page.locator('#qrCode a');
    await expect(downloadLink).toBeVisible();
    
    // 다운로드 속성 확인
    const downloadAttr = await downloadLink.getAttribute('download');
    expect(downloadAttr).toMatch(/^REG\d{3}_.*\.png$/);
    
    // href 속성 확인
    const href = await downloadLink.getAttribute('href');
    expect(href).toContain('data:image/png;base64,');
  });
  
  test('모달 닫기 기능', async ({ page }) => {
    await selectBackendAndLoadData(page, 'tech-conference-2025', 'attendees');
    
    // QR 생성 및 모달 열기
    await page.locator('.btn-generate-qr').first().click();
    await page.waitForSelector('#qrModal.show');
    
    // X 버튼으로 닫기
    await page.locator('#qrModal .close').click();
    await expect(page.locator('#qrModal')).not.toHaveClass(/show/);
    
    // 다시 열기
    await page.locator('.btn-generate-qr').first().click();
    await page.waitForSelector('#qrModal.show');
    
    // 모달 외부 클릭으로 닫기
    await page.locator('#qrModal').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#qrModal')).not.toHaveClass(/show/);
  });
});