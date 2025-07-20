# Discovery Questions

레거시 멀티포트 시스템 제거에 대한 이해를 위한 질문들입니다.

## Q1: 현재 시스템에서 실제로 여러 포트를 사용하는 이벤트가 있나요?
**Default if unknown:** No (데이터베이스로 이벤트 구분이 가능하다고 언급)

## Q2: 백엔드 API는 단일 포트(예: 3000)로 통합할 예정인가요?
**Default if unknown:** Yes (포트 구분이 불필요하다는 요청에 따라)

## Q3: 기존 docker-compose.yml의 다른 서비스(nginx, frontend)는 유지되나요?
**Default if unknown:** Yes (백엔드 통합만 언급되었으므로)

## Q4: 프론트엔드의 이벤트 선택 UI는 제거하나요?
**Default if unknown:** Yes (포트별 이벤트 선택이 불필요하므로)

## Q5: 테스트 코드도 함께 수정해야 하나요?
**Default if unknown:** Yes (일관성을 위해 테스트도 업데이트 필요)