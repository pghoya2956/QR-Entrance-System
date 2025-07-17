#!/bin/bash

echo "🚀 QR 입장 관리 시스템 프로덕션 시작"
echo "===================================="

# Docker 이미지 빌드
echo "🔨 Docker 이미지 빌드 중..."
docker-compose build

# 컨테이너 시작
echo "📦 컨테이너 시작..."
docker-compose up -d

# 상태 확인
echo "🔍 컨테이너 상태 확인..."
docker-compose ps

echo ""
echo "✅ 프로덕션 환경이 시작되었습니다!"
echo "===================================="
echo "📍 프론트엔드: http://localhost"
echo "📍 백엔드 이벤트 1: http://localhost:3001"
echo "📍 백엔드 이벤트 2: http://localhost:3002"
echo "===================================="
echo ""
echo "로그 확인: docker-compose logs -f"
echo "종료: docker-compose down"