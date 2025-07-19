-- QR Entrance System 초기 스키마
-- 생성일: 2025-01-18

-- attendees 테이블 생성
CREATE TABLE IF NOT EXISTS attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  contact TEXT,
  email TEXT NOT NULL,
  invitation_type TEXT,
  checked_in INTEGER DEFAULT 0,
  checkin_time TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(event_id, registration_number),
  UNIQUE(event_id, email)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_event_id ON attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_checked_in ON attendees(event_id, checked_in);
CREATE INDEX IF NOT EXISTS idx_registration ON attendees(event_id, registration_number);
CREATE INDEX IF NOT EXISTS idx_email ON attendees(event_id, email);

-- 백업 메타데이터 테이블
CREATE TABLE IF NOT EXISTS backup_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  backup_time TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  status TEXT NOT NULL, -- 'success' or 'failed'
  error TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 마이그레이션 히스토리 테이블
CREATE TABLE IF NOT EXISTS migration_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  applied_at TEXT DEFAULT (datetime('now', 'localtime'))
);