import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  
  // 테스트 실행 시간 제한
  timeout: 30 * 1000,
  
  // expect 어설션 타임아웃
  expect: {
    timeout: 5000
  },
  
  // 실패 시 재시도
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // 리포터 설정
  reporter: 'html',
  
  // 공통 설정
  use: {
    baseURL: 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // 프로젝트 설정
  projects: [
    {
      name: 'docker',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  
  // Docker Compose 웹서버 설정 (수동 실행 필요)
  // webServer: {
  //   command: 'docker compose up -d',
  //   port: 80,
  //   timeout: 120 * 1000,
  //   reuseExistingServer: true,
  // },
});