import { test, expect } from '@playwright/test';

test('단순 QR 코드 생성 테스트', async ({ page }) => {
  // 디버깅을 위한 콘솔 로그
  page.on('console', msg => console.log('브라우저 콘솔:', msg.text()));
  page.on('pageerror', err => console.error('페이지 에러:', err));
  
  // 참석자 페이지로 이동 (전체 URL 사용)
  await page.goto('http://localhost/attendees.html');
  
  // 페이지 제목 확인
  const title = await page.title();
  console.log('페이지 제목:', title);
  
  // 현재 URL 확인
  const currentUrl = page.url();
  console.log('현재 URL:', currentUrl);
  
  // 페이지 로드 대기
  await page.waitForLoadState('networkidle');
  
  // 페이지 내용 확인
  const pageContent = await page.locator('h1').first().textContent();
  console.log('페이지 H1:', pageContent);
  
  // 이벤트 선택 드롭다운 대기
  await page.waitForSelector('#eventSelect', { timeout: 10000 });
  
  // 이벤트 목록 로드 대기
  await page.waitForTimeout(2000);
  
  // tech-conference-2025 이벤트 선택
  await page.selectOption('#eventSelect', 'tech-conference-2025');
  
  // 토스트 메시지 대기 (데이터 로드 완료)
  await page.waitForSelector('.toast.show', { timeout: 5000 });
  
  // 데이터 로드 대기
  await page.waitForSelector('#attendeesTableBody tr', { timeout: 10000 });
  
  // 첫 번째 참가자의 QR 버튼 찾기 (title 속성으로)
  const firstRow = page.locator('#attendeesTableBody tr').first();
  const qrButton = firstRow.locator('button[title="QR 코드"]');
  
  // QR 버튼이 보이는지 확인
  await expect(qrButton).toBeVisible();
  
  // QR 버튼 클릭
  await qrButton.click();
  
  // QR 모달 대기
  await page.waitForSelector('#qrModal', { state: 'visible', timeout: 5000 });
  
  // QR 코드 이미지 확인
  const qrImage = page.locator('#qrModal #qrCode img');
  await expect(qrImage).toBeVisible();
  
  // QR 이미지 src 확인
  const imgSrc = await qrImage.getAttribute('src');
  expect(imgSrc).toContain('data:image/png;base64,');
  
  // 다운로드 버튼 확인
  const downloadButton = page.locator('#qrModal button:has-text("다운로드")');
  await expect(downloadButton).toBeVisible();
  
  // 모달 닫기
  const closeButton = page.locator('#qrModal .modal-close');
  await closeButton.click();
  
  // 모달이 닫혔는지 확인
  await expect(page.locator('#qrModal')).not.toBeVisible();
  
  console.log('✅ QR 코드 생성 테스트 성공');
});

test('QR 코드 API 직접 호출 테스트', async ({ request }) => {
  // 먼저 참가자 목록을 가져와서 등록번호 확인
  const attendeesResponse = await request.get('/api/admin/attendees?event_id=tech-conference-2025');
  const attendees = await attendeesResponse.json();
  
  if (attendees.length === 0) {
    console.log('참가자가 없어서 테스트 스킵');
    return;
  }
  
  const firstAttendee = attendees[0];
  const registrationNumber = firstAttendee['등록번호'];
  
  // QR 코드 생성 API 호출 (GET 메서드)
  const response = await request.get(`/api/qr/generate/${registrationNumber}?event_id=tech-conference-2025`);
  
  // 응답 상태 확인
  expect(response.status()).toBe(200);
  
  // 응답 데이터 확인
  const responseData = await response.json();
  expect(responseData).toHaveProperty('qrCode');
  expect(responseData.qrCode).toContain('data:image/png;base64,');
  
  console.log('✅ QR 코드 API 테스트 성공');
});