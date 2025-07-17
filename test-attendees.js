const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // 콘솔 로그 캡처
  page.on('console', msg => console.log('페이지 콘솔:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('페이지 에러:', error.message));
  
  // 네트워크 요청 모니터링
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log('API 요청:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log('API 응답:', response.status(), response.url());
    }
  });
  
  try {
    // 메인 페이지 접속
    await page.goto('http://localhost');
    console.log('✓ 메인 페이지 접속');
    
    // 백엔드 선택 대기
    await page.waitForTimeout(3000);
    
    // 백엔드 선택 확인
    const backendSelector = await page.$('#backendSelector');
    if (backendSelector) {
      const selectedValue = await backendSelector.evaluate(el => el.value);
      console.log('선택된 백엔드:', selectedValue);
    }
    
    // 참가자 관리 클릭
    await page.click('text="참가자 관리"');
    console.log('✓ 참가자 관리 클릭');
    
    // 페이지 로드 대기
    await page.waitForTimeout(3000);
    
    // URL 확인
    console.log('현재 URL:', page.url());
    
    // 에러 메시지 확인
    const errorText = await page.textContent('body');
    if (errorText.includes('참가자 목록을 불러올 수 없습니다')) {
      console.log('❌ 에러 발생: 참가자 목록 로딩 실패');
      
      // localStorage 확인
      const localStorage = await page.evaluate(() => {
        return {
          selectedBackend: window.localStorage.getItem('selectedBackend'),
          selectedEventId: window.localStorage.getItem('selectedEventId'),
          selectedEventName: window.localStorage.getItem('selectedEventName')
        };
      });
      console.log('localStorage:', localStorage);
    }
    
    // 스크린샷
    await page.screenshot({ path: 'attendees-error.png' });
    console.log('✓ 스크린샷 저장: attendees-error.png');
    
    // 5초 대기 (수동 확인용)
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('테스트 에러:', error);
  } finally {
    await browser.close();
  }
})();