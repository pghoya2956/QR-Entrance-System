/**
 * Docker 컨테이너 헬스체크 유틸리티
 * 모든 서비스가 준비될 때까지 대기
 */

export async function waitForServices(services = [
  { name: 'frontend', url: 'http://localhost', expectedStatus: 200 },
  { name: 'backend', url: 'http://localhost:5001/api/events', expectedStatus: 200 }
]) {
  const maxRetries = 30;
  const retryDelay = 2000; // 2초
  
  console.log('서비스 준비 상태 확인 중...');
  
  for (let i = 0; i < maxRetries; i++) {
    const results = await Promise.all(
      services.map(async (service) => {
        try {
          const response = await fetch(service.url);
          return {
            ...service,
            ready: response.status === service.expectedStatus,
            status: response.status
          };
        } catch (error) {
          return {
            ...service,
            ready: false,
            error: error.message
          };
        }
      })
    );
    
    const allReady = results.every(r => r.ready);
    
    if (allReady) {
      console.log('✅ 모든 서비스가 준비되었습니다.');
      return true;
    }
    
    // 준비되지 않은 서비스 표시
    const notReady = results.filter(r => !r.ready);
    console.log(`⏳ 대기 중... (${i + 1}/${maxRetries})`);
    notReady.forEach(service => {
      console.log(`  - ${service.name}: ${service.error || `상태 코드 ${service.status}`}`);
    });
    
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  
  throw new Error('서비스가 시작되지 않았습니다. Docker 로그를 확인하세요.');
}

/**
 * 특정 이벤트의 백엔드가 준비될 때까지 대기
 */
export async function waitForBackend(eventId) {
  const maxRetries = 10;
  const retryDelay = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:5000/api/info?event_id=${eventId}`);
      if (response.ok) {
        const info = await response.json();
        console.log(`✅ 백엔드 준비됨 (이벤트 ${eventId}): ${info.eventName}`);
        return info;
      }
    } catch (error) {
      // 연결 실패는 정상적인 상황
    }
    
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  
  return null;
}

/**
 * Docker Compose 프로세스 정리
 */
export async function cleanupDocker() {
  console.log('Docker Compose 정리 중...');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('docker-compose down -v');
    console.log('✅ Docker Compose 정리 완료');
  } catch (error) {
    console.error('⚠️ Docker Compose 정리 실패:', error.message);
  }
}