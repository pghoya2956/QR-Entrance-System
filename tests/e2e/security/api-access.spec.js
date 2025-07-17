import { test, expect } from '@playwright/test';
import { waitForServices } from '../setup/docker-health-check.js';
import { selectBackendAndLoadData } from '../helpers/common.js';

test.describe('API 접근 제어 테스트', () => {
  test.beforeAll(async () => {
    await waitForServices();
  });
  
  test('API 엔드포인트 직접 접근', async ({ page }) => {
    await selectBackendAndLoadData(page, '3001', 'index');
    
    // 공개 API - 접근 가능해야 함
    const publicEndpoints = [
      { url: '/api/info', method: 'GET' },
      { url: '/api/checkin/verify', method: 'POST' },
    ];
    
    for (const endpoint of publicEndpoints) {
      const response = await page.request[endpoint.method.toLowerCase()](
        `http://localhost:3001${endpoint.url}`,
        endpoint.method === 'POST' ? {
          data: { qrData: 'REG001:김철수' },
          failOnStatusCode: false
        } : { failOnStatusCode: false }
      );
      
      // 200, 400, 404, 409 에러는 허용 (정상, 잘못된 데이터, 없는 참석자, 중복), 401/403은 안됨
      expect([200, 400, 404, 409]).toContain(response.status());
    }
  });
  
  test('관리자 API 접근 권한', async ({ page }) => {
    // 현재는 인증이 구현되지 않아 모두 접근 가능
    const adminEndpoints = [
      { url: '/api/admin/stats', method: 'GET' },
      { url: '/api/admin/attendees', method: 'GET' },
      { url: '/api/admin/attendee/REG001/toggle-checkin', method: 'PUT' },
      { url: '/api/admin/import-csv', method: 'POST' },
      { url: '/api/admin/export-csv', method: 'GET' },
    ];
    
    for (const endpoint of adminEndpoints) {
      const options = {
        failOnStatusCode: false
      };
      
      if (endpoint.method === 'POST') {
        // CSV 업로드
        const formData = new FormData();
        const csvContent = '등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간\nREG001,테스트,테스트회사,010-1234-5678,test@test.com,초대,false,';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        formData.append('file', blob, 'test.csv');
        options.data = formData;
      }
      
      const response = await page.request[endpoint.method.toLowerCase()](
        `http://localhost:3001${endpoint.url}`,
        options
      );
      
      // TODO: 인증 구현 시 401 반환 확인
      expect(response.status()).not.toBe(500);
    }
  });
  
  test('잘못된 HTTP 메서드 처리', async ({ page }) => {
    // POST 엔드포인트에 GET 요청
    const getResponse = await page.request.get('http://localhost:3001/api/checkin/verify', {
      failOnStatusCode: false
    });
    expect([404, 405]).toContain(getResponse.status());
    
    // GET 엔드포인트에 POST 요청
    const postResponse = await page.request.post('http://localhost:3001/api/info', {
      data: {},
      failOnStatusCode: false
    });
    expect([404, 405]).toContain(postResponse.status());
  });
  
  test('존재하지 않는 엔드포인트', async ({ page }) => {
    const nonExistentEndpoints = [
      '/api/users',
      '/api/admin/delete-all',
      '/api/secret',
      '/admin',
      '/../../../etc/passwd',
    ];
    
    for (const endpoint of nonExistentEndpoints) {
      const response = await page.request.get(`http://localhost:3001${endpoint}`, {
        failOnStatusCode: false
      });
      expect(response.status()).toBe(404);
    }
  });
  
  test('Rate Limiting 확인', async ({ page }) => {
    // 현재는 rate limiting이 구현되지 않음
    // 짧은 시간에 많은 요청 보내기
    const requests = [];
    for (let i = 0; i < 20; i++) {
      requests.push(
        page.request.post('http://localhost:3001/api/checkin/verify', {
          data: { qrData: `REG${i.toString().padStart(3, '0')}:테스트${i}` },
          failOnStatusCode: false
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    
    // 현재는 모든 요청이 처리됨 (rate limiting 없음)
    // TODO: Rate limiting 구현 시 429 상태 코드 확인
    expect(statusCodes.every(code => code !== 429)).toBeTruthy();
  });
  
  test('헤더 인젝션 방지', async ({ page }) => {
    const maliciousHeaders = {
      'X-Forwarded-For': '127.0.0.1\r\nX-Injected: malicious',
      'User-Agent': 'Mozilla/5.0\r\nX-Custom: injected',
      'Referer': 'http://example.com\r\nSet-Cookie: session=hijacked'
    };
    
    const response = await page.request.get('http://localhost:3001/api/info', {
      headers: maliciousHeaders,
      failOnStatusCode: false
    });
    
    // 응답 상태 확인 (CORS 헤더가 없어도 API는 정상 동작)
    expect([200, 204]).toContain(response.status());
    
    // 인젝션된 헤더가 응답에 반영되지 않아야 함
    const responseHeaders = response.headers();
    expect(responseHeaders['x-injected']).toBeUndefined();
    expect(responseHeaders['x-custom']).toBeUndefined();
  });
  
  test('CSV Export 접근 제어', async ({ page }) => {
    // 정상적인 CSV 다운로드
    const response = await page.request.get(
      'http://localhost:3001/api/admin/export-csv',
      { failOnStatusCode: false }
    );
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/csv');
    
    // 응답 내용이 CSV 형식인지 확인
    const content = await response.text();
    expect(content).toContain('등록번호');
    expect(content).toContain('고객명');
  });
  
  test('MIME 타입 검증', async ({ page }) => {
    // API 응답의 Content-Type 확인
    const infoResponse = await page.request.get('http://localhost:3001/api/info');
    expect(infoResponse.headers()['content-type']).toContain('application/json');
    
    const statsResponse = await page.request.get('http://localhost:3001/api/admin/stats');
    expect(statsResponse.headers()['content-type']).toContain('application/json');
    
    const csvResponse = await page.request.get('http://localhost:3001/api/admin/export-csv');
    expect(csvResponse.headers()['content-type']).toContain('text/csv');
  });
  
  test('보안 헤더 확인', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/info');
    const headers = response.headers();
    
    // 기본 보안 헤더 확인
    // TODO: 다음 헤더들이 설정되어야 함
    const expectedHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': 'max-age=31536000; includeSubDomains'
    };
    
    // 현재는 이러한 헤더가 설정되지 않았을 수 있음
    for (const [header, expectedValue] of Object.entries(expectedHeaders)) {
      if (headers[header]) {
        console.log(`보안 헤더 ${header}: ${headers[header]}`);
      }
    }
  });
  
  test('이벤트간 데이터 격리', async ({ page }) => {
    // 이벤트 1의 데이터 접근
    const event1Stats = await page.request.get('http://localhost:3001/api/admin/stats');
    expect(event1Stats.ok()).toBeTruthy();
    const stats1 = await event1Stats.json();
    
    // 이벤트 2의 데이터 접근
    const event2Stats = await page.request.get('http://localhost:3002/api/admin/stats');
    expect(event2Stats.ok()).toBeTruthy();
    const stats2 = await event2Stats.json();
    
    // 두 이벤트의 데이터가 독립적인지 확인
    expect(stats1).not.toEqual(stats2);
  });
});