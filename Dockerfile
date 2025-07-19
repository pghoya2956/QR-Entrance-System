# Node.js 18 Alpine 이미지 사용 (가벼움)
FROM node:18-alpine

# SQLite3 및 필요한 패키지 설치
RUN apk add --no-cache sqlite sqlite-dev python3 make g++

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 프로덕션 의존성만 설치 (better-sqlite3 네이티브 빌드 포함)
RUN npm ci --only=production

# 빌드 의존성 제거 (이미지 크기 최적화)
RUN apk del python3 make g++

# 백엔드 소스 코드 복사
COPY backend ./backend

# 포트 노출 (환경변수로 설정 가능)
EXPOSE ${PORT:-3000}

# 애플리케이션 시작
CMD ["node", "backend/src/server.js"]