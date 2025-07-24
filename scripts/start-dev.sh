#!/bin/bash

echo "🚀 QR 입장 관리 시스템 개발 환경 시작"
echo "================================="

# Docker Compose로 백엔드 컨테이너 시작
echo "📦 백엔드 컨테이너 시작..."
docker compose -f docker-compose.dev.yml up -d

# 백엔드가 준비될 때까지 대기
echo "⏳ 백엔드 초기화 대기 중..."
sleep 5

# 프론트엔드 서버 시작 (live-server 사용)
echo "🌐 프론트엔드 서버 시작..."
cd frontend && npx live-server --port=8080 --host=localhost &

echo ""
echo "✅ 개발 환경이 준비되었습니다!"
echo "종료하려면 Ctrl+C를 누르세요."

# 종료 시그널 대기
wait