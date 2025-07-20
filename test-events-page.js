const { chromium } = require('playwright');

(async () => {
  // 브라우저 실행
  const browser = await chromium.launch({
    headless: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('이벤트 목록 페이지 접속 중...');
    
    // 페이지 접속
    await page.goto('http://localhost:8080/events.html', {
      waitUntil: 'networkidle'
    });
    
    // 이벤트 카드가 로드될 때까지 대기
    console.log('이벤트 카드 로딩 대기 중...');
    await page.waitForSelector('.event-card', {
      timeout: 10000
    });
    
    // 추가로 잠시 대기하여 모든 스타일이 적용되도록 함
    await page.waitForTimeout(1000);
    
    // 스크린샷 캡처
    await page.screenshot({
      path: '/tmp/events-page-improved.png',
      fullPage: true
    });
    
    console.log('스크린샷이 /tmp/events-page-improved.png에 저장되었습니다.');
    
    // 이벤트 카드의 스타일 정보 확인
    const eventCards = await page.$$('.event-card');
    console.log(`\n발견된 이벤트 카드 수: ${eventCards.length}`);
    
    if (eventCards.length > 0) {
      // 첫 번째 이벤트 카드의 스타일 정보 확인
      const cardStyles = await eventCards[0].evaluate(element => {
        const computedStyle = window.getComputedStyle(element);
        return {
          padding: computedStyle.padding,
          margin: computedStyle.margin,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          width: element.offsetWidth,
          height: element.offsetHeight
        };
      });
      
      console.log('\n첫 번째 이벤트 카드 스타일:');
      console.log(`- Padding: ${cardStyles.padding}`);
      console.log(`- Margin: ${cardStyles.margin}`);
      console.log(`- Border Radius: ${cardStyles.borderRadius}`);
      console.log(`- Box Shadow: ${cardStyles.boxShadow}`);
      console.log(`- 크기: ${cardStyles.width}px x ${cardStyles.height}px`);
      
      // 이벤트 카드 내부의 간격 확인
      const contentSpacing = await eventCards[0].evaluate(element => {
        const header = element.querySelector('.event-header');
        const info = element.querySelector('.event-info');
        const actions = element.querySelector('.event-actions');
        
        const result = {};
        
        if (header) {
          result.headerPadding = window.getComputedStyle(header).padding;
        }
        
        if (info) {
          const infoStyle = window.getComputedStyle(info);
          result.infoPadding = infoStyle.padding;
          result.infoMargin = infoStyle.margin;
        }
        
        if (actions) {
          const actionsStyle = window.getComputedStyle(actions);
          result.actionsPadding = actionsStyle.padding;
          result.actionsMargin = actionsStyle.margin;
        }
        
        return result;
      });
      
      console.log('\n이벤트 카드 내부 간격:');
      if (contentSpacing.headerPadding) {
        console.log(`- 헤더 패딩: ${contentSpacing.headerPadding}`);
      }
      if (contentSpacing.infoPadding) {
        console.log(`- 정보 섹션 패딩: ${contentSpacing.infoPadding}`);
        console.log(`- 정보 섹션 마진: ${contentSpacing.infoMargin}`);
      }
      if (contentSpacing.actionsPadding) {
        console.log(`- 액션 버튼 패딩: ${contentSpacing.actionsPadding}`);
        console.log(`- 액션 버튼 마진: ${contentSpacing.actionsMargin}`);
      }
    }
    
    console.log('\n테스트 완료!');
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  } finally {
    await browser.close();
  }
})();