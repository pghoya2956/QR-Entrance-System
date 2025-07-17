#!/bin/bash

echo "🎉 새 이벤트 추가 도우미"
echo "======================="
echo ""

# 입력 받기
read -p "이벤트 ID (예: tech-summit-2025): " EVENT_ID
read -p "이벤트 이름 (예: 2025 테크 서밋): " EVENT_NAME
read -p "포트 번호 (3001-3010, 예: 3003): " PORT

# CSV 필드 설정
echo ""
echo "CSV 필드를 입력하세요 (쉼표로 구분)"
echo "기본값: 등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간"
read -p "CSV 필드: " CSV_FIELDS
if [ -z "$CSV_FIELDS" ]; then
    CSV_FIELDS="등록번호,고객명,회사명,연락처,이메일,초대/현장방문,체크인,체크인시간"
fi

# 필수 필드 설정
echo ""
echo "필수 필드를 입력하세요 (쉼표로 구분)"
echo "기본값: 등록번호,고객명,회사명,이메일"
read -p "필수 필드: " CSV_REQUIRED
if [ -z "$CSV_REQUIRED" ]; then
    CSV_REQUIRED="등록번호,고객명,회사명,이메일"
fi

# 데이터 디렉토리 생성
DATA_DIR="backend/src/data/${EVENT_ID}"
echo ""
echo "📁 데이터 디렉토리 생성: $DATA_DIR"
mkdir -p "$DATA_DIR"

# CSV 파일 생성
CSV_FILE="$DATA_DIR/attendees.csv"
echo "$CSV_FIELDS" > "$CSV_FILE"
echo "📄 CSV 파일 생성: $CSV_FILE"

# Docker Compose 설정 출력
echo ""
echo "📋 Docker Compose에 추가할 설정:"
echo "================================"
cat << EOF

  backend-${EVENT_ID}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: qr-backend-${EVENT_ID}
    ports:
      - "${PORT}:${PORT}"
    environment:
      - PORT=${PORT}
      - EVENT_ID=${EVENT_ID}
      - EVENT_NAME=${EVENT_NAME}
      - CSV_FIELDS=${CSV_FIELDS}
      - CSV_REQUIRED=${CSV_REQUIRED}
      - JWT_SECRET=qr-entrance-secret-key-2025
    volumes:
      - ./backend/src/data/${EVENT_ID}:/app/backend/src/data/${EVENT_ID}
    networks:
      - qr-network

EOF
echo "================================"
echo ""
echo "✅ 이벤트 추가 준비 완료!"
echo "위 설정을 docker-compose.yml에 추가하고 docker-compose up -d를 실행하세요."