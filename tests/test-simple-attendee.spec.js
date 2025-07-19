import { test, expect } from '@playwright/test';

test('참가자 추가 테스트', async ({ page }) => {
  // 참석자 페이지로 이동
  await page.goto('http://localhost/attendees.html');
  
  // 페이지 로드 대기
  await page.waitForLoadState('networkidle');
  
  // 이벤트 선택 드롭다운 대기
  await page.waitForSelector('#eventSelect', { timeout: 10000 });
  
  // 이벤트 목록 로드 대기
  await page.waitForTimeout(2000);
  
  // tech-conference-2025 이벤트 선택
  await page.selectOption('#eventSelect', 'tech-conference-2025');
  
  // 토스트 메시지 대기 (데이터 로드 완료)
  await page.waitForSelector('.toast.show', { timeout: 5000 });
  
  // 참가자 추가 버튼 클릭
  const addButton = page.locator('button:has-text("참가자 추가")');
  await addButton.click();
  
  // 모달이 나타날 때까지 대기
  await page.waitForSelector('#addAttendeeModal', { state: 'visible' });
  
  // 동적 폼 필드가 로드될 때까지 대기
  await page.waitForSelector('#dynamicFormFields input', { timeout: 5000 });
  
  // 폼 필드 채우기 (동적으로 생성되는 필드들)
  await page.fill('#dynamicFormFields input[name="고객명"]', '테스트 사용자');
  await page.fill('#dynamicFormFields input[name="회사명"]', '테스트 회사');
  await page.fill('#dynamicFormFields input[name="이메일"]', 'test@example.com');
  
  // 저장 버튼이 보이도록 스크롤
  const saveButton = page.locator('#addAttendeeForm button[type="submit"]');
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.click();
  
  // 성공 메시지 대기
  await page.waitForSelector('.toast.success', { timeout: 5000 });
  
  // 모달이 닫혔는지 확인
  await expect(page.locator('#addAttendeeModal')).not.toBeVisible();
  
  console.log('✅ 참가자 추가 테스트 성공');
});

test('참가자 삭제 테스트', async ({ page, request }) => {
  // 먼저 참가자 목록 가져오기
  const attendeesResponse = await request.get('/api/admin/attendees?event_id=tech-conference-2025');
  const attendees = await attendeesResponse.json();
  
  // 테스트 사용자 찾기
  const testUser = attendees.find(a => a['이메일'] === 'test@example.com');
  
  if (!testUser) {
    console.log('테스트 사용자가 없어서 삭제 테스트 스킵');
    return;
  }
  
  // 참석자 페이지로 이동
  await page.goto('http://localhost/attendees.html');
  
  // 페이지 로드 대기
  await page.waitForLoadState('networkidle');
  
  // 이벤트 선택
  await page.selectOption('#eventSelect', 'tech-conference-2025');
  await page.waitForSelector('.toast.show', { timeout: 5000 });
  
  // 테스트 사용자 행 찾기
  const testRow = page.locator(`#attendeesTableBody tr:has-text("${testUser['이메일']}")`);
  
  // 삭제 버튼 클릭
  const deleteButton = testRow.locator('button[title="삭제"]');
  await deleteButton.click();
  
  // 확인 대화상자 처리
  page.on('dialog', dialog => dialog.accept());
  
  // 성공 메시지 대기
  await page.waitForSelector('.toast.success', { timeout: 5000 });
  
  // 행이 사라졌는지 확인
  await expect(testRow).not.toBeVisible();
  
  console.log('✅ 참가자 삭제 테스트 성공');
});