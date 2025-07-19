module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/backend/src/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'backend/src/**/*.js',
    '!backend/src/__tests__/**',
    '!backend/src/migrations/migrate.js' // CLI 도구는 제외
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000
};