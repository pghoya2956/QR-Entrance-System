/**
 * events 테이블 생성 마이그레이션
 */
const path = require('path');

exports.up = async (db) => {
  // events 테이블 생성
  await db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 기존 이벤트 데이터 삽입
  const events = [
    { id: 'tech-conference-2025', name: '테크 컨퍼런스 2025', description: '최신 기술 동향을 공유하는 연례 컨퍼런스' },
    { id: 'startup-meetup-2025', name: '스타트업 밋업 2025', description: '스타트업 네트워킹 이벤트' },
    { id: 'default-event', name: '기본 이벤트', description: '테스트 및 데모용 기본 이벤트' }
  ];

  const stmt = await db.prepare(
    'INSERT INTO events (id, name, description) VALUES (?, ?, ?)'
  );

  for (const event of events) {
    await stmt.run(event.id, event.name, event.description);
  }

  await stmt.finalize();

  console.log('✅ events 테이블 생성 및 초기 데이터 삽입 완료');
};

exports.down = async (db) => {
  await db.run('DROP TABLE IF EXISTS events');
  console.log('✅ events 테이블 삭제 완료');
};